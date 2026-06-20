"use client";

import { Trophy, Zap, Star } from 'lucide-react';
export default function XPBar({ xpData }) {
  if (!xpData) return null;
  const xpInLevel = xpData.total % 500;
  const pct = Math.round((xpInLevel / 500) * 100);
  return (
    <div className="px-3 py-2 border-t dark:border-zinc-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
          <Star size={11} /> Lv {xpData.level}
        </span>
        <span className="text-[10px] text-zinc-400">{xpInLevel}/500 XP</span>
      </div>
      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
