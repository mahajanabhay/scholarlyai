"""baseline schema

Revision ID: 0001
Revises:
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
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
        reset_token TEXT,
        reset_token_expires_at TIMESTAMP,
        is_admin BOOLEAN DEFAULT FALSE,
        onboarding_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS weaknesses (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, topic)
    )
    """)

    op.execute("""
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

    op.execute("""
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
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_streaks_last_active ON user_streaks (user_id, last_active)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_session ON chat_sessions (user_id, session_id, created_at ASC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_role ON chat_sessions (user_id, role)")

    op.execute("""
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

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_xp (
        user_id    TEXT PRIMARY KEY,
        total      INTEGER DEFAULT 0,
        level      INTEGER DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_weaknesses (
        user_id    TEXT PRIMARY KEY,
        data       TEXT DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_planners (
        user_id    TEXT PRIMARY KEY,
        data       TEXT DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT,
        action     TEXT NOT NULL,
        detail     TEXT,
        ip         TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id, created_at DESC)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS login_attempts (
        id         SERIAL PRIMARY KEY,
        email      TEXT NOT NULL,
        ip         TEXT NOT NULL,
        success    BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts (email, created_at DESC)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_notifications (
        user_id    TEXT PRIMARY KEY,
        data       TEXT DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS user_progress (
        id                 SERIAL PRIMARY KEY,
        user_id            TEXT NOT NULL,
        date               DATE NOT NULL DEFAULT CURRENT_DATE,
        weaknesses_cleared INTEGER DEFAULT 0,
        quizzes_passed     INTEGER DEFAULT 0,
        xp_earned          INTEGER DEFAULT 0,
        study_minutes      INTEGER DEFAULT 0,
        UNIQUE (user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS usage_limits (
        user_id    TEXT PRIMARY KEY,
        date       DATE NOT NULL DEFAULT CURRENT_DATE,
        chat_count INTEGER DEFAULT 0,
        quiz_count INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_usage_limits_user_date ON usage_limits (user_id, date)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS referrals (
        id            SERIAL PRIMARY KEY,
        referrer_id   TEXT NOT NULL,
        referred_id   TEXT,
        code          TEXT UNIQUE NOT NULL,
        used          BOOLEAN DEFAULT FALSE,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at       TIMESTAMP,
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS retry_log (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        subject    TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_retry_log_user_created ON retry_log (user_id, created_at DESC)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS retry_log, referrals, usage_limits, user_progress, user_notifications, login_attempts, audit_log, user_planners, user_weaknesses, user_xp, question_papers, user_streaks, chat_sessions, weaknesses, users CASCADE")