from datetime import datetime
import json
from typing import Optional

import asyncio
from fastapi import APIRouter, Form, Depends, HTTPException, Request
from backend.core.limiter import limiter
from backend.core.jwt_auth import get_current_user
from backend.routes.profile_routes import _retry_log  # for retry verification logging
from fastapi.params import Form

from backend.routes.chat_routes import NON_ACADEMIC_REPLY, is_academic_query
from backend.core.llm import client, LLM_MODEL
from backend.services.memory_service import add_xp, push_notification, record_weakness


router = APIRouter()


def _parse_quiz_questions(raw: str) -> list:
    """
    Parse MCQ blocks into a list of question dicts.
    Handles two formats:
      1. Blocks separated by '---'  (used by /study-session/start)
      2. Continuous output with 'Q:' or 'QUESTION:' marking each new question
         (used by /study-session/retry-weak — model ignores the '---' instruction)
    """
    # Normalise line endings
    raw = raw.strip()

    # Split into blocks — try '---' first, fall back to splitting on Q:/QUESTION: lines
    if "---" in raw:
        blocks = [b.strip() for b in raw.split("---") if b.strip()]
    else:
        # Re-split by question-start markers so each block = one question
        import re
        blocks = re.split(r'(?=^(?:Q:|QUESTION:)\s)', raw, flags=re.MULTILINE)
        blocks = [b.strip() for b in blocks if b.strip()]

    questions = []
    for block in blocks:
        lines = block.split("\n")
        q_text, options, answer, explanation = "", [], "", ""
        for line in lines:
            line = line.strip()
            if not line:
                continue
            low = line.lower()
            if low.startswith("question:") or low.startswith("q:"):
                q_text = line.split(":", 1)[1].strip()
            elif low.startswith("answer:"):
                answer = line.split(":", 1)[1].strip().upper().lstrip("(").rstrip(")")
                # Handle "Answer: B)" or "Answer: (B)"
                answer = answer[0] if answer else ""
            elif low.startswith("explanation:"):
                explanation = line.split(":", 1)[1].strip()
            elif line and line[0] in "ABCD" and len(line) > 2 and line[1] in "):.":
                options.append({"letter": line[0], "text": line[2:].strip().lstrip(") ").strip()})
        if q_text and len(options) == 4 and answer:
            questions.append({
                "question": q_text,
                "options":  options,
                "answer":   answer,
                "explanation": explanation,
            })
    return questions

@router.post("/study-session/start")
@limiter.limit("10/minute")
async def start_study_session(
    request: Request,
    subject:  str           = Form(...),
    user_id:  Optional[str] = Form(None),
    num_questions: int      = Form(4),
    current_user: dict = Depends(get_current_user)
):
    """
    Generates a mini study session: 3–5 MCQ questions on a subject,
    returns them all at once so the frontend can run a guided quiz flow.
    """
    try:
        if not await asyncio.to_thread(is_academic_query, subject):
            raise HTTPException(status_code=400, detail=NON_ACADEMIC_REPLY)

        prompt = (
            f"Create exactly {num_questions} multiple-choice questions about: {subject}\n\n"
            "Requirements:\n"
            "- Each question tests a DIFFERENT concept or subtopic.\n"
            "- 4 options (A, B, C, D) per question.\n"
            "- Mark the correct answer clearly.\n\n"
            "Output format (repeat for each question, separated by '---'):\n"
            "QUESTION: The question text?\n"
            "A) Option one\n"
            "B) Option two\n"
            "C) Option three\n"
            "D) Option four\n"
            "ANSWER: B\n"
            "EXPLANATION: Brief reason why B is correct.\n"
            "---\n\n"
            f"Generate all {num_questions} questions now:"
        )

        resp = await asyncio.to_thread(
            client.chat.completions.create,
            model=LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert exam creator. Generate clear, varied MCQ questions "
                        "on the given subject. Follow the output format exactly."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=2000,
            temperature=0.6,
        )

        raw = resp.choices[0].message.content.strip()
        questions = _parse_quiz_questions(raw)

        if not questions:
            raise HTTPException(status_code=500, detail="Failed to parse questions. Please try again.")

        return {"subject": subject, "questions": questions}

    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in /study-session/start: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/study-session/results")
