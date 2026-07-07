"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot]       = useState(false);
  const [forgotEmail, setForgotEmail]     = useState("");
  const [forgotMsg, setForgotMsg]         = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      setError(msg);
      if (msg.toLowerCase().includes("verify")) setForgotEmail(email);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setForgotLoading(true);
    setForgotMsg(null);
    const fd = new FormData();
    fd.append("email", forgotEmail);
    try {
      const r = await fetch(`${API_URL}/auth/forgot-password`, { method: "POST", body: fd });
      const d = await r.json();
      setForgotMsg({ ok: true, text: d.status || "Reset link sent." });
    } catch {
      setForgotMsg({ ok: false, text: "Request failed." });
    } finally {
      setForgotLoading(false);
    }
  };

  const inputStyle = { width: "100%", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8e8f0", fontSize: "0.95rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const btnStyle   = { width: "100%", padding: "0.85rem", borderRadius: "10px", border: "none", background: "#7c5cfc", color: "#fff", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif", background: "#0a0a0f", color: "#e8e8f0", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      <nav style={{ padding: "1.25rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/landing" style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.15rem", fontWeight: 800, color: "#fff", textDecoration: "none" }}>
          Clarix<span style={{ color: "#7c5cfc" }}>.</span>
        </Link>
        <span style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.35)" }}>
          No account?{" "}<Link href="/signup" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}>Sign up free</Link>
        </span>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.4rem" }}>Welcome back.</h1>
          <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.35)", margin: "0 0 2.5rem" }}>Sign in to continue studying.</p>

          {!showForgot ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", display: "block", marginBottom: "0.4rem" }}>EMAIL</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", display: "block", marginBottom: "0.4rem" }}>PASSWORD</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
              </div>
              <div style={{ textAlign: "right", marginTop: "-0.3rem" }}>
                <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Forgot password?</button>
              </div>
              {error && (
                <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "0.75rem 1rem" }}>
                  <p style={{ fontSize: "0.85rem", color: "#f87171", margin: 0 }}>{error}</p>
                  {error.toLowerCase().includes("verify") && (
                    <button type="button" onClick={async () => { const fd = new FormData(); fd.append("email", email); await fetch(`${API_URL}/auth/resend-verification`, { method: "POST", body: fd }); setError("Verification email resent."); }} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", padding: "0.4rem 0 0", display: "block" }}>Resend verification email →</button>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading} style={{ ...btnStyle, marginTop: "0.5rem" }}>{loading ? "Signing in..." : "Sign in →"}</button>
            </form>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", margin: 0 }}>Enter your email and we'll send a reset link.</p>
              <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
              {forgotMsg && <p style={{ fontSize: "0.85rem", color: forgotMsg.ok ? "#4ade80" : "#f87171", margin: 0 }}>{forgotMsg.text}</p>}
              <button onClick={handleForgot} disabled={forgotLoading || !forgotEmail} style={btnStyle}>{forgotLoading ? "Sending..." : "Send reset link →"}</button>
              <button onClick={() => setShowForgot(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>← Back to sign in</button>
            </div>
          )}

          <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: "2.5rem" }}>
            By signing in you agree to our <Link href="#" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Terms</Link> and <Link href="#" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}