"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get("token");

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [msg, setMsg]             = useState(null);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  const submit = async () => {
    setMsg(null);
    if (!token)                       return setMsg({ ok: false, text: "Invalid reset link." });
    if (password.length < 8)          return setMsg({ ok: false, text: "Password must be at least 8 characters." });
    if (password !== confirm)         return setMsg({ ok: false, text: "Passwords do not match." });

    setLoading(true);
    const fd = new FormData();
    fd.append("token", token);
    fd.append("new_password", password);

    try {
      const r = await fetch(`${API_URL}/auth/reset-password`, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.detail || "Reset failed." }); return; }
      setDone(true);
      setTimeout(() => router.push("/"), 3000);
    } catch {
      setMsg({ ok: false, text: "Request failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.07] rounded-2xl shadow-xl p-10 max-w-md w-full space-y-5">

        {done ? (
          <div className="text-center space-y-3">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Password Reset!</h2>
            <p className="text-sm text-zinc-500">Redirecting you to the app...</p>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Set new password</h2>
              <p className="text-xs text-zinc-500 mt-1">Must be at least 8 characters.</p>
            </div>

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/[0.07] text-zinc-800 dark:text-zinc-200 outline-none focus:border-violet-500/50"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/[0.07] text-zinc-800 dark:text-zinc-200 outline-none focus:border-violet-500/50"
            />

            {msg && (
              <p className={`text-xs font-semibold ${msg.ok ? "text-green-500" : "text-red-400"}`}>
                {msg.text}
              </p>
            )}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-50"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </>
        )}

      </div>
    </div>
  );
}