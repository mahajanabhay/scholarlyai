"use client";
import { useState, useEffect } from 'react';
import { apiFetch, getAuthHeaders } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AutoPlanModal({ userId, onClose, onXpUpdate }) {
  const [step, setStep]           = useState('idle');   // 'idle' | 'loading' | 'done'
  const [tasks, setTasks]         = useState([]);
  const [checked, setChecked]     = useState({});
  const [weakTopics, setWeakTopics] = useState([]);

  useEffect(() => {
    // Load existing weaknesses to personalise the plan
    apiFetch(`${API_URL}/weaknesses/${userId}`).then(r => r.json())
      .then(d => setWeakTopics((d.weaknesses || []).map(w => w.topic)))
      .catch(() => {});
  }, [userId]);

  const generate = async () => {
    setStep('loading');
    const topicHint = weakTopics.length > 0
      ? `The student is weak in: ${[...new Set(weakTopics)].slice(0, 3).join(', ')}.`
      : 'The student has no tracked weaknesses yet.';

    // Use Anthropic-free: call the backend /chat endpoint in LEARN mode
    const fd = new FormData();
    fd.append('message', `Generate a focused daily study plan for today. ${topicHint} Output ONLY a JSON array of exactly 3 objects, each with keys "title" (string, the task), "subject" (string), "type" (one of: "study", "quiz", "revision"). No markdown, no explanation, just the raw JSON array.`);
    fd.append('session_id', 'autoplan_' + userId);
    fd.append('mode', 'LEARN');
    fd.append('history', '[]');

    try {
      const r = await apiFetch(`${API_URL}/chat`, { method: 'POST', body: fd });
      let raw = '';
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value);
      }
      // Strip any markdown fences
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const planTasks = parsed.slice(0, 3).map((t, i) => ({
        id: Date.now() + i,
        title: t.title,
        subject: t.subject,
        type: t.type || 'study',
      }));

      // Push to backend planner
      for (const task of planTasks) {
        const tfd = new FormData();
        tfd.append('title',   task.title);
        tfd.append('subject', task.subject);
        await apiFetch(`${API_URL}/planner/${userId}/add`, { method: 'POST', body: tfd });
      }

      setTasks(planTasks);
      setChecked({});
      setStep('done');
    } catch {
      // Fallback plan
      const fallback = [
        { id: Date.now(),     title: 'Study one chapter from your current subject', subject: weakTopics[0] || 'General', type: 'study' },
        { id: Date.now() + 1, title: `Take a 5-question quiz on ${weakTopics[0] || 'your subject'}`, subject: weakTopics[0] || 'General', type: 'quiz' },
        { id: Date.now() + 2, title: 'Review your notes and highlight key formulas', subject: 'General', type: 'revision' },
      ];
      setTasks(fallback);
      setStep('done');
    }
  };

  const toggleCheck = async (task) => {
    const nowDone = !checked[task.id];
    setChecked(prev => ({ ...prev, [task.id]: nowDone }));
    if (nowDone) {
      const fd = new FormData(); fd.append('amount', 20);
      const r = await apiFetch(`${API_URL}/xp/${userId}/add`, { method: 'POST', body: fd });
      const d = await r.json();
      onXpUpdate(d);
    }
  };

  const typeIcon = (type) => {
    if (type === 'quiz')     return <span className="text-green-500">🧠</span>;
    if (type === 'revision') return <span className="text-purple-500">🔁</span>;
    return <span className="text-blue-500">📖</span>;
  };

  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-105" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Calendar size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Today's Study Plan</h2>
              <p className="text-[10px] text-zinc-400">AI-generated, personalised for you</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'idle' && (
            <div className="text-center space-y-4 py-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {weakTopics.length > 0
                  ? `Based on your weaknesses in ${[...new Set(weakTopics)].slice(0, 2).join(', ')}, we'll build a targeted plan.`
                  : "We'll generate a balanced study, quiz, and revision plan for today."}
              </p>
              <button onClick={generate}
                className="w-full py-3 rounded-xl bg-linear-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm hover:opacity-90 transition">
                ✨ Generate Today's Plan
              </button>
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
              </div>
              <p className="text-sm text-zinc-400">Building your personalised plan…</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">3 Tasks · Today</p>
                <span className="text-xs text-zinc-400">{doneCount}/3 done · +{doneCount * 20} XP earned</span>
              </div>
              {tasks.map(task => (
                <div key={task.id}
                  onClick={() => toggleCheck(task)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${checked[task.id] ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700'}`}>
                  <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${checked[task.id] ? 'bg-green-500 border-green-500' : 'border-zinc-400 dark:border-zinc-600'}`}>
                    {checked[task.id] && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${checked[task.id] ? 'line-through text-zinc-400' : ''}`}>{task.title}</p>
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">{typeIcon(task.type)} {task.subject}</p>
                  </div>
                </div>
              ))}
              <button onClick={generate}
                className="w-full py-2 rounded-xl border dark:border-zinc-700 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-1">
                <RefreshCw size={12} /> Regenerate Plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}