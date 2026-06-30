import json
from datetime import date, datetime, timezone
from backend.core.cache import get as cache_get, set as cache_set, delete as cache_delete

from backend.db import (
    get_connection, release_connection,
    upsert_streak, load_streak_from_db,
    upsert_xp, load_xp_from_db,
    upsert_weaknesses, load_weaknesses_from_db,
    upsert_planner, load_planner_from_db,
    upsert_notifications, load_notifications_from_db,
)

# ── In-memory caches (write-through to DB) ───────────────────────────────────
# These are L1 caches only. Every mutation writes to Postgres immediately.
# On startup, data is loaded from DB on first access (lazy), not bulk-restored
# from JSON. The backup_service JSON is now a last-resort fallback only.

import threading
_profiles:      dict[str, dict] = {}
_streaks:       dict[str, dict] = {}
_xp:            dict[str, dict] = {}
_weaknesses:    dict[str, list] = {}
_planners:      dict[str, list] = {}
_notifications: dict[str, list] = {}

_profiles_lock      = threading.Lock()
_streaks_lock       = threading.Lock()
_xp_lock            = threading.Lock()
_weaknesses_lock    = threading.Lock()
_planners_lock      = threading.Lock()
_notifications_lock = threading.Lock()


# ── Profiles ──────────────────────────────────────────────────────────────────

def get_profile(user_id: str) -> dict:
    cached = cache_get(f"profile:{user_id}")
    if cached:
        _profiles[user_id] = cached
        return cached
    if user_id not in _profiles:
        try:
            conn = get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT name, avatar, bio, subject_focus, onboarding_complete FROM users WHERE id = %s",
                    (user_id,)
                )
                row = cursor.fetchone()
                if row:
                    _profiles[user_id] = {
                        "name":                row[0] or "Scholar",
                        "avatar":              row[1] or "🎓",
                        "bio":                 row[2] or "",
                        "subject_focus":       row[3] if isinstance(row[3], list) else [],
                        "onboarding_complete": bool(row[4]),
                        "joined":              date.today().isoformat(),
                    }
                else:
                    raise ValueError("User not found")
            finally:
                release_connection(conn)
        except Exception:
            _profiles[user_id] = {
                "name": "Scholar",
                "avatar": "🎓",
                "bio": "",
                "subject_focus": [],
                "onboarding_complete": False,
                "joined": date.today().isoformat(),
            }
    cache_set(f"profile:{user_id}", _profiles[user_id])
    return _profiles[user_id]


# ── Streaks ───────────────────────────────────────────────────────────────────

def get_streak(user_id: str) -> dict:
    cached = cache_get(f"streak:{user_id}")
    if cached:
        _streaks[user_id] = cached
        return cached
    if user_id not in _streaks:
        try:
            db_streak = load_streak_from_db(user_id)
            if db_streak:
                _streaks[user_id] = db_streak
                cache_set(f"streak:{user_id}", db_streak)
                return _streaks[user_id]
        except Exception as e:
            print(f"⚠️ [streak] DB load failed for {user_id}: {e}")
        _streaks[user_id] = {
            "current": 0, "longest": 0, "last_active": None,
            "freeze_used": False, "freeze_week": None, "recovered_today": False,
        }
    else:
        s = _streaks[user_id]
        s.setdefault("freeze_used", False)
        s.setdefault("freeze_week", None)
        s.setdefault("recovered_today", False)
    cache_set(f"streak:{user_id}", _streaks[user_id])
    return _streaks[user_id]


def _current_iso_week(date_str: str) -> str:
    from datetime import date as dt
    d = dt.fromisoformat(date_str)
    return f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"


def use_streak_freeze(user_id: str) -> dict | None:
    """
    Manually consume an available freeze to protect a streak at risk of
    breaking. Returns None if no freeze is available, the streak is already
    active today (no risk), or it's been more than 2 days (too late to save).
    """
    from datetime import date as dt, timedelta
    today = datetime.now(timezone.utc).date().isoformat()

    with _streaks_lock:
        streak = get_streak(user_id)
        last   = streak["last_active"]

        if last == today:
            return None  # streak already active today — nothing to protect

        yesterday    = (dt.fromisoformat(today) - timedelta(days=1)).isoformat()
        two_days_ago = (dt.fromisoformat(today) - timedelta(days=2)).isoformat()
        this_week    = _current_iso_week(today)

        if streak["freeze_week"] != this_week:
            streak["freeze_used"] = False

        if streak["freeze_used"]:
            return None  # already used this week
        if last not in (yesterday, two_days_ago):
            return None  # too far gone — freeze can't save it

        streak["current"]        += 1
        streak["freeze_used"]     = True
        streak["freeze_week"]     = this_week
        streak["recovered_today"] = True
        streak["last_active"]     = today
        streak["longest"]         = max(streak["longest"], streak["current"])

    try:
        upsert_streak(user_id, streak)
        cache_set(f"streak:{user_id}", streak)
    except Exception as e:
        print(f"⚠️ [streak] DB upsert failed for {user_id}: {e}")

    return streak


