from email import generator
from http.client import HTTPException

from backend.core.llm import client, LLM_MODEL
import asyncio
import io
import json
from typing import List

from fastapi import APIRouter, BackgroundTasks, File, UploadFile, Depends
from fastapi.params import Form
from fastapi.responses import StreamingResponse
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from backend.core.jwt_auth import get_current_user
from backend.services.chat_history_service import save_message, load_history, get_user_sessions, delete_session

router = APIRouter()

from backend.core.config import MAX_FILE_SIZE, MAX_HISTORY, MAX_TOKENS, MAX_USER_MESSAGE_LEN
from backend.services.vector_service import get_vector_db
from backend.engine import apply_hallucination_guard

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
)

def add_to_memory(text: str, session_id: str) -> None:
    try:
        chunks = text_splitter.split_text(text)
        get_vector_db(session_id).add_texts(texts=chunks)
        print(f"✅ [{session_id}] Added {len(chunks)} chunks to vector store")
    except Exception as e:
        print(f"❌ [{session_id}] Indexing error: {e}")


NON_ACADEMIC_REPLY = (
    "I'm ScholarlyAI — a strictly academic assistant. I can only help with "
    "study-related topics such as science, mathematics, history, literature, "
    "engineering, medicine, law, economics, philosophy, and similar academic subjects. "
    "Please ask me something academic and I'll be happy to help! 📚"
)

# ── Local pre-filter ──────────────────────────────────────────────────────
# Obvious non-academic patterns caught locally — no LLM call needed.
# Keeps latency near-zero for the most common rejection cases.
_NON_ACADEMIC_PATTERNS = [
    "who do you like", "what's your favourite", "tell me a joke",
    "what should i eat", "recipe for", "how do i cook",
    "celebrity", "movie recommendation", "what should i watch",
    "sports score", "who won the game", "relationship advice",
    # games
    "genshin", "candy crush", "fortnite", "minecraft", "roblox",
    "league of legends", "valorant", "apex legends", "call of duty",
    "pokemon go", "clash of clans", "among us", "pubg", "fifa",
    "how to play", "best character", "best weapon", "tier list",
    "game guide", "gaming", "streamer", "twitch",
    # entertainment
    "netflix", "anime recommendation", "manga", "webtoon",
    "tiktok", "instagram", "youtube video", "meme",
    "song lyrics", "music recommendation", "playlist",
]

def _is_obviously_non_academic(query: str) -> bool:
    q = query.lower()
    return any(p in q for p in _NON_ACADEMIC_PATTERNS)


def is_academic_query(user_query: str) -> bool:
    # Fast path: catch obvious non-academic queries without an LLM call
    if _is_obviously_non_academic(user_query):
        return False

    # Replace the classification_prompt:
    classification_prompt = (
        "You are a strict academic content classifier for a study assistant app.\n"
        "ALLOW only: school/university subjects (science, maths, history, literature, "
        "engineering, medicine, law, economics, philosophy, programming concepts, "
        "geography, psychology, sociology, languages, art history, music theory), "
        "study techniques, exam preparation, document analysis.\n\n"
        "REJECT everything else, including but not limited to: "
        "video games (ANY game title or gaming question), "
        "entertainment (movies, TV shows, anime, manga, music, celebrities), "
        "social media, cooking, sports results, jokes, personal advice, "
        "casual chitchat, app recommendations, travel tips.\n\n"
        "When in doubt, REJECT.\n\n"
        f"Message: \"{user_query}\"\n\n"
        "Reply with exactly one word: ACADEMIC or NON-ACADEMIC"
    )
    try:
        # 3-second timeout — if Groq is slow we fail open (allow the message)
        # rather than making the user wait for a classifier that may never return.
        resp = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": classification_prompt}],
            max_tokens=5,
            temperature=0.0,
            timeout=3.0,
        )
        verdict = resp.choices[0].message.content.strip().upper()
        return "ACADEMIC" in verdict
    except Exception as e:
        print(f"⚠️ Classification error (defaulting to allow): {e}")
        return True