@limiter.limit("10/minute")
async def study_session_results(
    request: Request,
    subject:       str           = Form(...),
    wrong_topics:  str           = Form("[]"),   # JSON list of question texts that were wrong
    user_id:       Optional[str] = Form(None),
    score:         int           = Form(0),
    total:         int           = Form(4),
    current_user: dict = Depends(get_current_user)
):
    """
    Records weaknesses from a completed study session and returns a summary + XP.
    """
    try:
        wrong_list = json.loads(wrong_topics)
        xp_earned = 0  # default — set inside the if block if user_id present

        if user_id:
            for q_text in wrong_list:
                record_weakness(user_id, subject, q_text)
            xp_earned = max(5, (score / max(total, 1)) * 50)
            add_xp(user_id, int(xp_earned))
            push_notification(
                user_id,
                f"📖 Study session on '{subject}' complete! Score: {score}/{total}. +{int(xp_earned)} XP",
                "success" if score >= total // 2 else "warning",
            )

        # Generate a short feedback summary
        summary_prompt = (
            f"A student just completed a {total}-question study session on '{subject}' "
            f"and scored {score}/{total}.\n"
            + (f"They got these questions wrong:\n" + "\n".join(f"- {q}" for q in wrong_list) if wrong_list else "They got everything correct!")
            + "\n\nWrite a 2-3 sentence encouraging summary and one actionable study tip. Be concise."
        )

        summary_resp = await asyncio.to_thread(
            client.chat.completions.create,
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are an encouraging academic tutor. Be brief and motivating."},
                {"role": "user", "content": summary_prompt},
            ],
            max_tokens=200,
            temperature=0.4,
        )

        return {
            "score": score,
            "total": total,
            "xp_earned": xp_earned,
            "summary": summary_resp.choices[0].message.content,
            "weaknesses_recorded": len(wrong_list),
        }

    except Exception as e:
        print(f"CRITICAL ERROR in /study-session/results: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/study-session/retry-weak")
@limiter.limit("10/minute")
async def study_session_retry_weak(
    request: Request,
    subject:                str           = Form(...),
    weak_topic_questions:   str           = Form("[]"),   # JSON list of questions user got wrong
    num_questions:          int           = Form(4),
    user_id:                Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate new questions focused on the topics the user struggled with.
    Topics are extracted from the wrong answers and used to create targeted practice.
    """
    # Log this retry call so the planner verify endpoint can confirm
    # revision tasks were actually done (not just opened and closed).
    effective_uid = current_user["user_id"]
    if effective_uid:
        if effective_uid not in _retry_log:
            _retry_log[effective_uid] = []
        _retry_log[effective_uid].append({
            "subject":   subject,
            "timestamp": datetime.utcnow().isoformat(),
        })
        # Keep only last 50 entries per user
        _retry_log[effective_uid] = _retry_log[effective_uid][-50:]

    try:
        weak_questions = json.loads(weak_topic_questions)
        
        # Extract key topics from weak questions
        topics_to_focus = ", ".join(weak_questions[:3]) if weak_questions else subject
        
        prompt = f"""Generate exactly {num_questions} multiple-choice quiz questions on these specific weak areas in '{subject}':
{topics_to_focus}

Make these questions SLIGHTLY EASIER (70-80% difficulty) to build confidence, focusing on the exact concepts they struggled with.

For EACH question, provide:
Q: <question text>
A) <option A>
B) <option B>
C) <option C>
D) <option D>
Answer: <correct letter>
Explanation: <brief 1-2 sentence explanation>
---

Return ONLY the formatted questions, no preamble."""

        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert educator creating targeted remedial quiz questions. Focus on the exact topics the student struggled with."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=2000,
            temperature=0.7,
        )
        
        response_text = response.choices[0].message.content
        questions = _parse_quiz_questions(response_text)
        
        if not questions:
            raise ValueError("Failed to parse questions from response")
        
        return {
            "subject": subject,
            "questions": questions[:num_questions],
            "num_questions": min(len(questions), num_questions),
            "retry_mode": True,
            "focus_areas": weak_questions[:3],
        }
    
    except Exception as e:
        print(f"CRITICAL ERROR in /study-session/retry-weak: {e}")
        raise HTTPException(status_code=500, detail=str(e))