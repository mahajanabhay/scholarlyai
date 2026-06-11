import asyncio
import re

# Logs retry-weak calls per user so the verify endpoint can confirm
# revision tasks were actually completed via the Weakness Tracker.
_retry_log: dict = {}
from datetime import datetime
import json
from typing import Optional

from fastapi import APIRouter, Form, Depends, HTTPException
from backend.core.jwt_auth import get_current_user
from backend.core.llm import client, LLM_MODEL
from backend.services.memory_service import (
    add_xp, add_task, clear_weakness, delete_task, toggle_task,
    get_notifications, get_planner, get_profile, get_streak,
    get_weaknesses, get_xp, mark_notifications_read,
    push_notification, touch_streak,
)
from backend.services.vector_service import get_vector_db

router = APIRouter()


@router.get("/profile/{user_id}")
async def get_profile_endpoint(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    return get_profile(user_id)


@router.post("/profile/{user_id}")
async def update_profile_endpoint(
    user_id: str,
    name:          Optional[str] = Form(None),
    avatar:        Optional[str] = Form(None),
    bio:           Optional[str] = Form(None),
    subject_focus: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    profile = get_profile(user_id)
    if name is not None:
        profile["name"] = name
    if avatar is not None:
        profile["avatar"] = avatar
    if bio is not None:
        profile["bio"] = bio
    if subject_focus is not None:
        try:
            profile["subject_focus"] = json.loads(subject_focus)
        except Exception:
            pass

    # Persist to DB
    from backend.db import get_connection, release_connection
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE users SET name = %s, avatar = %s, bio = %s, subject_focus = %s
               WHERE id = %s""",
            (
                profile.get("name"),
                profile.get("avatar"),
                profile.get("bio"),
                profile.get("subject_focus", []),
                user_id,
            )
        )
        conn.commit()
    finally:
        release_connection(conn)

    return profile


# ── Weakness Tracking ─────────────────────────
@router.get("/weaknesses/{user_id}")
async def get_weaknesses_endpoint(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    return {"weaknesses": get_weaknesses(user_id)}

@router.post("/weaknesses/{user_id}/clear")
async def clear_weakness_endpoint(user_id: str, topic: Optional[str] = Form(None), current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    clear_weakness(user_id, topic)
    return {"status": "cleared"}


# ── Streak System ─────────────────────────────
@router.get("/streak/{user_id}")
async def get_streak_endpoint(user_id: str, current_user: dict = Depends(get_current_user)):
    return get_streak(current_user["user_id"])

@router.post("/streak/{user_id}/touch")
async def touch_streak_endpoint(
    user_id:     str,
    current_user: dict = Depends(get_current_user)
):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    uid = current_user["user_id"]
    touch_streak(uid)
    streak = get_streak(uid)

    MILESTONE_META = {
        3:   {"emoji": "🔥", "title": "3-Day Streak!",   "message": "You're on a roll!",                     "xp": 25},
        7:   {"emoji": "🔥", "title": "7-Day Streak!",   "message": "One full week of learning!",            "xp": 50},
        14:  {"emoji": "⚡", "title": "2-Week Streak!",  "message": "Two weeks strong!",                     "xp": 75},
        30:  {"emoji": "🏆", "title": "30-Day Streak!",  "message": "A whole month of dedication!",         "xp": 150},
        60:  {"emoji": "🌟", "title": "60-Day Streak!",  "message": "Your commitment is extraordinary!",    "xp": 250},
        100: {"emoji": "👑", "title": "100-Day Streak!", "message": "You've achieved something remarkable!", "xp": 500},
        365: {"emoji": "🎓", "title": "365-Day Streak!", "message": "A full year. Legendary status.",       "xp": 1000},
    }

    from datetime import date
    milestone = MILESTONE_META.get(streak["current"]) if streak.get("last_active") == date.today().isoformat() else None

    return {**streak, "milestone": milestone}


# ── XP / Level System ─────────────────────────
@router.get("/xp/{user_id}")
async def get_xp_endpoint(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    return get_xp(current_user["user_id"])

LEVEL_REWARDS = {
    2:  "🦉 Night Owl avatar unlocked",
    3:  "🚀 Rocket avatar unlocked",
    5:  "🧠 Brain avatar unlocked",
    7:  "⚡ Lightning avatar unlocked",
    10: "🔬 Scientist avatar unlocked",
    15: "🎯 Bullseye avatar unlocked",
    20: "💡 Genius avatar unlocked",
    25: "🏆 Champion avatar unlocked",
    50: "🌟 Legend avatar unlocked",
}

# NEW — replace with this
XP_REWARDS = {
    "message_sent":    5,
    "quiz_correct":   15,
    "quiz_perfect":   50,
    "task_complete":  20,
    "streak_touch":   10,
    "session_start":   5,
}

@router.post("/xp/{user_id}/add")
async def add_xp_endpoint(
    user_id: str,
    action: str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    amount = XP_REWARDS.get(action)
    if amount is None:
        raise HTTPException(status_code=400, detail=f"Unknown action '{action}'. Valid: {list(XP_REWARDS)}")
    uid = current_user["user_id"]
    prev_level = get_xp(uid).get("level", 1)
    add_xp(uid, amount)
    xp = get_xp(uid)
    new_level = xp.get("level", 1)
    if new_level > prev_level:
        reward = LEVEL_REWARDS.get(new_level)
        msg = f"🎉 Level {new_level} reached!" + (f" {reward}" if reward else "")
        push_notification(uid, msg, "milestone")
        xp["level_up"] = True
        xp["reward"]   = reward
    else:
        xp["level_up"] = False
        xp["reward"]   = None
    return xp


# ── Daily Planner ─────────────────────────────
@router.get("/planner/{user_id}")
async def get_planner_endpoint(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    return {"tasks": get_planner(user_id)}

@router.post("/planner/{user_id}/add")
async def add_task_endpoint(
    user_id: str,
    title:    str           = Form(...),
    subject:  str           = Form("General"),
    due_time: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    task = {
        "id": int(datetime.utcnow().timestamp() * 1000),
        "title": title,
        "subject": subject,
        "due_time": due_time,
        "done": False,
        "created": datetime.utcnow().isoformat(),
    }
    add_task(user_id, task)
    return {"task": task}

@router.post("/planner/{user_id}/toggle/{task_id}")
async def toggle_task_endpoint(user_id: str, task_id: int, current_user: dict = Depends(get_current_user)):
    task = toggle_task(user_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["done"]:
        add_xp(user_id, 20)
        push_notification(user_id, f"✅ Task '{task['title']}' completed! +20 XP", "success")
    return {"task": task, "xp": get_xp(user_id)}

@router.post("/planner/{user_id}/delete/{task_id}")
async def delete_task_endpoint(user_id: str, task_id: int, current_user: dict = Depends(get_current_user)):
    delete_task(user_id, task_id)
    return {"status": "deleted"}


@router.post("/planner/{user_id}/verify/{task_id}")
async def verify_task_endpoint(
    user_id:      str,
    task_id:      int,
    task_type:    str           = Form(...),   # 'study' | 'quiz' | 'revision' | 'general'
    task_title:   str           = Form(...),
    task_created: Optional[str] = Form(None),  # ISO timestamp of task creation
    proof:        str           = Form(""),    # only used for 'general' type
    current_user: dict = Depends(get_current_user),
):
    """
    Evidence-based verification — the bot checks its OWN logs, not user claims.

    study:    Postgres chat_sessions — >= 3 user messages after task creation
    quiz:     Notifications log — completed session with score >= 60% found
    revision: _retry_log — retry-weak was called for this subject after task creation
    general:  AI evaluates a brief description (minimal — last resort only)
    """
    uid = current_user["user_id"]
    if uid != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    task_created_dt = None
    if task_created:
        try:
            task_created_dt = datetime.fromisoformat(task_created)
        except Exception:
            pass

    verified = False
    feedback = ""
    xp_data  = None

    try:
        # ── STUDY: real chat activity check ─────────────────────────────────
        if task_type == "study":
            from backend.db import get_connection, release_connection
            conn = get_connection()
            try:
                cursor = conn.cursor()
                if task_created_dt:
                    cursor.execute(
                        """
                        SELECT COUNT(*) FROM chat_sessions
                        WHERE user_id = %s AND role = 'user'
                          AND created_at > %s
                        """,
                        (uid, task_created_dt),
                    )
                else:
                    cursor.execute(
                        """
                        SELECT COUNT(*) FROM chat_sessions
                        WHERE user_id = %s AND role = 'user'
                          AND created_at > NOW() - INTERVAL '24 hours'
                        """,
                        (uid,),
                    )
                msg_count = cursor.fetchone()[0]
            finally:
                release_connection(conn)

            if msg_count >= 3:
                verified = True
                feedback = (
                    f"Verified! The bot can see you had an active study conversation "
                    f"({msg_count} messages) after this task was created. Keep that momentum!"
                )
            else:
                feedback = (
                    f"Not verified yet. The bot can only see {msg_count} message(s) from you "
                    f"since this task was created. Open the chat, pick a session, and have a real "
                    f"conversation about this topic — ask questions, get explanations, test yourself. "
                    f"The bot will detect it automatically."
                )

        # ── QUIZ: notification log check ─────────────────────────────────────
        elif task_type == "quiz":
            from backend.services.memory_service import get_notifications
            notifications = get_notifications(uid)
            subject_words = [w for w in task_title.replace("📖","").replace("🧠","").replace("🔁","").split() if len(w) > 3][:3]

            verified = False
            low_score_found = False

            for n in notifications:
                n_text = n.get("message", "").lower()
                n_time_str = n.get("created", n.get("timestamp", ""))

                # Must be a completion notification with a score
                is_completion = ("complete" in n_text or "score" in n_text) and "/" in n_text
                if not is_completion:
                    continue

                # Extract and check score
                score_match = re.search(r"(\d+)/(\d+)", n_text)
                if not score_match:
                    continue
                got, total = int(score_match.group(1)), int(score_match.group(2))
                pct = got / total if total > 0 else 0

                # Check timing
                time_ok = True
                if task_created_dt and n_time_str:
                    try:
                        n_time = datetime.fromisoformat(n_time_str)
                        time_ok = n_time > task_created_dt
                    except Exception:
                        pass

                if not time_ok:
                    continue

                if pct >= 0.6:
                    verified = True
                    feedback = (
                        f"Verified! The bot found your completed quiz with a score of {got}/{total} "
                        f"({int(pct*100)}%). Solid work — you earned this."
                    )
                    break
                else:
                    low_score_found = True

            if not verified:
                if low_score_found:
                    feedback = (
                        "Not verified. The bot found a quiz attempt but your score was below 60%. "
                        "Go back and take the quiz again — aim for at least 3/5. You can do it!"
                    )
                else:
                    feedback = (
                        "Not verified yet. The bot can't find a completed quiz for this subject. "
                        "Go to the Quiz section, take a quiz on this topic, and score at least 3/5. "
                        "The bot will detect it automatically the moment you finish."
                    )

        # ── REVISION: retry_log check ─────────────────────────────────────────
        elif task_type == "revision":
            entries = _retry_log.get(uid, [])
            subject_words = [w for w in task_title.replace("🔁","").split() if len(w) > 3][:3]

            matching = [
                e for e in entries
                if any(w.lower() in e.get("subject", "").lower() for w in subject_words)
                and (
                    not task_created_dt
                    or datetime.fromisoformat(e["timestamp"]) > task_created_dt
                )
            ]

            if matching:
                verified = True
                feedback = (
                    "Verified! The bot logged your practice session from the Weakness Tracker. "
                    "Targeting weak spots directly is the most effective revision strategy."
                )
            else:
                feedback = (
                    "Not verified yet. The bot hasn't logged a practice session for this revision task. "
                    "Open the Weakness Tracker, find a topic related to this subject, "
                    "and click 'Practice This Topic'. The bot logs it automatically when you start."
                )

        # ── GENERAL: minimal AI check ─────────────────────────────────────────
        else:
            if len(proof.strip()) < 40:
                return {
                    "verified": False,
                    "feedback": "Please describe what you actually did (at least 40 characters).",
                    "xp": None,
                }
            resp = await asyncio.to_thread(
                client.chat.completions.create,
                model=LLM_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Verify task completion for a study app. Output ONLY valid JSON: "
                            '{"verified": true|false, "feedback": "1-2 sentences"}. '
                            "Reject vague claims. Accept genuine descriptions of actual work."
                        ),
                    },
                    {"role": "user", "content": f"Task: {task_title}\nUser says: {proof.strip()}"},
                ],
                max_tokens=100,
                temperature=0.1,
                timeout=6.0,
            )
            raw = resp.choices[0].message.content.strip().replace("```json", "").replace("```", "")
            result = json.loads(raw)
            verified = result.get("verified", False)
            feedback = result.get("feedback", "")

        # ── Award XP only on verified ─────────────────────────────────────────
        if verified:
            task = toggle_task(uid, task_id)
            if task and task.get("done"):
                add_xp(uid, 20)
                push_notification(uid, f"\u2705 '{task['title']}' verified & completed! +20 XP", "success")
                xp_data = get_xp(uid)

        return {"verified": verified, "feedback": feedback, "xp": xp_data}

    except Exception as e:
        print(f"[verify] Error: {e}")
        raise HTTPException(status_code=500, detail="Verification failed. Please try again.")

@router.post("/planner/{user_id}/generate")
async def generate_daily_plan_endpoint(user_id: str, session_id: Optional[str] = Form(None), current_user: dict = Depends(get_current_user)):
    """
    AI-generates exactly 3 tasks for today:
      1. A topic to study
      2. A quiz task
      3. A revision task
    Uses the user's weak topics (if any) to personalise the plan.
    Returns the 3 newly created tasks.
    """
    weaknesses = get_weaknesses(user_id)
    weak_topics = list({w["topic"] for w in weaknesses[-5:]}) if weaknesses else []

    # Pull context from vector store if session provided
    context = ""
    if session_id:
        try:
            db = get_vector_db(session_id)
            query = " ".join(weak_topics) if weak_topics else "study topics"
            docs = db.similarity_search(query, k=3)
            context = "\n".join([doc.page_content for doc in docs])
        except Exception:
            pass

    weakness_hint = (
        f"The student's weak topics are: {', '.join(weak_topics)}. Prioritise these."
        if weak_topics else
        "No weak topics recorded yet. Choose a well-rounded academic topic."
    )

    prompt = (
        f"{weakness_hint}\n\n"
        f"Context from study material:\n{context}\n\n"
        "Generate exactly 3 study tasks for today. "
        "Respond ONLY with valid JSON — no markdown, no explanation — in this exact format:\n"
        '{"tasks": ['
        '{"title": "...", "subject": "...", "type": "study"},'
        '{"title": "...", "subject": "...", "type": "quiz"},'
        '{"title": "...", "subject": "...", "type": "revision"}'
        ']}\n\n'
        "Rules:\n"
        "- task 1 type must be 'study'   — a specific topic to learn today\n"
        "- task 2 type must be 'quiz'    — a quiz challenge on that topic\n"
        "- task 3 type must be 'revision'— a revision task on a weak area\n"
        "- title must be an actionable sentence (max 60 chars)\n"
        "- subject must be a short subject name (e.g. 'Physics', 'Maths')\n"
        "Output ONLY the JSON object."
    )

    resp = await asyncio.to_thread(
        client.chat.completions.create,
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a personalised academic coach. You output ONLY valid JSON, "
                    "no markdown fences, no extra text."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=400,
        temperature=0.5,
    )

    raw = resp.choices[0].message.content.strip()
    # Strip accidental markdown fences
    raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(raw)
        ai_tasks = parsed.get("tasks", [])
    except Exception:
        raise HTTPException(status_code=500, detail="AI returned invalid plan. Please try again.")

    TYPE_ICONS = {"study": "📖", "quiz": "🧠", "revision": "🔁"}
    created = []
    for i, t in enumerate(ai_tasks[:3]):
        icon = TYPE_ICONS.get(t.get("type", "study"), "📌")
        task = {
            "id": int(datetime.utcnow().timestamp() * 1000) + i,
            "title": f"{icon} {t.get('title', 'Study task')}",
            "subject": t.get("subject", "General"),
            "due_time": None,
            "done": False,
            "created": datetime.utcnow().isoformat(),
            "ai_generated": True,
        }
        add_task(user_id, task)
        created.append(task)

    push_notification(user_id, "📅 Today's plan is ready! 3 tasks generated by AI.", "info")
    return {"tasks": created}


# ── Smart Notifications ───────────────────────
@router.get("/notifications/{user_id}")
async def get_notifications_endpoint(user_id: str, current_user: dict = Depends(get_current_user)):
    return {"notifications": get_notifications(user_id)}

@router.post("/notifications/{user_id}/read")
async def mark_all_read_endpoint(user_id: str, current_user: dict = Depends(get_current_user)):
    mark_notifications_read(user_id)
    return {"status": "all_read"}

@router.post("/notifications/{user_id}/push")
async def push_notification_endpoint(
    user_id: str,
    message: str      = Form(...),
    notif_type: str   = Form("info"),
    current_user: dict = Depends(get_current_user)
):
    push_notification(user_id, message, notif_type)
    return {"status": "pushed"}


# ── Auto Revision ─────────────────────────────
@router.get("/revision/{user_id}")
async def get_revision_endpoint(user_id: str, session_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Returns AI-generated revision suggestions based on the user's weak topics.
    If session_id is provided, also uses the vector store for context.
    """
    weaknesses = get_weaknesses(user_id)
    if not weaknesses:
        return {"revision": "No weaknesses tracked yet. Keep taking quizzes to build your revision plan! 📚"}

    # Collect unique weak topics
    weak_topics = list({w["topic"] for w in weaknesses[-10:]})
    context = ""
    if session_id:
        try:
            db = get_vector_db(session_id)
            docs = db.similarity_search(" ".join(weak_topics), k=4)
            context = "\n".join([doc.page_content for doc in docs])
        except Exception:
            pass

    revision_prompt = (
        f"The student has shown weaknesses in the following topics: {', '.join(weak_topics)}\n\n"
        f"Context from their study material:\n{context}\n\n"
        "Create a concise, actionable revision plan:\n"
        "1. For each weak topic, give 2-3 key points to review.\n"
        "2. Suggest a 30-minute revision schedule.\n"
        "3. Recommend one practice question per topic.\n"
        "Keep it encouraging and practical."
    )

    revision_resp = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a supportive academic tutor creating personalised revision plans. Be concise and encouraging."
            },
            {"role": "user", "content": revision_prompt},
        ],
        max_tokens=1500,
        temperature=0.4,
    )

    return {"revision": revision_resp.choices[0].message.content, "weak_topics": weak_topics}

