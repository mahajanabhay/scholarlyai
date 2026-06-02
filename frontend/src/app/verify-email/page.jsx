"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get("token");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found.");
      return;
    }
    fetch(`${API_URL}/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.status === "verified") {
          setStatus("success");
          setMessage(d.email);
          setTimeout(() => router.push("/"), 3000);
        } else {
          setStatus("error");
          setMessage(d.detail || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Request failed. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.07] rounded-2xl shadow-xl p-10 max-w-md w-full text-center space-y-4">

        {status === "verifying" && (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-sm font-semibold text-zinc-500">Verifying your email...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Email Verified!</h2>
            <p className="text-sm text-zinc-500">{message} is now verified.</p>
            <p className="text-xs text-zinc-400">Redirecting you to the app...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-4xl">❌</div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Verification Failed</h2>
            <p className="text-sm text-zinc-500">{message}</p>
            <ResendForm />
          </>
        )}

      </div>
    </div>
  );
}

function ResendForm() {
  const [email, setEmail]   = useState("");
  const [msg, setMsg]       = useState(null);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("email", email);
    try {
      const r = await fetch(`${API_URL}/auth/resend-verification`, { method: "POST", body: fd });
      const d = await r.json();
      setMsg({ ok: r.ok, text: d.status || d.detail });
    } catch {
      setMsg({ ok: false, text: "Request failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs text-zinc-400">Resend verification email</p>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/[0.07] text-zinc-800 dark:text-zinc-200 outline-none focus:border-violet-500/50"
      />
      {msg && <p className={`text-xs font-semibold ${msg.ok ? "text-green-500" : "text-red-400"}`}>{msg.text}</p>}
      <button
        onClick={resend}
        disabled={loading || !email}
        className="w-full py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-50"
      >
        {loading ? "Sending..." : "Resend Email"}
      </button>
    </div>
  );
}