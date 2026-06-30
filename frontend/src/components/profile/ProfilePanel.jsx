"use client";
import { useState, useEffect } from 'react';
import { X, Pencil, Flame, Star, Lock, Check, ChevronRight, Zap, Trophy, Eye, EyeOff, Shield, AlertTriangle, Trash2, LogOut } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const AVATARS = [
  { emoji: '🎓', level: 1,  label: 'Scholar'   },
  { emoji: '📚', level: 1,  label: 'Bookworm'  },
  { emoji: '🦉', level: 2,  label: 'Night Owl' },
  { emoji: '🚀', level: 3,  label: 'Rocket'    },
  { emoji: '🧠', level: 5,  label: 'Brain'     },
  { emoji: '⚡', level: 7,  label: 'Lightning' },
  { emoji: '🔬', level: 10, label: 'Scientist' },
  { emoji: '🎯', level: 15, label: 'Bullseye'  },
  { emoji: '💡', level: 20, label: 'Genius'    },
  { emoji: '🏆', level: 25, label: 'Champion'  },
  { emoji: '🌟', level: 50, label: 'Legend'    },
];

export default function ProfilePanel({ userId, profileData: initialProfileData, onProfileUpdate, xpData, streakData, onClose, onLogout }) {
  const [profile, setProfile] = useState(initialProfileData || null);
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState('');
  const [bio, setBio]         = useState('');
  const [avatar, setAvatar]   = useState('🎓');
  const [saving, setSaving]   = useState(false);
  const [tab, setTab]         = useState('profile'); // 'profile' | 'security'
  const [showPwModal, setShowPwModal]       = useState(false);
  const [pwCurrent, setPwCurrent]           = useState('');
  const [pwNew, setPwNew]                   = useState('');
  const [showPwCurrent, setShowPwCurrent]   = useState(false);
  const [showPwNew, setShowPwNew]           = useState(false);
  const [pwMsg, setPwMsg]                   = useState(null);
  const [pwSaving, setPwSaving]             = useState(false);
  const [confirmLogout, setConfirmLogout]   = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);
  const [deleteText, setDeleteText]         = useState('');
  const [deleting, setDeleting]             = useState(false);

  const userLevel = xpData?.level || 1;
  const levelPct  = xpData ? Math.round(((xpData.total % 500) / 500) * 100) : 0;
  const xpInLevel = (xpData?.total || 0) % 500;
  const xpToNext  = 500 - xpInLevel;
  const nextAvatar = AVATARS.find(a => a.level > userLevel);

  useEffect(() => {
    if (initialProfileData) {
      setProfile(initialProfileData);
      setName(initialProfileData.name ?? '');
      setBio(initialProfileData.bio ?? '');
      setAvatar(initialProfileData.avatar ?? '🎓');
    }
  }, [initialProfileData]);

  useEffect(() => {
    if (initialProfileData || !userId || userId === 'guest_user') return;
    apiFetch(`${API_URL}/profile/${userId}`)
      .then(r => r.json())
      .then(d => { setProfile(d); setName(d.name ?? ''); setBio(d.bio ?? ''); setAvatar(d.avatar ?? '🎓'); })
      .catch(console.error);
  }, [userId, initialProfileData]);

  const save = async () => {
    setSaving(true);
    const fd = new FormData();
    fd.append('name', name); fd.append('bio', bio); fd.append('avatar', avatar);
    try {
      const r = await apiFetch(`${API_URL}/profile/${userId}`, { method: 'POST', body: fd });
      const d = await r.json();
      const updated = { ...profile, ...(d.user ?? d) };
      setProfile(updated);
      setName(updated.name ?? '');
      setBio(updated.bio ?? '');
      setAvatar(updated.avatar ?? '🎓');
      if (onProfileUpdate) onProfileUpdate(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setName(profile?.name ?? ''); setBio(profile?.bio ?? ''); setAvatar(profile?.avatar ?? '🎓');
    setEditing(false);
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (pwNew.length < 8) { setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' }); return; }
    setPwSaving(true);
    try {
      const fd = new FormData();
      fd.append('current_password', pwCurrent);
      fd.append('new_password', pwNew);
      const r = await apiFetch(`${API_URL}/auth/change-password`, { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) { setPwMsg({ ok: false, text: d.detail || 'Failed.' }); return; }
      setPwMsg({ ok: true, text: 'Password updated.' });
      setPwCurrent(''); setPwNew('');
      setTimeout(() => { setShowPwModal(false); setPwMsg(null); }, 1200);
    } catch {
      setPwMsg({ ok: false, text: 'Request failed.' });
    } finally {
      setPwSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteText !== 'DELETE') return;
    setDeleting(true);
    try {
      await apiFetch(`${API_URL}/profile/${userId}/delete-account`, { method: 'DELETE' });
      localStorage.clear();
      window.location.href = '/login';
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="relative w-full sm:w-[380px] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-[#111113]"
        onClick={e => e.stopPropagation()}
      >
        {/* Atmospheric glows */}
        <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none overflow-hidden">
          <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="absolute top-[-20px] left-[20%] w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl" />
        </div>

        {/* Subtle top drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.13] flex items-center justify-center text-zinc-500 hover:text-white transition-all"
        >
          <X size={15} />
        </button>

        {/* ── HERO ── */}
        <div className="px-6 pt-6 pb-5 text-center relative">
          {/* Avatar */}
          <div className="relative inline-block mb-4">
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-violet-500/40 to-indigo-600/30 blur-md scale-110" />
            <div className="relative w-[72px] h-[72px] rounded-[22px] bg-gradient-to-br from-violet-900/60 to-indigo-900/40 border border-violet-500/30 flex items-center justify-center text-4xl shadow-2xl">
              {profile?.avatar || '🎓'}
            </div>
            {/* Level pill — sits on bottom edge */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/50 border border-violet-400/20 whitespace-nowrap">
              <Zap size={9} className="text-amber-300" />
              <span className="text-[10px] font-black text-white tracking-wide">LEVEL {userLevel}</span>
            </div>
          </div>

          {!editing ? (
            <div className="mt-4">
              <h2 className="text-xl font-bold text-white tracking-tight">{profile?.name || 'Scholar'}</h2>
              <p className="text-xs text-zinc-500 mt-1.5 min-h-[1rem] leading-relaxed">{profile?.bio || 'No bio yet — tell the world about yourself'}</p>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors bg-violet-500/10 hover:bg-violet-500/15 px-3 py-1.5 rounded-full"
                >
                  <Pencil size={11} /> Edit Profile
                </button>
                <button
                  onClick={() => { setTab('security'); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-300 transition-colors bg-white/5 hover:bg-white/8 px-3 py-1.5 rounded-full"
                >
                  <Shield size={11} /> Security
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {/* Avatar picker */}
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5 text-left">Choose Avatar</p>
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.map(({ emoji, level, label }) => {
                    const unlocked = userLevel >= level;
                    const selected = avatar === emoji && unlocked;
                    return (
                      <button
                        key={emoji + level}
                        onClick={() => unlocked && setAvatar(emoji)}
                        disabled={!unlocked}
                        title={unlocked ? label : `Unlocks at Level ${level}`}
                        className={`relative flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all duration-150 ${
                          !unlocked
                            ? 'opacity-20 cursor-not-allowed'
                            : selected
                              ? 'bg-violet-600/25 ring-2 ring-violet-500/70 shadow-lg shadow-violet-900/40 scale-105'
                              : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] hover:scale-105'
                        }`}
                      >
                        <span className={`text-2xl ${!unlocked ? 'grayscale' : ''}`}>{emoji}</span>
                        {!unlocked && (
                          <span className="text-[7px] text-zinc-700 mt-0.5 font-bold">Lv{level}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name */}
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full text-center text-sm font-semibold bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 outline-none text-white placeholder-zinc-600 focus:border-violet-500/50 focus:bg-white/[0.08] transition-all"
              />

              {/* Bio */}
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="What are you studying? Where are you headed?"
                rows={2}
                className="w-full text-xs bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 outline-none resize-none text-zinc-300 placeholder-zinc-600 focus:border-violet-500/50 focus:bg-white/[0.08] transition-all leading-relaxed"
              />

              {/* Save / Cancel */}
              <div className="flex gap-2">
                <button
                  onClick={save} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-violet-900/30 active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? <span className="animate-pulse">Saving…</span> : <><Check size={13} /> Save Changes</>}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-zinc-400 hover:text-white text-xs font-bold transition-all border border-white/[0.07]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex gap-1 px-4 mb-2">
            <button onClick={() => setTab('profile')} className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${tab === 'profile' ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-500 hover:text-zinc-300'}`}>Profile</button>
            <button onClick={() => setTab('security')} className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${tab === 'security' ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-500 hover:text-zinc-300'}`}>Security</button>
          </div>
        )}

        {/* ── STATS ── */}
        {!editing && tab === 'profile' && (
          <div className="px-4 pb-3">
            {/* Thin separator */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-4" />

            {/* Three stat cards in a row */}
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {/* Level */}
              <div className="relative overflow-hidden rounded-2xl p-3.5 text-center" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(79,70,229,0.10) 100%)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
                <p className="text-3xl font-black text-white leading-none relative">{userLevel}</p>
                <p className="text-[9px] font-bold text-violet-400/80 mt-1.5 uppercase tracking-[0.15em] relative">Level</p>
              </div>

              {/* Streak */}
              <div className="relative overflow-hidden rounded-2xl p-3.5 text-center" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(239,68,68,0.10) 100%)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
                <div className="flex items-center justify-center gap-1 leading-none relative">
                  <Flame size={20} className="text-orange-400" />
                  <p className="text-3xl font-black text-white">{streakData?.current || 0}</p>
                </div>
                <p className="text-[9px] font-bold text-orange-400/80 mt-1.5 uppercase tracking-[0.15em] relative">Streak</p>
              </div>

              {/* XP */}
              <div className="relative overflow-hidden rounded-2xl p-3.5 text-center" style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.15) 0%, rgba(245,158,11,0.08) 100%)', border: '1px solid rgba(234,179,8,0.2)' }}>
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
                <p className="text-3xl font-black text-white leading-none relative">{xpData?.total || 0}</p>
                <p className="text-[9px] font-bold text-amber-400/80 mt-1.5 uppercase tracking-[0.15em] relative">Total XP</p>
              </div>
            </div>

            {/* XP Progress bar */}
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                    <Star size={10} className="text-amber-300" />
                  </div>
                  <span className="text-xs font-bold text-zinc-300">Level {userLevel}</span>
                </div>
                <span className="text-[11px] font-semibold text-violet-400">{xpToNext} XP to level {userLevel + 1}</span>
              </div>

              {/* Track */}
              <div className="relative h-3 bg-white/[0.06] rounded-full overflow-hidden">
                {/* Fill */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{
                    width: `${levelPct}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #6366f1, #818cf8)',
                    boxShadow: '0 0 12px rgba(139,92,246,0.6)',
                  }}
                />
                {/* Shimmer */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-40"
                  style={{
                    width: `${levelPct}%`,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2.5s infinite',
                  }}
                />
              </div>

              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-zinc-600">{xpInLevel} / 500 XP</span>
                <span className="text-[10px] text-zinc-600">{levelPct}%</span>
              </div>
            </div>

            {/* Personal best streak */}
            {streakData?.longest > 0 && (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-3" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.10) 0%, rgba(239,68,68,0.06) 100%)', border: '1px solid rgba(249,115,22,0.15)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)' }}>
                  <Trophy size={16} className="text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-bold text-orange-500/70 uppercase tracking-widest">Personal Best</p>
                  <p className="text-sm font-bold text-orange-300 mt-0.5">{streakData.longest} day streak</p>
                </div>
                {streakData.current === streakData.longest && streakData.longest > 1 && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
                    🔥 Active
                  </span>
                )}
              </div>
            )}

            {/* Next unlock teaser */}
            {nextAvatar && (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-2xl grayscale opacity-30 flex-shrink-0">{nextAvatar.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Next unlock</p>
                  <p className="text-xs font-semibold text-zinc-400 mt-0.5">{nextAvatar.label} avatar at Level {nextAvatar.level}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Lock size={11} className="text-zinc-700" />
                </div>
              </div>
            )}
          </div>
        )}

        {!editing && tab === 'security' && (
          <div className="px-4 pb-3 space-y-3">
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-1" />

            <button
              onClick={() => setShowPwModal(true)}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all hover:bg-white/[0.05]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.12)' }}>
                <Lock size={16} className="text-violet-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-zinc-200">Change Password</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Update your account password</p>
              </div>
              <ChevronRight size={14} className="text-zinc-600" />
            </button>

            <button
              onClick={() => setConfirmLogout(true)}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all hover:bg-white/[0.05]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(96,165,250,0.12)' }}>
                <LogOut size={16} className="text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-zinc-200">Log Out</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Sign out of this device</p>
              </div>
              <ChevronRight size={14} className="text-zinc-600" />
            </button>

            <div className="pt-2">
              <p className="text-[9px] font-bold text-red-500/70 uppercase tracking-widest mb-2 px-1">Danger Zone</p>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all hover:bg-red-500/10"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-red-400">Delete Account</p>
                  <p className="text-[11px] text-red-500/60 mt-0.5">Permanently erase all your data</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-4 pb-5 pt-1 text-center">
          <p className="text-[10px] text-zinc-700">
            Member since {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : '—'}
          </p>
        </div>

        {/* Change Password Modal */}
        {showPwModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowPwModal(false)}>
            <div className="bg-[#16161a] border border-white/10 rounded-2xl p-6 w-[320px] space-y-3" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-white">Change Password</h3>
              <div className="relative">
                <input type={showPwCurrent ? 'text' : 'password'} placeholder="Current password" value={pwCurrent}
                  onChange={e => setPwCurrent(e.target.value)}
                  className="w-full px-3 py-2.5 pr-9 rounded-xl text-sm bg-white/5 border border-white/10 text-zinc-200 outline-none focus:border-violet-500/50" />
                <button onClick={() => setShowPwCurrent(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showPwCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="relative">
                <input type={showPwNew ? 'text' : 'password'} placeholder="New password (min 8 chars)" value={pwNew}
                  onChange={e => setPwNew(e.target.value)}
                  className="w-full px-3 py-2.5 pr-9 rounded-xl text-sm bg-white/5 border border-white/10 text-zinc-200 outline-none focus:border-violet-500/50" />
                <button onClick={() => setShowPwNew(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showPwNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {pwMsg && <p className={`text-xs font-semibold ${pwMsg.ok ? 'text-green-500' : 'text-red-400'}`}>{pwMsg.text}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={changePassword} disabled={pwSaving || !pwCurrent || !pwNew}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all disabled:opacity-50">
                  {pwSaving ? 'Updating…' : 'Update Password'}
                </button>
                <button onClick={() => { setShowPwModal(false); setPwCurrent(''); setPwNew(''); setPwMsg(null); }}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout confirmation */}
        {confirmLogout && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setConfirmLogout(false)}>
            <div className="bg-[#16161a] border border-white/10 rounded-2xl p-6 w-[300px] text-center space-y-3" onClick={e => e.stopPropagation()}>
              <LogOut size={28} className="text-blue-400 mx-auto" />
              <p className="text-sm font-bold text-white">Log out of Clarix?</p>
              <p className="text-xs text-zinc-500">You'll need to sign in again to continue.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setConfirmLogout(false); onLogout && onLogout(); }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all">
                  Log Out
                </button>
                <button onClick={() => setConfirmLogout(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete account confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setConfirmDelete(false); setDeleteText(''); }}>
            <div className="bg-[#16161a] border border-red-500/20 rounded-2xl p-6 w-[320px] text-center space-y-3" onClick={e => e.stopPropagation()}>
              <AlertTriangle size={28} className="text-red-400 mx-auto" />
              <p className="text-sm font-bold text-white">Delete your account?</p>
              <p className="text-xs text-zinc-500">This permanently erases all your data — XP, streaks, chats, and weaknesses. This cannot be undone.</p>
              <input
                value={deleteText} onChange={e => setDeleteText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-red-500/20 text-zinc-200 outline-none focus:border-red-500/50 text-center"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={deleteAccount} disabled={deleteText !== 'DELETE' || deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all disabled:opacity-40">
                  {deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
                <button onClick={() => { setConfirmDelete(false); setDeleteText(''); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shimmer keyframe */}
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    </div>
  );
}