def get_ai_response(user_query: str, history: list, mode: str, context: str, trigger_scholarly_template: bool):
    mode_instructions = {
        "LEARN":    "Act as an expert tutor. Provide clear, structured, comprehensive explanations with examples.",
        "QUIZ":     "Act as a rigorous examiner. Generate challenging, well-formed questions that test deep understanding.",
        "SUMMARY":  "Act as a research analyst. Provide concise, well-organized bullet-point summaries with key insights.",
        "ANALYSIS": "Act as an academic critic. Provide detailed analysis, identify gaps, implications, and deeper insights.",
        "CODE":     (
            "Act as an expert software engineer and coding tutor. "
            "For every coding question, respond exactly as a senior GPT-4 coding expert: "
            "1) Start with a clear 1-2 sentence plain-English explanation of the approach/algorithm. "
            "2) Provide clean, production-ready, well-commented code in a fenced code block with language tag. "
            "3) After the code, explain each key section using bullet points. "
            "4) Discuss edge cases, time/space complexity, or alternative approaches if relevant. "
            "5) Always use proper syntax highlighting (```python, ```javascript, etc.). "
            "Keep explanations concise but complete. Always provide working, runnable code over pseudocode. "
            "Never provide misleading or incorrect code."
        ),
    }
    selected_instruction = mode_instructions.get(mode, "Act as an expert academic assistant.")

    if mode == "CODE":
        system_prompt = f"""You are 'ScholarlyAI Code', an expert programming and computer science tutor.
{selected_instruction}

**RESPONSE FORMAT (strictly follow for every coding question):**
1. **Approach** — Plain-English explanation of the strategy/algorithm (1-2 sentences).
2. **Code** — Fenced code block with language tag, clean and well-commented.
3. **Explanation** — Bullet-point walkthrough of key sections and logic.
4. **Notes** — Edge cases, time/space complexity, or alternative approaches if applicable.

**Quality Standards:**
- Code MUST be production-ready, syntactically correct, and runnable.
- Comments must be clear and explain the WHY, not just the WHAT.
- Never provide misleading, incorrect, or incomplete code.

**Context from uploaded files (use if relevant):**
{context[:3000]}
"""
    elif trigger_scholarly_template:
        template_instruction = """
Every response MUST follow this exact visual sequence:
### **[TOPIC NAME IN BOLD]**
*Concise, clear explanation of the main concept*

### **Core Concept Breakdown**
* **Key Term 1**: Precise definition and explanation.
* **Key Term 2**: Precise definition and explanation.

### **Technical/Mathematical Detail**
*Formula, principle, or technical fact with brief explanation*

### **Real-World Analogy**
*A clear, relatable analogy that simplifies the abstract concept*

### **Worked Example or Application**
*Concrete example showing how the concept is applied*

### **Quick Check Quiz**
**Question:** [MCQ testing understanding of the main concept]
- A) [Distractor]
- B) [Correct answer]
- C) [Distractor]
- D) [Distractor]

### **Common Misconceptions**
* *Misconception*: What students often get wrong.
* *Correction*: The accurate explanation.
"""
        system_prompt = f"""You are 'ScholarlyAI', a strict, expert academic study assistant. {selected_instruction}

{template_instruction}

**ABSOLUTE RULE — NON-NEGOTIABLE**: You ONLY answer academic and study-related questions.
If a message is not about an academic subject, you MUST refuse and say:
"{NON_ACADEMIC_REPLY}"

**Quality Standards for Responses:**
- Provide EXACT, CLEAN, DETAILED explanations with no misleading information.
- Be precise in definitions and technical content.
- Ensure all examples and analogies accurately represent the concept.
- Use proper academic terminology consistently.
- Organize information logically and hierarchically.

**Context Use**: Use the provided context if relevant. If context is insufficient, use your reliable knowledge.

Context:
{context[:3000]}
"""
    else:
        system_prompt = f"""You are 'ScholarlyAI', a strict, expert academic study assistant. {selected_instruction}

**Quality Standards for All Responses:**
- Provide EXACT, CLEAN, DETAILED explanations without misleading information.
- Be precise in technical content and definitions.
- Ensure all claims are academically sound and factually correct.
- Organize responses logically with clear structure.
- Use proper academic terminology and conventions.
- Provide examples, context, and deeper insight when relevant.

**ABSOLUTE RULE — NON-NEGOTIABLE**: You ONLY answer academic and study-related questions.
If a message is not about an academic subject, you MUST refuse and say:
"{NON_ACADEMIC_REPLY}"

**Context Use**: Use the provided context if available and relevant. Otherwise, use your knowledge.

**MULTI-QUESTION RULE**: If the user asks more than 8 questions at once, answer the first 6 fully, then end with: "Type 'continue' for the remaining questions."
**CONTINUE RULE**: If the user sends "continue" or "continue answer", look at the conversation history and resume EXACTLY where the previous response ended — do not restart, do not repeat, do not add a preamble. Start mid-sentence or at the next question number if that is where it stopped.
Context:
{context[:3000]}
"""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-MAX_HISTORY:]:
        messages.append({"role": msg.get("role"), "content": msg.get("content")})
    messages.append({"role": "user", "content": user_query})

    async def generate():
        """
        Async generator — each Groq SDK network read is dispatched via
        run_in_executor so the event loop is never blocked. Under load,
        the sync version serialised all concurrent requests behind each
        streaming response; this version lets them interleave freely.
        """
        try:
            # Open the stream on a thread — the initial connection is blocking
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=LLM_MODEL,
                messages=messages,
                max_tokens=MAX_TOKENS,
                temperature=0.3,
                stream=True,
                timeout=120,
            )
            # Each next() on the sync stream iterator is a blocking network
            # read — run every one on the thread pool.
            # NOTE: StopIteration cannot propagate through a Future/coroutine
            # (PEP 479 / asyncio limitation). Use a sentinel object instead.
            _DONE = object()
            loop = asyncio.get_event_loop()
            stream_iter = iter(response)
            while True:
                chunk = await loop.run_in_executor(
                    None, next, stream_iter, _DONE
                )
                if chunk is _DONE:
                    break
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except asyncio.TimeoutError:
            yield "\n\n⚠️ **Response timed out.** Groq is taking too long — please try again."
        except Exception as e:
            err = str(e).lower()
            if "timeout" in err or "timed out" in err:
                yield "\n\n⚠️ **Response timed out.** Groq is taking too long — please try again."
            elif "rate" in err or "429" in err:
                yield "\n\n⚠️ **Rate limit reached.** Please wait a moment before sending another message."
            elif "connect" in err or "network" in err:
                yield "\n\n⚠️ **Connection error.** Check your internet and try again."
            else:
                print(f"[generate] Unhandled error: {e}")
                yield "\n\n⚠️ **Something went wrong.** Please try again."
    return generate


