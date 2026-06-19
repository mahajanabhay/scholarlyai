"use client";
import { useState, useEffect } from "react";
import { X, Trash2, Shield, ShieldOff, BarChart2, Users, FileText, ScrollText, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminPanel({ onClose }) {
  const [tab, setTab]           = useState("stats");
  const [stats, setStats]       = useState(null);
  const [users, setUsers]       = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

  const load = async (section) => {
    setLoading(true);
    setMsg(null);
    try {
      if (section === "stats") {
        const d = await apiFetch(`${API_URL}/admin/stats`).then(r => r.json());
        setStats(d);
      } else if (section === "users") {
        const d = await apiFetch(`${API_URL}/admin/users`).then(r => r.json());
        setUsers(d.users || []);
      } else if (section === "audit") {
        const d = await apiFetch(`${API_URL}/admin/audit-log?limit=50`).then(r => r.json());
        setAuditLog(d.logs || []);
      }
    } catch { setMsg("Failed to load data."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(tab); }, [tab]);

  const deleteUser = async (id, name) => {
    if (!confirm(`Delete ${name}? This is permanent.`)) return;
    try {
      await apiFetch(`${API_URL}/admin/users/${id}`, { method: "DELETE" });
      setUsers(prev => prev.filter(u => u.id !== id));
      setMsg(`${name} deleted.`);
    } catch { setMsg("Delete failed."); }
  };

  const toggleAdmin = async (id) => {
    try {
      const d = await apiFetch(`${API_URL}/admin/users/${id}/toggle-admin`, { method: "POST" }).then(r => r.json());
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_admin: d.is_admin } : u));
    } catch { setMsg("Failed to toggle admin."); }
  };

  const tabs = [
    { id: "stats",  icon: BarChart2,  label: "Stats"     },
    { id: "users",  icon: Users,      label: "Users"     },
    { id: "audit",  icon: ScrollText, label: "Audit Log" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.07] rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-violet-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Admin Panel</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === id
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
              }`}>
              <Icon size={13} />{label}
            </button>
          ))}
          <button onClick={() => load(tab)} className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-2">
            <RefreshCw size={14} />
          </button>
        </div>

        {msg && <p className="px-6 py-2 text-xs text-red-400">{msg}</p>}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && <p className="text-xs text-zinc-400">Loading...</p>}

          {/* Stats */}
          {tab === "stats" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users",    value: stats.total_users   },
                  { label: "New Today",      value: stats.new_today     },
                  { label: "DAU",            value: stats.dau           },
                  { label: "Chats Today",    value: stats.chats_today   },
                  { label: "Quizzes Today",  value: stats.quizzes_today },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.07]">
                    <p className="text-xs text-zinc-500 mb-1">{label}</p>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">XP Leaderboard</p>
                <div className="space-y-2">
                  {stats.leaderboard.map((u, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.05]">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        <span className="text-zinc-400 mr-2">#{i + 1}</span>{u.name}
                      </span>
                      <span className="text-xs font-bold text-violet-500">{u.xp} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Users */}
          {tab === "users" && (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.05]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{u.name}</p>
                    <p className="text-xs text-zinc-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {u.is_admin && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">ADMIN</span>}
                    {!u.is_verified && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">UNVERIFIED</span>}
                    <span className="text-xs text-zinc-400">{u.xp} XP</span>
                    <button onClick={() => toggleAdmin(u.id)} title={u.is_admin ? "Remove admin" : "Make admin"}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-violet-400 transition-colors">
                      {u.is_admin ? <ShieldOff size={14} /> : <Shield size={14} />}
                    </button>
                    <button onClick={() => deleteUser(u.id, u.name)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Audit Log */}
          {tab === "audit" && (
            <div className="space-y-2">
              {auditLog.map((log, i) => (
                <div key={i} className="flex items-start gap-4 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.05]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{log.action}</p>
                    <p className="text-xs text-zinc-400 truncate">{log.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-zinc-400">{log.ip}</p>
                    <p className="text-[10px] text-zinc-500">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}