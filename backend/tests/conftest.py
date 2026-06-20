import os

os.environ.setdefault("DB_PASSWORD", "testpassword")
os.environ.setdefault("GROQ_API_KEY", "test_groq_key")
os.environ.setdefault("JWT_SECRET", "test_jwt_secret")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("APP_URL", "http://localhost:3000")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")
os.environ.setdefault("SMTP_USER", "")
os.environ.setdefault("SMTP_PASSWORD", "")