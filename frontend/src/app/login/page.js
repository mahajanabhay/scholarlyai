"use client";
import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, LogIn } from 'lucide-react';
import Link from 'next/link';
import { loginUser } from "@/lib/api";

function ResendVerificationButton({ email }) {
  const [msg, setMsg]         = useState(null);
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
    <div className="space-y-1 pt-1">
      {msg && <p className={`text-xs font-semibold ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}
      <button
        type="button"
        onClick={resend}
        disabled={loading || !email}
        className="text-xs font-semibold text-violet-600 hover:text-violet-500 underline underline-offset-2 transition-all disabled:opacity-50"
      >
        {loading ? "Sending..." : "Resend verification email"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused]           = useState(null);

  const validate = () => {
    if (!email.trim())                              { setError('Email is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email'); return false; }
    if (!password)                                  { setError('Password is required'); return false; }
    if (password.length < 6)                        { setError('Password must be at least 6 characters'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await loginUser({ email, password });
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) => `
    flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200
    ${focused === field
      ? 'border-violet-500/60 bg-violet-500/5 dark:bg-violet-500/5 shadow-lg shadow-violet-900/10'
      : 'border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] hover:border-zinc-300 dark:hover:border-white/[0.12]'}
  `;

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] flex items-center justify-center px-4 relative overflow-hidden transition-colors">
      {/* Atmosphere — only visible in dark mode */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:block hidden">
        <div className="absolute top-[-20%] left-[10%] w-125 h-125 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-100 h-100 rounded-full bg-indigo-600/8 blur-[100px]" />
      </div>
      {/* Grid — dark only */}
      <div className="absolute inset-0 opacity-[0.03] dark:block hidden"
        style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-linear-to-br from-violet-600 to-indigo-700 shadow-2xl shadow-violet-900/30 mb-5">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight mb-1">ScholarlyAI</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">Sign in to continue learning</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-white/3 border border-zinc-200 dark:border-white/8 rounded-2xl p-8 shadow-xl dark:shadow-2xl backdrop-blur-sm">
          {error && (
              <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  {error.toLowerCase().includes("verify") && (
                    <ResendVerificationButton email={email} />
                  )}
                </div>
              </div>
            )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Email</label>
              <div className={inputClass('email')}>
                <Mail size={16} className={focused === 'email' ? 'text-violet-500' : 'text-zinc-400'} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                  placeholder="you@example.com" disabled={loading}
                  className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Password</label>
              <div className={inputClass('password')}>
                <Lock size={16} className={focused === 'password' ? 'text-violet-500' : 'text-zinc-400'} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                  placeholder="••••••••" disabled={loading}
                  className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none" />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all duration-200 shadow-lg shadow-violet-900/20 active:scale-[0.98] flex items-center justify-center gap-2">
              {loading
                ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <><LogIn size={15} /> Sign In</>}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-zinc-200 dark:bg-white/6" />
            <span className="text-xs text-zinc-400">New to ScholarlyAI?</span>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-white/6" />
          </div>

          <Link href="/signup">
            <button className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-white/8 hover:border-zinc-300 dark:hover:border-white/15 hover:bg-zinc-50 dark:hover:bg-white/4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all duration-200">
              Create an account
            </button>
          </Link>
        </div>
        <p className="text-center text-xs text-zinc-400 mt-6">By signing in you agree to our Terms of Service</p>
      </div>
    </div>
  );
}