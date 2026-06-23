"""
User Authentication and Storage Module
Handles login, registration, and user credential storage
"""
import bcrypt
import uuid
from datetime import datetime, timezone
from .db import get_connection, release_connection

# ─────────────────────────────────────────────
# USER STORAGE CONFIGURATION
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# USER MODEL
# ─────────────────────────────────────────────
class User:
    """User data model with credential storage"""
    def __init__(self, email: str, name: str, password_hash: str):
        self.email = email
        self.name = name
        self.password_hash = password_hash
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.avatar = "🎓"
        self.bio = ""
        self.subject_focus = []

    def to_dict(self):
        """Convert user to dictionary for JSON storage"""
        return {
            "email": self.email,
            "name": self.name,
            "password_hash": self.password_hash,
            "created_at": self.created_at,
            "avatar": self.avatar,
            "bio": self.bio,
            "subject_focus": self.subject_focus,
        }

    @staticmethod
    def from_dict(data):
        """Create user from dictionary"""
        user = User(data["email"], data["name"], data["password_hash"])
        user.created_at = data.get("created_at", datetime.utcnow().isoformat())
        user.avatar = data.get("avatar", "🎓")
        user.bio = data.get("bio", "")
        user.subject_focus = data.get("subject_focus", [])
        return user


# ─────────────────────────────────────────────
# PASSWORD HASHING
# ─────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


# ─────────────────────────────────────────────
# USER DATABASE OPERATIONS
# ─────────────────────────────────────────────
def save_user(user):
    """Save user to PostgreSQL database"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        user_id = f"user_{uuid.uuid4().hex[:12]}"

        cursor.execute("""
        INSERT INTO users (id, email, name, password_hash, avatar, bio, subject_focus)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, user.email, user.name, user.password_hash, user.avatar, user.bio, user.subject_focus))

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)

def get_user_by_email(email: str) -> User:
    """Get user by email, returns None if not found"""
    conn = get_connection()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id, email, name, password_hash, avatar, bio, subject_focus FROM users WHERE email = %s", (email,))
        row = cursor.fetchone()

        if row:
            user = User(row[1], row[2], row[3])
            user.avatar = row[4]
            user.bio = row[5]
            user.subject_focus = row[6] if row[6] else []
            return user
        return None
    finally:
        release_connection(conn)

def user_exists(email: str) -> bool:
    """Check if user exists by email"""
    conn = get_connection()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM users WHERE email = %s", (email,))
        row = cursor.fetchone()

        return row is not None
    finally:
        release_connection(conn)

def register_user(email: str, name: str, password: str) -> tuple[bool, str]:
    """
    Register a new user.
    Returns: (success: bool, message: str)
    """
    import secrets
    from backend.email_service import send_verification_email

    email = email.lower().strip()

    if not email or not name or not password:
        return False, "All fields are required"

    if len(password) < 8:
        return False, "Password must be at least 8 characters"

    if user_exists(email):
        return False, "User already exists with this email"

    try:
        password_hash = hash_password(password)
        user = User(email, name, password_hash)
        save_user(user)

        # Generate and store verify token
        token = secrets.token_urlsafe(32)
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE users SET verify_token = %s WHERE email = %s",
                (token, email)
            )
            conn.commit()
        finally:
            release_connection(conn)

        send_verification_email(email, name, token)
        return True, "Registration successful"
    except Exception as e:
        return False, f"Registration error: {str(e)}"
    
def check_email_verified(email: str) -> bool:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT is_verified FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        return bool(row and row[0])
    finally:
        release_connection(conn)

def authenticate_user(email: str, password: str) -> tuple[bool, str, User]:
    """
    Authenticate user with email and password.
    Returns: (success: bool, message: str, user: User or None)
    """
    email = email.lower().strip()
    
    user = get_user_by_email(email)
    if not user:
        return False, "User not found", None
    
    if not verify_password(password, user.password_hash):
            return False, "Invalid password", None

    if not check_email_verified(email):
            return False, "Please verify your email before logging in.", None
    
    return True, "Authentication successful", user


# ─────────────────────────────────────────────
# SESSION MANAGEMENT (reverse lookup only — via PostgreSQL)
# ─────────────────────────────────────────────

def get_user_id_from_email(email: str) -> str | None:
    email = email.lower().strip()
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        row = cursor.fetchone()
        return row[0] if row else None
    except Exception as e:
        print(f"⚠️ get_user_id_from_email error: {e}")
        return None
    finally:
        release_connection(conn)

def get_email_from_user_id(user_id: str) -> str | None:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        return row[0] if row else None
    except Exception as e:
        print(f"⚠️ get_email_from_user_id error: {e}")
        return None
    finally:
        release_connection(conn)