def touch_streak(user_id: str, client_date: str | None = None):
    from datetime import date as dt, timedelta
    today = datetime.now(timezone.utc).date().isoformat()

    with _streaks_lock:
        streak = get_streak(user_id)
        last   = streak["last_active"]

        if last == today:
            streak["recovered_today"] = False
            return

        streak["recovered_today"] = False
        yesterday    = (dt.fromisoformat(today) - timedelta(days=1)).isoformat()
        two_days_ago = (dt.fromisoformat(today) - timedelta(days=2)).isoformat()
        this_week    = _current_iso_week(today)

        if streak["freeze_week"] != this_week:
            streak["freeze_used"] = False

        if last == yesterday:
            streak["current"] += 1
        else:
            # Two-day gap is no longer auto-saved — user must manually
            # consume a freeze via /streak/{user_id}/use-freeze before
            # this point, or the streak resets.
            streak["current"] = 1

        streak["longest"]     = max(streak["longest"], streak["current"])
        streak["last_active"] = today
        current = streak["current"]

    try:
        upsert_streak(user_id, streak)
        cache_set(f"streak:{user_id}", streak)
    except Exception as e:
        print(f"⚠️ [streak] DB upsert failed for {user_id}: {e}")

    MILESTONES = {
        3:   ("🔥 3-Day Streak!",   "You're on a roll! Keep it up.",                  25),
        7:   ("🔥 7-Day Streak!",   "One full week! You're building a habit.",         50),
        14:  ("⚡ 2-Week Streak!",  "Two weeks strong! You're unstoppable.",           75),
        30:  ("🏆 30-Day Streak!",  "A whole month! You're a true scholar.",          150),
        60:  ("🌟 60-Day Streak!",  "60 days! Your dedication is extraordinary.",     250),
        100: ("👑 100-Day Streak!", "100 days! You've achieved something remarkable.", 500),
        365: ("🎓 365-Day Streak!", "A full year of learning. Legendary status.",    1000),
    }
    if current in MILESTONES:
        title, message, bonus_xp = MILESTONES[current]
        push_notification(user_id, f"{title} {message} +{bonus_xp} bonus XP 🎁", "milestone")
        add_xp(user_id, bonus_xp)


# ── XP ────────────────────────────────────────────────────────────────────────

def get_xp(user_id: str) -> dict:
    cached = cache_get(f"xp:{user_id}")
    if cached:
        _xp[user_id] = cached
        return cached
    if user_id not in _xp:
        db_xp = None
        try:
            db_xp = load_xp_from_db(user_id)
        except Exception as e:
            print(f"⚠️ [xp] DB load failed for {user_id}: {e}")
        _xp[user_id] = db_xp if db_xp else {"total": 0, "level": 1}
    cache_set(f"xp:{user_id}", _xp[user_id])
    return _xp[user_id]


def add_xp(user_id: str, amount: int):
    with _xp_lock:
        xp = get_xp(user_id)
        xp["total"] += amount
        xp["level"]  = 1 + xp["total"] // 500
    try:
        upsert_xp(user_id, xp)
        cache_set(f"xp:{user_id}", xp)
    except Exception as e:
        print(f"⚠️ [xp] DB upsert failed for {user_id}: {e}")


# ── Weaknesses ────────────────────────────────────────────────────────────────
def get_weaknesses(user_id: str) -> list:
    cached = cache_get(f"weaknesses:{user_id}")
    if cached:
        _weaknesses[user_id] = cached
        return cached
    if user_id not in _weaknesses:
        db_w = None
        try:
            db_w = load_weaknesses_from_db(user_id)
        except Exception as e:
            print(f"⚠️ [weaknesses] DB load failed for {user_id}: {e}")
        _weaknesses[user_id] = db_w if db_w is not None else []
    cache_set(f"weaknesses:{user_id}", _weaknesses[user_id])
    return _weaknesses[user_id]