@router.get("/papers/{user_id}")
async def get_papers(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    from backend.db import get_connection, release_connection
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT session_id, subject, content, created_at
               FROM question_papers WHERE user_id = %s
               ORDER BY created_at DESC LIMIT 20""",
            (user_id,)
        )
        rows = cur.fetchall()
        return {"papers": [
            {"session_id": r[0], "subject": r[1], "content": r[2], "created_at": str(r[3])}
            for r in rows
        ]}
    finally:
        release_connection(conn)

@router.post("/auth/change-password")
async def change_password(
    current_password: str = Form(...),
    new_password:     str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    from backend.auth import verify_password, hash_password
    from backend.db import get_connection, release_connection
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (current_user["user_id"],))
        row = cur.fetchone()
        if not row or not verify_password(current_password, row[0]):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        if len(new_password) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hash_password(new_password), current_user["user_id"])
        )
        conn.commit()
        return {"status": "password updated"}
    finally:
        release_connection(conn)

@router.post("/profile/{user_id}/onboarding-complete")
async def mark_onboarding_complete(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access forbidden.")
    from backend.db import get_connection, release_connection
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET onboarding_complete = TRUE WHERE id = %s",
            (user_id,)
        )
        conn.commit()
        return {"status": "onboarding complete"}
    finally:
        release_connection(conn)