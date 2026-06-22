"""
Email Service — sends verification emails via SMTP
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.core.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, APP_URL


def send_verification_email(to_email: str, name: str, token: str) -> bool:
    """Send verification email. Returns True on success."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"⚠️  Email not configured — skipping verification email for {to_email}")
        return False

    verify_url = f"{APP_URL}/verify-email?token={token}"

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#7c3aed">Welcome to ScholarlyAI, {name}!</h2>
      <p style="color:#52525b">Click the button below to verify your email address.</p>
      <a href="{verify_url}"
         style="display:inline-block;margin:24px 0;padding:12px 28px;
                background:#7c3aed;color:#fff;border-radius:12px;
                text-decoration:none;font-weight:600">
        Verify Email
      </a>
      <p style="color:#a1a1aa;font-size:12px">
        Or copy this link: {verify_url}<br><br>
        This link expires in 24 hours. If you didn't sign up, ignore this email.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your ScholarlyAI account"
    msg["From"]    = SMTP_USER
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"❌ Failed to send verification email: {e}")
        return False
    
def send_password_reset_email(to_email: str, name: str, token: str) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"⚠️  Email not configured — skipping password reset email for {to_email}")
        return False

    reset_url = f"{APP_URL}/reset-password?token={token}"

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#7c3aed">Reset your password, {name}</h2>
      <p style="color:#52525b">Click below to set a new password. This link expires in 1 hour.</p>
      <a href="{reset_url}"
         style="display:inline-block;margin:24px 0;padding:12px 28px;
                background:#7c3aed;color:#fff;border-radius:12px;
                text-decoration:none;font-weight:600">
        Reset Password
      </a>
      <p style="color:#a1a1aa;font-size:12px">
        Or copy this link: {reset_url}<br><br>
        If you didn't request this, ignore this email.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your ScholarlyAI password"
    msg["From"]    = SMTP_USER
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"❌ Failed to send reset email: {e}")
        return False
    
def _send_raw_email(to_email: str, name: str, subject: str, html_body: str) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"⚠️  Email not configured — skipping: {to_email}")
        return False
    from backend.core.config import APP_URL
    html_body = html_body.replace("$APP_URL", APP_URL)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = SMTP_USER
    msg["To"]      = to_email
    msg.attach(MIMEText(html_body, "html"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")
        return False