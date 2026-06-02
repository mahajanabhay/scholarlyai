import psycopg2
from psycopg2 import pool, extensions
import os
import threading
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL Connection Configuration
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "5432")
DB_NAME     = os.getenv("DB_NAME", "scholarly_ai")
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not DB_PASSWORD:
    raise RuntimeError("DB_PASSWORD environment variable is not set. Refusing to start without a database password.")

# Thread-safe pool — SimpleConnectionPool is NOT thread-safe under concurrent requests
connection_pool = None
_pool_lock = threading.Lock()


def _adapt_list_to_pg_array(lst):
    """Convert a Python list to a PostgreSQL TEXT[] literal."""
    if not lst:
        return extensions.AsIs("ARRAY[]::TEXT[]")
    # adapt().getquoted() already returns b"'value'" with quotes included
    escaped = ", ".join(
        extensions.adapt(str(item)).getquoted().decode() for item in lst
    )
    return extensions.AsIs(f"ARRAY[{escaped}]::TEXT[]")


def _init_pool() -> None:
    """Create (or recreate) the connection pool. Safe to call more than once."""
    global connection_pool
    try:
        connection_pool = psycopg2.pool.ThreadedConnectionPool(
            1,   # min connections
            10,  # max connections
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
        )
        # Register adapter so Python lists are correctly passed as PostgreSQL
        # TEXT[] arrays. Without this psycopg2 passes lists as string literals,
        # causing type errors on any multi-item subject_focus array.
        extensions.register_adapter(list, _adapt_list_to_pg_array)
        print("✅ Database connection pool created successfully")
    except Exception as e:
        connection_pool = None
        print(f"❌ Failed to create connection pool: {e}")
        print("⚠️  Database operations will fail until PostgreSQL is reachable.")


# Attempt pool creation at import time — workers that start before PG is ready
# will retry lazily on the first request instead of staying broken forever.
_init_pool()


def get_connection():
    """Get a connection from the pool, retrying once if the pool is not up."""
    global connection_pool
    with _pool_lock:
        if connection_pool is None:
            print("⚠️  Pool not initialised — retrying connection...")
            _init_pool()
        if connection_pool is None:
            raise RuntimeError(
                "Database connection pool is not available. "
                "Check that PostgreSQL is running and credentials are correct."
            )
        return connection_pool.getconn()


def release_connection(conn) -> None:
    """Return a connection to the pool."""
    if connection_pool is not None and conn is not None:
        connection_pool.putconn(conn)

def init_db():
    """Initialize database tables"""
    if connection_pool is None:
        print("⚠️ Cannot initialize database: connection pool is not available")
        return

    conn = get_connection()
    try:
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            avatar TEXT DEFAULT '🎓',
            bio TEXT DEFAULT '',
            subject_focus TEXT[] DEFAULT '{}',
            is_verified BOOLEAN DEFAULT FALSE,
            verify_token TEXT,
            token_expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS weaknesses (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            count INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, topic)
        )
        """)

        # chat_sessions was missing from init_db entirely —
        # on a fresh deploy the table would never be created
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            mode TEXT DEFAULT 'LEARN',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        # user_streaks — persistent streak storage backed by PostgreSQL.
        # JSON backup is the fast path; this is the reliable fallback
        # that survives backup corruption, server migrations, and redeployments.
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_streaks (
            user_id          TEXT PRIMARY KEY,
            current          INTEGER   DEFAULT 0,
            longest          INTEGER   DEFAULT 0,
            last_active      DATE,
            freeze_used      BOOLEAN   DEFAULT FALSE,
            freeze_week      TEXT,
            recovered_today  BOOLEAN   DEFAULT FALSE,
            updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_streaks_last_active
            ON user_streaks (user_id, last_active)
        """)
        # 1. load_history()    → WHERE user_id = ? AND session_id = ? ORDER BY created_at
        # 2. get_user_sessions() → WHERE user_id = ? AND role = 'user'
        # Without these, every query does a full table scan — catastrophic at scale.
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_session
            ON chat_sessions (user_id, session_id, created_at ASC)
        """)

        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_role
            ON chat_sessions (user_id, role)
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS question_papers (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            subject TEXT,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """)

        conn.commit()
        print("✅ Database tables and indexes initialized successfully")
    except Exception as e:
        conn.rollback()
        print(f"⚠️ Error initializing database: {e}")
    finally:
        release_connection(conn)


