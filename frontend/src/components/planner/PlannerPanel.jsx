"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Calendar, CheckCircle2, Circle, Trash2, Zap,
  RefreshCw, BookOpen, Brain, RotateCcw, Plus,
  Clock, Target, Sparkles, ListTodo, AlertTriangle,
  Send, Star, Lock
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Task type config ──────────────────────────────────────────────────────────
const TASK_TYPE = {
  study:    { icon: BookOpen,  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',    badge: 'bg-blue-900/40 text-blue-300',    label: 'Study',    time: '30–45 min' },
  quiz:     { icon: Brain,     color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30', badge: 'bg-violet-900/40 text-violet-300', label: 'Quiz',     time: '15–20 min' },
  revision: { icon: RotateCcw, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', badge: 'bg-orange-900/40 text-orange-300', label: 'Revision', time: '20–30 min' },
  general:  { icon: ListTodo,  color: 'text-zinc-400',   bg: 'bg-zinc-800 border-zinc-700',           badge: 'bg-zinc-700 text-zinc-300',        label: 'Task',     time: null },
};

function getType(task) {
  if (!task.ai_generated) return 'general';
  const t = (task.title || '').toLowerCase();
  if (t.includes('📖') || task.type === 'study')    return 'study';
  if (t.includes('🧠') || task.type === 'quiz')     return 'quiz';
  if (t.includes('🔁') || task.type === 'revision') return 'revision';
  return 'study';
}

// Verification prompts per type — what the modal asks the user
const VERIFY_CONFIG = {
  study: {
    title:       'Prove you studied this topic',
    description: 'Tell us 2–3 specific things you learned. Vague answers like "I studied it" won\'t be accepted.',
    placeholder: 'e.g. "I learned that Newton\'s second law states F=ma, and studied how acceleration relates to net force and mass. I also covered the difference between weight and mass…"',
    scoreLabel:  null,
    icon:        BookOpen,
    color:       'text-blue-400',
    minLength:   80,
  },
  quiz: {
    title:       'Submit your quiz result',
    description: 'You need to score at least 3/5 (60%) to mark this complete. Paste your score and briefly describe the topic.',
    placeholder: 'e.g. "Scored 4/5 on Newton\'s Laws. Got the question about inertia wrong but understood the rest."',
    scoreLabel:  'Your score (e.g. 4/5)',
    icon:        Brain,
    color:       'text-violet-400',
    minLength:   30,
  },
  revision: {
    title:       'Confirm your revision',
    description: 'Describe the specific weak areas you revised and what you did to address them.',
    placeholder: 'e.g. "Revised photosynthesis — I re-read my notes, made a mind map of the light and dark reactions, and tested myself with flashcards…"',
    scoreLabel:  null,
    icon:        RotateCcw,
    color:       'text-orange-400',
    minLength:   60,
  },
  general: {
    title:       'Confirm task completion',
    description: 'Briefly describe what you actually did to complete this task.',
    placeholder: 'e.g. "I made a summary sheet of all the key formulas and reviewed chapter 4 end-of-chapter questions…"',
    scoreLabel:  null,
    icon:        Target,
    color:       'text-zinc-400',
    minLength:   40,
  },
};

// ── Verification Modal ───────────────────────────────────────────────────────
// Shows task-type-specific instructions and a single "Check Now" button.
// No text proof fields — the bot verifies against its own logs.
const VERIFY_GUIDE = {
  study: {
    icon:         BookOpen,
    color:        'text-blue-400',
    border:       'border-blue-500/30',
    bg:           'bg-blue-500/08',
    heading:      'Go study in the chat first',
    steps: [
      { n: '1', text: 'Open a chat session on the left' },
      { n: '2', text: 'Ask the AI to explain this topic, quiz you, or discuss key concepts' },
      { n: '3', text: 'Have a real back-and-forth — at least a few messages' },
      { n: '4', text: 'Come back here and click Verify' },
    ],
    note: 'The bot checks your actual chat history. It cannot be fooled by opening the chat and closing it.',
    buttonLabel: 'I\'ve studied in chat — Verify',
  },
  quiz: {
    icon:         Brain,
    color:        'text-violet-400',
    border:       'border-violet-500/30',
    bg:           'bg-violet-500/08',
    heading:      'Complete a quiz first',
    steps: [
      { n: '1', text: 'Open the Quiz section from the sidebar' },
      { n: '2', text: 'Take a quiz on this subject' },
      { n: '3', text: 'Score at least 3/5 (60%) to pass' },
      { n: '4', text: 'Come back here and click Verify' },
    ],
    note: 'The bot reads your actual quiz score. You cannot pass by just opening the quiz.',
    buttonLabel: 'I\'ve completed the quiz — Verify',
  },
  revision: {
    icon:         RotateCcw,
    color:        'text-orange-400',
    border:       'border-orange-500/30',
    bg:           'bg-orange-500/08',
    heading:      'Practice weak topics first',
    steps: [
      { n: '1', text: 'Open the Weakness Tracker from the sidebar' },
      { n: '2', text: 'Find a topic related to this subject' },
      { n: '3', text: 'Click "Practice This Topic" and complete the drill' },
      { n: '4', text: 'Come back here and click Verify' },
    ],
    note: 'The bot logs your practice session automatically. It can tell if you skipped it.',
    buttonLabel: 'I\'ve done the practice — Verify',
  },
  general: {
    icon:         Target,
    color:        'text-zinc-400',
    border:       'border-zinc-600',
    bg:           'bg-zinc-800/40',
    heading:      'Describe what you did',
    steps: [],
    note: null,
    buttonLabel: 'Verify',
  },
};

function VerifyModal({ task, taskType, userId, onClose, onVerified }) {
  const guide      = VERIFY_GUIDE[taskType] || VERIFY_GUIDE.general;
  const Icon       = guide.icon;
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);  // { verified, feedback }
  const [proof,    setProof]    = useState('');     // only for 'general'

  const verify = async () => {
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('task_type',    taskType);
      fd.append('task_title',   task.title.replace(/^[📖🧠🔁📌]\s*/, ''));
      fd.append('task_created', task.created || '');
      if (taskType === 'general') fd.append('proof', proof.trim());

      const r = await apiFetch(
        `${API_URL}/planner/${userId}/verify/${task.id}`,
        { method: 'POST', body: fd }
      );
      const d = await r.json();
      setResult({ verified: d.verified, feedback: d.feedback, xp: d.xp });
      if (d.verified) setTimeout(() => onVerified(d.xp), 2000);
    } catch {
      setResult({ verified: false, feedback: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-zinc-900 border ${guide.border} rounded-2xl shadow-2xl w-100 max-h-[85vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Icon size={16} className={guide.color} />
              <span className="text-sm font-bold text-zinc-100">Task Verification</span>
            </div>
            <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition"><X size={16} /></button>
          </div>
          <p className="text-[11px] text-zinc-500 line-clamp-1 pl-6">
            {task.title.replace(/^[📖🧠🔁📌]\s*/, '')}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Result state */}
          {result ? (
            <div className={`rounded-xl p-4 border ${
              result.verified
                ? 'bg-green-900/20 border-green-700'
                : 'bg-red-900/15 border-red-800'
            }`}>
              <p className={`text-sm font-bold mb-2 ${result.verified ? 'text-green-300' : 'text-red-300'}`}>
                {result.verified ? '✅ Verified!' : '❌ Not verified yet'}
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">{result.feedback}</p>
              {result.verified && (
                <p className="text-xs text-green-400 font-bold mt-2">+20 XP awarded — closing shortly…</p>
              )}
              {!result.verified && (
                <button
                  onClick={() => setResult(null)}
                  className="mt-3 text-xs font-bold text-zinc-400 hover:text-zinc-200 underline transition"
                >
                  ← Follow the steps and try again
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Guide card */}
              <div className={`rounded-xl border ${guide.border} p-4 space-y-3`}>
                <p className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <Icon size={14} className={guide.color} />
                  {guide.heading}
                </p>

                {/* Steps */}
                {guide.steps.length > 0 && (
                  <div className="space-y-2">
                    {guide.steps.map(s => (
                      <div key={s.n} className="flex items-start gap-3">
                        <span className={`shrink-0 w-5 h-5 rounded-full border ${guide.border} flex items-center justify-center text-[10px] font-bold ${guide.color}`}>
                          {s.n}
                        </span>
                        <p className="text-xs text-zinc-300 leading-relaxed pt-0.5">{s.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* General: show input */}
                {taskType === 'general' && (
                  <textarea
                    value={proof}
                    onChange={e => setProof(e.target.value)}
                    rows={3}
                    placeholder="Describe what you actually did to complete this task…"
                    className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 outline-none text-zinc-200 placeholder-zinc-600 resize-none"
                  />
                )}

                {/* Bot note */}
                {guide.note && (
                  <div className="flex items-start gap-2 pt-1">
                    <Lock size={11} className="text-zinc-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-zinc-600 leading-relaxed italic">{guide.note}</p>
                  </div>
                )}
              </div>

              {/* Verify button */}
              <button
                onClick={verify}
                disabled={loading || (taskType === 'general' && proof.trim().length < 40)}
                className={`w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                  loading
                    ? 'bg-zinc-800 text-zinc-500'
                    : 'bg-linear-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white disabled:opacity-40'
                }`}
              >
                {loading ? (
                  <><RefreshCw size={15} className="animate-spin" /> Bot is checking your activity…</>
                ) : (
                  <><Send size={14} /> {guide.buttonLabel}</>
                )}
              </button>

              <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
                The bot verifies by checking its own records — chat history, quiz scores, and practice sessions. You cannot bypass this check.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task Row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, onVerify, onDelete }) {
  const type = getType(task);
  const cfg  = TASK_TYPE[type];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      task.done
        ? 'border-green-800/40 bg-green-900/10 opacity-75'
        : cfg.bg
    }`}>
      <div className="flex items-start gap-3 p-3">
        {/* Check / verify button */}
        <button
          onClick={() => !task.done && onVerify(task, type)}
          className={`shrink-0 mt-0.5 transition-transform active:scale-90 ${task.done ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          title={task.done ? 'Completed' : 'Click to complete — AI will verify you actually did this'}
        >
          {task.done
            ? <CheckCircle2 size={20} className="text-green-400" />
            : <Circle size={20} className={`${cfg.color} opacity-70`} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              <Icon size={9} /> {cfg.label}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">{task.subject}</span>
            {cfg.time && !task.done && (
              <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                <Clock size={9} /> {cfg.time}
              </span>
            )}
          </div>

          <p className={`text-sm font-medium leading-snug ${
            task.done ? 'line-through text-zinc-500' : 'text-zinc-200'
          }`}>
            {task.title.replace(/^[📖🧠🔁📌]\s*/, '')}
          </p>

          {/* Hint */}
          {!task.done && (
            <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-1">
              <Lock size={9} />
              {type === 'quiz'
                ? 'Must score 60%+ to mark complete'
                : type === 'study'
                ? 'Describe what you learned to unlock'
                : type === 'revision'
                ? 'Describe your revision to unlock'
                : 'Describe what you did to unlock'}
            </p>
          )}
          {task.done && (
            <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle2 size={9} /> Verified & completed · +20 XP
            </p>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="shrink-0 text-zinc-700 hover:text-red-400 transition p-1 mt-0.5"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Subject picker ────────────────────────────────────────────────────────────
const QUICK_SUBJECTS = ['Maths', 'Physics', 'Chemistry', 'Biology', 'History', 'CS', 'Economics', 'Other'];

// ── Main PlannerPanel ─────────────────────────────────────────────────────────
export default function PlannerPanel({ userId, onClose, onXpUpdate }) {
  const [tasks, setTasks]             = useState([]);
  const [title, setTitle]             = useState('');
  const [subject, setSubject]         = useState('General');
  const [loading, setLoading]         = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [showAdd, setShowAdd]         = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [generatedCount, setGeneratedCount] = useState(null);
  const [verifying, setVerifying]     = useState(null); // { task, type }

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API_URL}/planner/${userId}`);
      const d = await r.json();
      setTasks(d.tasks || []);
    } catch {}
    setInitialLoad(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const addTask = async () => {
    if (!title.trim()) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('title', title);
    fd.append('subject', subject);
    await apiFetch(`${API_URL}/planner/${userId}/add`, { method: 'POST', body: fd });
    setTitle('');
    setShowAdd(false);
    load();
    setLoading(false);
  };

  const del = async (taskId) => {
    await apiFetch(`${API_URL}/planner/${userId}/delete/${taskId}`, { method: 'POST' });
    load();
  };

  const generatePlan = async () => {
    setGenerating(true);
    setGeneratedCount(null);
    try {
      const fd = new FormData();
      const r  = await apiFetch(`${API_URL}/planner/${userId}/generate`, { method: 'POST', body: fd });
      const d  = await r.json();
      setGeneratedCount(d.tasks?.length || 3);
      await load();
    } catch (e) {
      console.error('Plan generation failed:', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleVerified = (xpData) => {
    setVerifying(null);
    if (xpData && onXpUpdate) onXpUpdate(xpData);
    load();
  };

  // Derived
  const aiTasks     = tasks.filter(t => t.ai_generated);
  const manualTasks = tasks.filter(t => !t.ai_generated);
  const done        = tasks.filter(t => t.done).length;
  const total       = tasks.length;
  const pct         = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone     = total > 0 && done === total;
  const estMins     = tasks.filter(t => !t.done && t.ai_generated).reduce((acc, t) => {
    const type = getType(t);
    return acc + (type === 'study' ? 37 : type === 'quiz' ? 17 : 25);
  }, 0);

  return (
    <>
      {/* Verify modal — rendered above everything */}
      {verifying && (
        <VerifyModal
          task={verifying.task}
          taskType={verifying.type}
          userId={userId}
          onClose={() => setVerifying(null)}
          onVerified={handleVerified}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-110 max-h-[88vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="p-5 border-b border-zinc-800 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Calendar size={18} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-zinc-100">Daily Study Plan</h2>
                  <p className="text-[10px] text-zinc-500">
                    {initialLoad ? 'Loading…'
                      : total === 0 ? 'No tasks yet — generate your plan below'
                      : allDone ? '🎉 All tasks verified and complete!'
                      : `${done}/${total} verified complete${estMins > 0 ? ` · ~${estMins} min left` : ''}`}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition">
                <X size={18} />
              </button>
            </div>

            {total > 0 && (
              <div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      allDone ? 'bg-green-500' : 'bg-linear-to-r from-blue-500 to-violet-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-zinc-600">{pct}% verified</span>
                  {allDone && <span className="text-[10px] text-green-500 font-bold">✓ All done!</span>}
                </div>
              </div>
            )}
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Generate card */}
            <div className={`rounded-xl border p-4 transition-all ${
              generatedCount !== null
                ? 'border-green-700/40 bg-green-900/10'
                : 'border-zinc-700/50 bg-zinc-800/40'
            }`}>
              {generatedCount !== null && !generating ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} className="text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-green-300">{generatedCount} tasks added</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Click the circle on each task to begin verification</p>
                  </div>
                  <button onClick={generatePlan} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1">
                    <RefreshCw size={11} /> Redo
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles size={15} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-200">AI-Personalised Study Plan</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                        3 tasks based on your weaknesses. Each task must be verified by AI before it counts.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { icon: BookOpen,  color: 'text-blue-400',   bg: 'bg-blue-500/10',   label: 'Study',    time: '~35 min' },
                      { icon: Brain,     color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Quiz',     time: '~15 min' },
                      { icon: RotateCcw, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Revision', time: '~25 min' },
                    ].map(({ icon: Icon, color, bg, label, time }) => (
                      <div key={label} className={`rounded-lg p-2 ${bg} flex flex-col items-center gap-1 text-center`}>
                        <Icon size={14} className={color} />
                        <p className="text-[10px] font-semibold text-zinc-300">{label}</p>
                        <p className="text-[9px] text-zinc-500">{time}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={generatePlan}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-sm font-bold disabled:opacity-50 transition"
                  >
                    {generating
                      ? <><RefreshCw size={15} className="animate-spin" /> Building your plan…</>
                      : <><Zap size={15} /> Generate Today's Plan</>}
                  </button>
                </>
              )}
            </div>

            {/* How it works — shown only when tasks exist and none done */}
            {total > 0 && done === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-400/80 leading-relaxed">
                  <span className="font-bold text-amber-400">Tasks are locked until verified.</span> Click the circle on a task to submit proof of completion. The AI will check your work before awarding XP.
                </p>
              </div>
            )}

            {/* AI tasks */}
            {aiTasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles size={10} /> Today's AI Plan
                </p>
                {aiTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onVerify={(t, type) => setVerifying({ task: t, type })}
                    onDelete={() => del(task.id)}
                  />
                ))}
              </div>
            )}

            {aiTasks.length > 0 && manualTasks.length > 0 && (
              <div className="border-t border-zinc-800" />
            )}

            {/* Manual tasks */}
            {manualTasks.length > 0 && (
              <div className="space-y-2">
                {aiTasks.length > 0 && (
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
                    <ListTodo size={10} /> My Tasks
                  </p>
                )}
                {manualTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onVerify={(t, type) => setVerifying({ task: t, type })}
                    onDelete={() => del(task.id)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!initialLoad && total === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                  <Target size={22} className="text-zinc-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-400">No tasks yet</p>
                  <p className="text-xs text-zinc-600 mt-1 max-w-55 leading-relaxed">
                    Generate your AI plan above, or add your own tasks below.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer: Add task ── */}
          <div className="p-4 border-t border-zinc-800 shrink-0">
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition"
              >
                <Plus size={14} /> Add a task manually
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-zinc-400">Add Task</p>
                  <button onClick={() => setShowAdd(false)} className="text-zinc-600 hover:text-zinc-400 transition"><X size={14} /></button>
                </div>
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setShowAdd(false); }}
                  placeholder="What do you need to do?"
                  className="w-full text-sm bg-zinc-800 border border-zinc-700 focus:border-blue-500 rounded-xl px-3 py-2 outline-none text-zinc-200 placeholder-zinc-600 transition"
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUBJECTS.map(s => (
                    <button
                      key={s}
                      onClick={() => setSubject(s === 'Other' ? '' : s)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition ${
                        subject === s || (s === 'Other' && !QUICK_SUBJECTS.slice(0, -1).includes(subject))
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {!QUICK_SUBJECTS.slice(0, -1).includes(subject) && (
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Subject name…"
                    className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 outline-none text-zinc-300 placeholder-zinc-600"
                  />
                )}
                <button
                  onClick={addTask}
                  disabled={loading || !title.trim()}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition"
                >
                  {loading ? 'Adding…' : 'Add Task'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}