from email import generator, message
from fastapi import HTTPException

from backend import db
from backend.core.llm import client, LLM_MODEL
import asyncio
import io
import json
import traceback
from typing import List

from fastapi import APIRouter, BackgroundTasks, File, UploadFile, Depends
from fastapi.params import Form
from fastapi.responses import StreamingResponse
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from backend.core.jwt_auth import get_current_user
from backend.services.chat_history_service import save_message, load_history, get_user_sessions, delete_session
from backend.services.usage_service import increment_usage, FREE_LIMITS

router = APIRouter()

from backend.core.config import MAX_FILE_SIZE, MAX_HISTORY, MAX_TOKENS, MAX_USER_MESSAGE_LEN
from backend.services.vector_service import get_vector_db
from backend.engine import apply_hallucination_guard

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
)

def add_to_memory(text: str, user_id: str) -> None:
    try:
        chunks = text_splitter.split_text(text)
        get_vector_db(f"user_{user_id}").add_texts(texts=chunks)
        print(f"✅ [user_{user_id}] Added {len(chunks)} chunks to vector store")
    except Exception as e:
        print(f"❌ [user_{user_id}] Indexing error: {e}")

NON_ACADEMIC_REPLY = (
    "I'm Clarix — a strictly academic assistant. I can only help with "
    "study-related topics such as science, mathematics, history, literature, "
    "engineering, medicine, law, economics, philosophy, and similar academic subjects. "
    "Please ask me something academic and I'll be happy to help! 📚"
)

# ── Intent detection ─────────────────────────────────────────────────────
_INTENT_PATTERNS = [
    ("compare",   ["compare", "vs", "versus", "difference between"]),
    ("debug",     ["error", "bug", "not working", "fix this", "traceback"]),
    ("howto",     ["how do i", "how to", "steps to", "implement"]),
    ("why",       ["why does", "why is", "why do", "reason for"]),
    ("design",    ["design", "architecture", "system design", "build a"]),
    ("interview", ["interview question", "interview prep", "asked in interview"]),
    ("research",  ["research", "literature review", "state of the art", "papers on"]),
]

def detect_intent(query: str) -> str:
    q = query.lower()
    for intent, keywords in _INTENT_PATTERNS:
        if any(k in q for k in keywords):
            return intent
    return "explain"

_DEPTH_KEYWORDS = {
    "beginner":     ["explain simply", "eli5", "for a beginner", "in simple terms"],
    "advanced":     ["in depth", "advanced", "rigorous", "formal proof", "graduate level"],
}

def detect_depth(query: str, stored_level: str | None) -> str:
    q = query.lower()
    for level, keywords in _DEPTH_KEYWORDS.items():
        if any(k in q for k in keywords):
            return level
    if stored_level:
        return stored_level
    return "intermediate"

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