def record_weakness(user_id: str, topic: str, question: str):
    with _weaknesses_lock:
        ws = get_weaknesses(user_id)
        ws.append({
            "topic":       topic,
            "question":    question[:200],
            "timestamp":   datetime.now(timezone.utc).isoformat(),
            "retry_count": 0,
        })
        _weaknesses[user_id] = ws[-50:]
    try:
        upsert_weaknesses(user_id, _weaknesses[user_id])
        cache_delete(f"weaknesses:{user_id}")  # invalidate Redis cache
    except Exception as e:
        print(f"⚠️ [weaknesses] DB upsert failed for {user_id}: {e}")


def clear_weakness(user_id: str, topic: str | None = None):
    with _weaknesses_lock:
        # Always reload from DB — never trust stale cache for destructive ops
        db_ws = load_weaknesses_from_db(user_id) or []
        _weaknesses[user_id] = [w for w in db_ws if w["topic"] != topic] if topic else []
    try:
        upsert_weaknesses(user_id, _weaknesses[user_id])
        cache_delete(f"weaknesses:{user_id}")  # invalidate Redis cache
    except Exception as e:
        print(f"⚠️ [weaknesses] DB upsert failed for {user_id}: {e}")


# ── Planner ───────────────────────────────────────────────────────────────────

def get_planner(user_id: str) -> list:
    if user_id not in _planners:
        db_p = None
        try:
            db_p = load_planner_from_db(user_id)
        except Exception as e:
            print(f"⚠️ [planner] DB load failed for {user_id}: {e}")
        _planners[user_id] = db_p if db_p is not None else []
    return _planners[user_id]


def add_task(user_id: str, task: dict):
    with _planners_lock:
        # Always reload from DB to get authoritative list
        from backend.db import load_planner_from_db
        db_tasks = load_planner_from_db(user_id) or []
        db_tasks.append(task)
        _planners[user_id] = db_tasks
    try:
        upsert_planner(user_id, db_tasks)
    except Exception as e:
        print(f"⚠️ [planner] DB upsert failed for {user_id}: {e}")


def toggle_task(user_id: str, task_id: int) -> dict | None:
    with _planners_lock:
        db_tasks = load_planner_from_db(user_id) or []
        _planners[user_id] = db_tasks
        for task in _planners[user_id]:
            if task["id"] == task_id:
                task["done"] = not task["done"]
                try:
                    upsert_planner(user_id, _planners[user_id])
                except Exception as e:
                    print(f"⚠️ [planner] DB upsert failed for {user_id}: {e}")
                return task
    return None

def delete_task(user_id: str, task_id: int):
    with _planners_lock:
        db_tasks = load_planner_from_db(user_id) or []
        tasks = [t for t in db_tasks if t["id"] != task_id]
        _planners[user_id] = tasks
    try:
        upsert_planner(user_id, tasks)
    except Exception as e:
        print(f"⚠️ [planner] DB upsert failed for {user_id}: {e}")

# ── Notifications ─────────────────────────────────────────────────────────────

def get_notifications(user_id: str) -> list:
    if user_id not in _notifications:
        db_n = None
        try:
            db_n = load_notifications_from_db(user_id)
        except Exception as e:
            print(f"⚠️ [notifications] DB load failed for {user_id}: {e}")
        _notifications[user_id] = db_n if db_n is not None else []
    return _notifications[user_id]


MAX_NOTIFICATIONS = 50

def push_notification(user_id: str, message: str, notif_type: str = "info"):
    with _notifications_lock:
        ns = get_notifications(user_id)
        ns.append({
            "message":   message,
            "type":      notif_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read":      False,
        })
        _notifications[user_id] = ns[-MAX_NOTIFICATIONS:]
    try:
        upsert_notifications(user_id, _notifications[user_id])
    except Exception as e:
        print(f"⚠️ [notifications] DB upsert failed for {user_id}: {e}")


def mark_notifications_read(user_id: str):
    with _notifications_lock:
        for n in get_notifications(user_id):
            n["read"] = True
    try:
        upsert_notifications(user_id, _notifications[user_id])
    except Exception as e:
        print(f"⚠️ [notifications] DB upsert failed for {user_id}: {e}")

