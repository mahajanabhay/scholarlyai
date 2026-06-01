import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    dbname="scholarly_ai",
    user="scholarly_user",
    password="abhay7227"  # replace with your DB_PASSWORD from .env
)
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS user_xp (
    user_id    TEXT PRIMARY KEY,
    total      INTEGER NOT NULL DEFAULT 0,
    level      INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_weaknesses (
    user_id    TEXT PRIMARY KEY,
    data       JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_planners (
    user_id    TEXT PRIMARY KEY,
    data       JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_notifications (
    user_id    TEXT PRIMARY KEY,
    data       JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

print("✅ Migration complete — 4 tables created")
cur.execute("SELECT tablename FROM pg_tables WHERE tablename LIKE 'user_%';")
print("Tables:", [r[0] for r in cur.fetchall()])
conn.close()