def upsert_streak(user_id: str, streak: dict) -> None:
    """Write streak data to PostgreSQL. Called after every streak mutation."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_streaks
                (user_id, current, longest, last_active, freeze_used, freeze_week, recovered_today, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                current         = EXCLUDED.current,
                longest         = EXCLUDED.longest,
                last_active     = EXCLUDED.last_active,
                freeze_used     = EXCLUDED.freeze_used,
                freeze_week     = EXCLUDED.freeze_week,
                recovered_today = EXCLUDED.recovered_today,
                updated_at      = CURRENT_TIMESTAMP
        """, (
            user_id,
            streak.get("current", 0),
            streak.get("longest", 0),
            streak.get("last_active"),
            streak.get("freeze_used", False),
            streak.get("freeze_week"),
            streak.get("recovered_today", False),
        ))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"⚠️ Failed to upsert streak for {user_id}: {e}")
    finally:
        release_connection(conn)


def load_streak_from_db(user_id: str) -> dict | None:
    """Load streak from PostgreSQL. Returns None if not found."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT current, longest, last_active, freeze_used, freeze_week, recovered_today
            FROM user_streaks WHERE user_id = %s
        """, (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "current":         row[0],
            "longest":         row[1],
            "last_active":     row[2].isoformat() if row[2] else None,
            "freeze_used":     row[3],
            "freeze_week":     row[4],
            "recovered_today": row[5],
        }
    except Exception as e:
        print(f"⚠️ Failed to load streak for {user_id}: {e}")
        return None
    finally:
        release_connection(conn)

# ── XP ─────────────────────────────────────────────────────────────────────────

def upsert_xp(user_id: str, xp: dict) -> None:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_xp (user_id, total, level, updated_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                total      = EXCLUDED.total,
                level      = EXCLUDED.level,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, xp.get("total", 0), xp.get("level", 1)))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"⚠️ Failed to upsert XP for {user_id}: {e}")
    finally:
        release_connection(conn)


def load_xp_from_db(user_id: str) -> dict | None:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT total, level FROM user_xp WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()
        return {"total": row[0], "level": row[1]} if row else None
    except Exception as e:
        print(f"⚠️ Failed to load XP for {user_id}: {e}")
        return None
    finally:
        release_connection(conn)


# ── Weaknesses ─────────────────────────────────────────────────────────────────

def upsert_weaknesses(user_id: str, weaknesses: list) -> None:
    import json as _json
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_weaknesses (user_id, data, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                data       = EXCLUDED.data,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, _json.dumps(weaknesses)))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"⚠️ Failed to upsert weaknesses for {user_id}: {e}")
    finally:
        release_connection(conn)


def load_weaknesses_from_db(user_id: str) -> list | None:
    import json as _json
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM user_weaknesses WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()
        return _json.loads(row[0]) if row else None
    except Exception as e:
        print(f"⚠️ Failed to load weaknesses for {user_id}: {e}")
        return None
    finally:
        release_connection(conn)


# ── Planner ────────────────────────────────────────────────────────────────────

def upsert_planner(user_id: str, tasks: list) -> None:
    import json as _json
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_planners (user_id, data, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                data       = EXCLUDED.data,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, _json.dumps(tasks)))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"⚠️ Failed to upsert planner for {user_id}: {e}")
    finally:
        release_connection(conn)


def load_planner_from_db(user_id: str) -> list | None:
    import json as _json
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM user_planners WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()
        return _json.loads(row[0]) if row else None
    except Exception as e:
        print(f"⚠️ Failed to load planner for {user_id}: {e}")
        return None
    finally:
        release_connection(conn)


# ── Notifications ──────────────────────────────────────────────────────────────

def upsert_notifications(user_id: str, notifications: list) -> None:
    import json as _json
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_notifications (user_id, data, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                data       = EXCLUDED.data,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, _json.dumps(notifications)))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"⚠️ Failed to upsert notifications for {user_id}: {e}")
    finally:
        release_connection(conn)


def load_notifications_from_db(user_id: str) -> list | None:
    import json as _json
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM user_notifications WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()
        return _json.loads(row[0]) if row else None
    except Exception as e:
        print(f"⚠️ Failed to load notifications for {user_id}: {e}")
        return None
    finally:
        release_connection(conn)