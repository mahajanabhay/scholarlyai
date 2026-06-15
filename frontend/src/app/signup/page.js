"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Extract referral code from URL
const getReferralCode = () => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("ref") || "";
};

export default function SignupPage() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("email", email);
    fd.append("password", password);
    try {
      const refCode = getReferralCode();
      const url = refCode ? `${API_URL}/auth/register?ref=${refCode}` : `${API_URL}/auth/register`;
      const r = await fetch(url, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setError(d.detail || "Registration failed."); return; }
      setSuccess(true);
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setLoading(false);
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
          Have an account?{" "}<Link href="/login" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
        </span>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📬</div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.75rem" }}>Check your inbox.</h2>
              <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: "0 0 2rem" }}>
                We've sent a verification email to <strong style={{ color: "#e8e8f0" }}>{email}</strong>. Click the link to activate your account.
              </p>
              <button onClick={() => router.push("/login")} style={btnStyle}>Go to sign in →</button>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.4rem" }}>Start studying.</h1>
              <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.35)", margin: "0 0 2.5rem" }}>Create your free Clarix account.</p>

              <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", display: "block", marginBottom: "0.4rem" }}>FULL NAME</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Alex Johnson" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", display: "block", marginBottom: "0.4rem" }}>EMAIL</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", display: "block", marginBottom: "0.4rem" }}>PASSWORD</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", display: "block", marginBottom: "0.4rem" }}>CONFIRM PASSWORD</label>
                  <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" style={inputStyle} />
                </div>

                {error && (
                  <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", padding: "0.75rem 1rem" }}>
                    <p style={{ fontSize: "0.85rem", color: "#f87171", margin: 0 }}>{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} style={{ ...btnStyle, marginTop: "0.5rem" }}>{loading ? "Creating account..." : "Create account →"}</button>
              </form>

              <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: "2.5rem" }}>
                By signing up you agree to our <Link href="#" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Terms</Link> and <Link href="#" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}