"use client";
import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { apiFetch, getAuthHeaders } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function NotificationsPanel({ userId, onClose, onRead }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const panelRef = useRef(null);

  useEffect(() => {
    apiFetch(`${API_URL}/notifications/${userId}?limit=20&offset=0`)
      .then(r => r.json())
      .then(d => { setNotifications((d.notifications || []).reverse()); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    // Small delay so the button click that opened us doesn't immediately close us
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const markRead = async () => {
    await fetch(`${API_URL}/notifications/${userId}/read`, {
      method: 'POST', headers: getAuthHeaders(),
    });
    onRead();
  };

  const typeIcon = (type) => {
    if (type === 'success')   return <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />;
    if (type === 'warning')   return <AlertTriangle size={14} className="text-orange-400 shrink-0 mt-0.5" />;
    if (type === 'milestone') return <span className="text-sm shrink-0 mt-0.5">🏆</span>;
    return <Bell size={14} className="text-blue-400 shrink-0 mt-0.5" />;
  };

  return (
    /**
     * Positioning:
     *  - `fixed` so it escapes ALL stacking contexts in the chat area
     *    (code blocks, scroll containers, etc. cannot paint over it)
     *  - `top-12` = header height (h-12 = 48px)
     *  - `right-4` = aligned to the right edge of the viewport
     *  - `z-[9999]` = above everything in the app
     *
     * The previous `absolute top-14` was relative to the nearest `relative`
     * ancestor inside a stacking context shared with the chat content,
     * which allowed code block containers to paint over it.
     */
    <div
      ref={panelRef}
      onClick={e => e.stopPropagation()}
      className="fixed top-12 right-4 z-9999 flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10"
      style={{ width: '320px', height: '420px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-zinc-100 dark:border-white/[0.07]">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-zinc-400" />
          <span className="text-sm font-bold text-white">Notifications</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
              {notifications.filter(n => !n.read).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={markRead} className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition">
            Mark all read
          </button>
          <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.07] transition">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* List — fills remaining fixed height, scrolls internally */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-zinc-600">Loading…</p>
          </div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Bell size={22} className="text-zinc-700" />
            <p className="text-xs text-zinc-600">No notifications yet</p>
          </div>
        )}
        {!loading && notifications.map((n, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3 transition-colors"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: !n.read
                ? n.type === 'milestone'
                  ? 'rgba(251,191,36,0.06)'
                  : 'rgba(99,102,241,0.06)'
                : 'transparent',
            }}
          >
            {typeIcon(n.type)}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 leading-relaxed">{n.message}</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {!n.read && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}