def get_ai_response(user_query: str, history: list, mode: str, context: str, trigger_scholarly_template: bool, stored_level: str | None = None):
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
        system_prompt = f"""You are 'Clarix Code', an expert programming and computer science tutor.
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
{context[:1500]}
"""
    elif trigger_scholarly_template:
        intent       = detect_intent(user_query)
        depth        = detect_depth(user_query, stored_level)

        _STRUCTURES = {
            "compare":   "1) Direct answer comparing both.\n2) Side-by-side key differences (bullets).\n3) When to use each.\n4) One example.",
            "debug":     "1) Direct diagnosis of the issue.\n2) Root cause (brief).\n3) Fix with code/steps.\n4) How to avoid it next time.",
            "howto":     "1) Direct answer — the steps.\n2) Brief why behind each non-obvious step.\n3) One worked example.",
            "why":       "1) Direct answer to 'why'.\n2) Supporting reasoning (2-3 points).\n3) One example or analogy.",
            "design":    "1) Direct high-level answer.\n2) Key components/trade-offs (bullets).\n3) One concrete example or diagram description.",
            "interview": "1) Direct, interview-ready answer.\n2) Key points an interviewer expects (bullets).\n3) One follow-up question to anticipate.",
            "research":  "1) Direct summary of current understanding.\n2) Key findings/approaches (bullets).\n3) One open question or limitation.",
            "explain":   "1) Direct answer to the question first.\n2) Core concept breakdown (bullets).\n3) One real-world example.\n4) One practice question.",
        }
        structure = _STRUCTURES.get(intent, _STRUCTURES["explain"])

        _DEPTH_INSTRUCTIONS = {
            "beginner":     "Use simple vocabulary, avoid jargon, keep math minimal, use everyday analogies.",
            "intermediate": "Use standard academic vocabulary, include relevant formulas/terms, moderate depth.",
            "advanced":     "Use precise technical/academic vocabulary, include rigorous detail and notation where relevant.",
        }
        depth_instruction = _DEPTH_INSTRUCTIONS[depth]

        system_prompt = f"""You are 'Clarix', a strict, expert academic study assistant. {selected_instruction}

**ANSWER THE DIRECT QUESTION FIRST**, then expand using this structure for a "{intent}" request:
{structure}

**Audience depth: {depth}.** {depth_instruction}

**ABSOLUTE RULE — NON-NEGOTIABLE**: You ONLY answer academic and study-related questions.
If a message is not about an academic subject, you MUST refuse and say:
"{NON_ACADEMIC_REPLY}"

Be precise and factually accurate. Keep the response focused — no filler or repeated framing.

Context:
{context[:1500]}
"""
    else:
        intent       = detect_intent(user_query)
        depth        = detect_depth(user_query, stored_level)
        depth_instruction = {
            "beginner":     "Use simple vocabulary, minimal jargon, minimal math.",
            "intermediate": "Use standard academic vocabulary and moderate technical depth.",
            "advanced":     "Use precise technical vocabulary and rigorous depth.",
        }[depth]

        system_prompt = f"""You are 'Clarix', a strict, expert academic study assistant. {selected_instruction}

**Answer the user's direct question first**, then add only the context needed to fully address it. Be precise, factually accurate, and avoid generic filler.

**Audience depth: {depth}.** {depth_instruction}

**ABSOLUTE RULE — NON-NEGOTIABLE**: You ONLY answer academic and study-related questions.
If a message is not about an academic subject, you MUST refuse and say:
"{NON_ACADEMIC_REPLY}"

**MULTI-QUESTION RULE**: If asked more than 8 questions at once, answer the first 6 fully, then say: "Type 'continue' for the remaining questions."
**CONTINUE RULE**: If the user sends "continue", resume exactly where the previous response ended — no restart, no repeat, no preamble.

Context:
{context[:1500]}
"""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-MAX_HISTORY:]:
        content = (msg.get("content") or "")[:1500]
        messages.append({"role": msg.get("role"), "content": content})
    messages.append({"role": "user", "content": user_query})

    async def generate():
        """
        Async generator — each Groq SDK network read is dispatched via
        run_in_executor so the event loop is never blocked. Under load,
        the sync version serialised all concurrent requests behind each
        streaming response; this version lets them interleave freely.
        """
        try:
            # Retry up to 3 times on rate limit errors
            for _attempt in range(3):
                try:
                    response = await asyncio.to_thread(
                        client.chat.completions.create,
                        model=LLM_MODEL,
                        messages=messages,
                        max_tokens=MAX_TOKENS,
                        temperature=0.3,
                        stream=True,
                        timeout=120,
                    )
                    break
                except Exception as _e:
                    _err = str(_e).lower()
                    if ("rate" in _err or "429" in _err) and _attempt < 2:
                        await asyncio.sleep(2 ** _attempt)
                        continue
                    raise
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
            print("=" * 80)
            print("LLM ERROR")
            print(f"Type: {type(e)}")
            print(f"Exception: {repr(e)}")
            traceback.print_exc()
            print("=" * 80)

            err = str(e).lower()

            if "timeout" in err or "timed out" in err:
                yield "\n\n⚠️ **Response timed out.** Groq is taking too long — please try again."

            elif "429" in err or "rate" in err:
                yield "\n\n⚠️ **Rate limit reached.** Please wait a moment before sending another message."

            elif "connect" in err or "network" in err:
                yield "\n\n⚠️ **Connection error.** Check your internet and try again."

            else:
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
    # Sanitise session_id to prevent path traversal into Chroma dirs
    session_id = session_id.replace("/", "_").replace("\\", "_").replace("..", "_")

    trigger_template = any(
        word in message.lower()
        for word in ["simplify", "explain", "tutor", "help me understand", "teach me", "describe"]
    )

    # Enforce daily chat limit
    if not await asyncio.to_thread(increment_usage, current_user["user_id"], "chat"):
        def _limit():
            yield f"⚠️ You've reached your daily limit of {FREE_LIMITS['chat']} messages. Limit resets at midnight."
        return StreamingResponse(_limit(), media_type="text/plain")
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
                # Validate PDF magic bytes — reject files masquerading as PDFs
                if not content.startswith(b"%PDF"):
                    print(f"❌ Rejected fake PDF: {file.filename}")
                    continue
                # Reject suspiciously small or large files
                if len(content) < 100:
                    continue
                try:
                    pdf_reader = PdfReader(io.BytesIO(content))
                except Exception:
                    print(f"❌ Corrupt PDF rejected: {file.filename}")
                    continue
                if not pdf_reader.pages:
                    continue

                raw_text = ""
                for page in pdf_reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        raw_text += extracted + "\n"

                if raw_text.strip():
                    await asyncio.to_thread(add_to_memory, raw_text, user_id)
                    context_from_files += f"\n--- {file.filename} ---\n{raw_text[:1500]}"
            else:
                try:
                    raw_text = content.decode("utf-8")
                    if raw_text.strip():
                        context_from_files += f"\n--- {file.filename} ---\n{raw_text[:1500]}"
                except UnicodeDecodeError:
                    print(f"❌ Could not decode file: {file.filename}")

        db   = get_vector_db(f"user_{user_id}")
        docs = await asyncio.to_thread(db.similarity_search, message, k=3)
        db_context = "\n".join([doc.page_content for doc in docs])[:1500]

        combined_context = ""
        if context_from_files:
            combined_context += f"[UPLOADED FILES]\n{context_from_files}\n\n"
        if db_context:
            combined_context += f"[RELEVANT MEMORY]\n{db_context}"

        # Save user message to DB in background
        background_tasks.add_task(save_message, user_id, session_id, "user", message, mode)

        from backend.services.memory_service import get_profile
        profile = await asyncio.to_thread(get_profile, user_id)
        stored_level = "advanced" if "Engineering" in (profile.get("subject_focus") or []) or "Computer Science" in (profile.get("subject_focus") or []) else None

        gen = get_ai_response(
            user_query=message,
            history=history_list,
            mode=mode,
            context=combined_context,
            trigger_scholarly_template=trigger_template,
            stored_level=stored_level,
        )

        # Wrap generator to also save AI response to DB
        async def streaming_with_save():
            full_response = ""
            async for chunk in gen():
                full_response += chunk
                yield chunk
            full_response = apply_hallucination_guard(full_response)
            # Push DB write to background — calling sync save_message() directly
            # Push DB write to background — calling sync save_message() directly
            # inside an async generator blocks the event loop until the DB commit
            # completes, stalling all other in-flight requests on the server.
            background_tasks.add_task(save_message, user_id, session_id, "assistant", full_response, mode)
            # Award streak for real study exchange
            try:
                from backend.services.memory_service import touch_streak
                background_tasks.add_task(touch_streak, current_user["user_id"])
            except Exception:
                pass

            try:
                from backend.db import record_progress
                background_tasks.add_task(record_progress, user_id, 1)
            except Exception:
                pass

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

    def _fetch():
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
            return cur.fetchall()
        finally:
            release_connection(conn)
    rows = await asyncio.to_thread(_fetch)


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