# ─────────────────────────────────────────────
# CHAT ENDPOINT
# ─────────────────────────────────────────────
@router.post("/chat")
# NEW
async def chat_endpoint(
    background_tasks: BackgroundTasks,
    message:      str              = Form(...),
    session_id:   str              = Form(...),
    mode:         str              = Form("LEARN"),
    files:        List[UploadFile] = File(default=[]),
    current_user: dict             = Depends(get_current_user),
):
    # Guard: reject oversized messages before any LLM or DB work.
    # Without this, a 500KB message is passed raw to Groq, stored in DB,
    # and included in every subsequent history load for the session.
    if len(message) > MAX_USER_MESSAGE_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long ({len(message)} chars). Maximum is {MAX_USER_MESSAGE_LEN} characters."
        )

    trigger_template = any(
        word in message.lower()
        for word in ["simplify", "explain", "tutor", "help me understand", "teach me", "describe"]
    )

    if mode != "CODE" and not await asyncio.to_thread(is_academic_query, message):
        def _refuse():
            yield NON_ACADEMIC_REPLY
        return StreamingResponse(_refuse(), media_type="text/plain")

    try:
        # NEW
        user_id      = current_user["user_id"]
        history_list = load_history(user_id, session_id)
        context_from_files = ""

        for file in files:
            if file.size and file.size > MAX_FILE_SIZE:
                raise Exception(f"File '{file.filename}' exceeds maximum size")

            content = await file.read()
            if not content:
                continue

            if file.filename.lower().endswith(".pdf"):
                pdf_reader = PdfReader(io.BytesIO(content))
                if not pdf_reader.pages:
                    continue

                raw_text = ""
                for page in pdf_reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        raw_text += extracted + "\n"

                if raw_text.strip():
                    background_tasks.add_task(add_to_memory, raw_text, session_id)
                    context_from_files += f"\n--- {file.filename} ---\n{raw_text[:1500]}"
            else:
                try:
                    raw_text = content.decode("utf-8")
                    if raw_text.strip():
                        context_from_files += f"\n--- {file.filename} ---\n{raw_text[:1500]}"
                except UnicodeDecodeError:
                    print(f"❌ Could not decode file: {file.filename}")

        db   = get_vector_db(session_id)
        docs = await asyncio.to_thread(db.similarity_search, message, k=3)
        db_context = "\n".join([doc.page_content for doc in docs])

        combined_context = ""
        if context_from_files:
            combined_context += f"[UPLOADED FILES]\n{context_from_files}\n\n"
        if db_context:
            combined_context += f"[RELEVANT MEMORY]\n{db_context}"

        # Save user message to DB in background
        background_tasks.add_task(save_message, user_id, session_id, "user", message, mode)

        gen = get_ai_response(
            user_query=message,
            history=history_list,
            mode=mode,
            context=combined_context,
            trigger_scholarly_template=trigger_template,
        )

        # Wrap generator to also save AI response to DB
        async def streaming_with_save():
            full_response = ""
            async for chunk in generator():
                full_response += chunk
                yield chunk
            full_response = apply_hallucination_guard(full_response)
            # Push DB write to background — calling sync save_message() directly
            # Push DB write to background — calling sync save_message() directly
            # inside an async generator blocks the event loop until the DB commit
            # completes, stalling all other in-flight requests on the server.
            background_tasks.add_task(save_message, user_id, session_id, "assistant", full_response, mode)

        return StreamingResponse(streaming_with_save(), media_type="text/plain")

    except Exception as e:
        print(f"CRITICAL ERROR in /chat: {e}")
        raise


# ─────────────────────────────────────────────
# HISTORY ENDPOINTS
# ─────────────────────────────────────────────
@router.get("/chat/history/{session_id}")
async def get_chat_history(
    session_id: str,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    from backend.db import get_connection, release_connection
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT role, content, mode FROM chat_sessions
               WHERE user_id = %s AND session_id = %s
               ORDER BY created_at ASC
               LIMIT %s OFFSET %s""",
            (current_user["user_id"], session_id, limit, offset)
        )
        rows = cur.fetchall()
        history = [{"role": r[0], "content": r[1], "mode": r[2]} for r in rows]
        return {"history": history, "limit": limit, "offset": offset, "count": len(history)}
    finally:
        release_connection(conn)


@router.get("/chat/sessions")
async def get_sessions(
    current_user: dict = Depends(get_current_user),
):
    """Get all chat sessions for the current user"""
    user_id  = current_user["user_id"]
    sessions = get_user_sessions(user_id)
    return {"sessions": sessions}


@router.delete("/chat/session/{session_id}")
async def delete_chat_session(
    session_id:   str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a chat session"""
    user_id = current_user["user_id"]
    delete_session(user_id, session_id)
    return {"status": "deleted", "session_id": session_id}