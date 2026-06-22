import os

import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    dbname="scholarly_ai",
    user="scholarly_user",
    password=os.environ.get("DB_PASSWORD")
)
conn.autocommit = True
cur = conn.cursor()

cur.execute("""
ALTER TABLE user_xp ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_weaknesses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_planners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
""")

print("✅ Columns added")
conn.close()