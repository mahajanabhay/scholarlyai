"use client";
import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, X, Shield, Trash2, RefreshCw,
  BookOpen, ChevronDown, ChevronUp, Zap, CheckCircle2,
  Target, Brain, ArrowRight, RotateCcw
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Retry Quiz Modal ──────────────────────────────────────────────────────────
// Shown inline when user clicks "Practice This Topic"
function RetryQuiz({ subject, weakQuestions, onClose, onDone }) {
  const [questions, setQuestions]   = useState([]);
  const [current, setCurrent]       = useState(0);
  const [answers, setAnswers]       = useState([]);
  const [feedback, setFeedback]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [score, setScore]           = useState(0);
  const [done, setDone]             = useState(false);

  useEffect(() => {
    const fd = new FormData();
    fd.append('subject', subject);
    fd.append('weak_topic_questions', JSON.stringify(weakQuestions));
    fd.append('num_questions', '4');
    fetch(`${API_URL}/study-session/retry-weak`, {
      method: 'POST', headers: getAuthHeaders(), body: fd
    })
      .then(r => r.json())
      .then(d => { setQuestions(d.questions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [subject]);

  const handleAnswer = (letter) => {
    if (feedback) return;
    const q = questions[current];
    const correct = letter.toUpperCase() === q.answer?.toUpperCase();
    setFeedback({ letter, correct, explanation: q.explanation || '' });
    if (correct) setScore(s => s + 1);
  };

  const next = () => {
    setAnswers(a => [...a, feedback]);
    setFeedback(null);
    if (current + 1 >= questions.length) {
      setDone(true);
    } else {
      setCurrent(c => c + 1);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <RefreshCw size={22} className="text-violet-400 animate-spin" />
      <p className="text-sm text-zinc-400">Generating targeted practice questions…</p>
    </div>
  );

  if (!questions.length) return (
    <div className="text-center py-12">
      <p className="text-sm text-zinc-400">Couldn't generate questions. Try again.</p>
      <button onClick={onClose} className="mt-4 text-xs text-zinc-400 underline">Back</button>
    </div>
  );

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-2">
        <div className={`text-5xl font-black ${pct >= 75 ? 'text-green-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
          {score}/{questions.length}
        </div>
        <p className="text-sm font-semibold text-zinc-300">
          {pct >= 75 ? '🎉 Great improvement!' : pct >= 50 ? '👍 Getting there — keep practising!' : '💪 Keep going — repetition builds mastery'}
        </p>
        <p className="text-xs text-zinc-500 text-center">
          {pct >= 75
            ? 'You\'re building real confidence in this topic.'
            : 'These concepts take time. Try again to reinforce your memory.'}
        </p>
        <div className="flex gap-2 w-full mt-2">
          <button
            onClick={() => { setCurrent(0); setAnswers([]); setFeedback(null); setScore(0); setDone(false); }}
            className="flex-1 py-2 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition flex items-center justify-center gap-1"
          >
            <RotateCcw size={13} /> Try Again
          </button>
          <button
            onClick={onDone}
            className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const opts = [
    { letter: 'A', text: q.option_a || q.a },
    { letter: 'B', text: q.option_b || q.b },
    { letter: 'C', text: q.option_c || q.c },
    { letter: 'D', text: q.option_d || q.d },
  ].filter(o => o.text);

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
              i < current ? 'bg-violet-500' : i === current ? 'bg-violet-300 animate-pulse' : 'bg-zinc-700'
            }`} />
          ))}
        </div>
        <span className="text-[10px] text-zinc-500 flex-shrink-0">{current + 1}/{questions.length}</span>
      </div>

      {/* Question */}
      <div className="bg-zinc-800/60 rounded-xl p-4">
        <p className="text-xs font-bold text-violet-400 mb-2 flex items-center gap-1">
          <Target size={11} /> Targeted Practice
        </p>
        <p className="text-sm font-semibold text-zinc-100 leading-relaxed">{q.question || q.q}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {opts.map(opt => {
          const isSelected = feedback?.letter === opt.letter;
          const isCorrect  = q.answer?.toUpperCase() === opt.letter;
          let cls = "flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl border text-sm transition ";
          if (!feedback) {
            cls += "border-zinc-700 hover:border-violet-500 hover:bg-violet-900/20 text-zinc-200 cursor-pointer";
          } else if (isCorrect) {
            cls += "border-green-500 bg-green-900/20 text-green-300";
          } else if (isSelected) {
            cls += "border-red-500 bg-red-900/20 text-red-300";
          } else {
            cls += "border-zinc-700 text-zinc-500 opacity-50";
          }
          return (
            <button key={opt.letter} className={cls} onClick={() => handleAnswer(opt.letter)} disabled={!!feedback}>
              <span className={`flex-shrink-0 w-6 h-6 rounded border text-xs font-bold flex items-center justify-center ${
                !feedback ? 'border-zinc-600 text-zinc-400' :
                isCorrect ? 'border-green-500 text-green-400' :
                isSelected ? 'border-red-500 text-red-400' :
                'border-zinc-700 text-zinc-600'
              }`}>
                {opt.letter}
              </span>
              {opt.text}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-xl p-3 border text-xs ${
          feedback.correct
            ? 'bg-green-900/20 border-green-700 text-green-300'
            : 'bg-red-900/20 border-red-700 text-red-300'
        }`}>
          <p className="font-bold mb-1">{feedback.correct ? '✅ Correct!' : `❌ Incorrect — correct answer is ${q.answer}`}</p>
          {feedback.explanation && <p className="text-zinc-400 leading-relaxed">{feedback.explanation}</p>}
        </div>
      )}

      {feedback && (
        <button onClick={next} className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition flex items-center justify-center gap-2">
          {current + 1 >= questions.length ? 'See Results' : 'Next Question'} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

// ── Main WeaknessPanel ────────────────────────────────────────────────────────
export default function WeaknessPanel({ userId, onClose }) {
  const [weaknesses, setWeaknesses]         = useState([]);
  const [revision, setRevision]             = useState('');
  const [loadingRevision, setLoadingRevision] = useState(false);
  const [expandedTopic, setExpandedTopic]   = useState(null);
  const [retryTopic, setRetryTopic]         = useState(null);  // topic string being retried
  const [confirmClear, setConfirmClear]     = useState(null);  // 'all' | topic string
  const [loading, setLoading]               = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/weaknesses/${userId}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => { setWeaknesses(d.weaknesses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const getRevision = async () => {
    setLoadingRevision(true);
    const r = await fetch(`${API_URL}/revision/${userId}`, { headers: getAuthHeaders() });
    const d = await r.json();
    setRevision(d.revision || '');
    setLoadingRevision(false);
  };

  const clear = async (topic) => {
    const fd = new FormData();
    if (topic && topic !== 'all') fd.append('topic', topic);
    await fetch(`${API_URL}/weaknesses/${userId}/clear`, {
      method: 'POST', headers: getAuthHeaders(), body: fd
    });
    setConfirmClear(null);
    setExpandedTopic(null);
    setRevision('');
    load();
  };

  // Group weaknesses by topic, preserving question text for retry
  const byTopic = weaknesses.reduce((acc, w) => {
    if (!acc[w.topic]) acc[w.topic] = [];
    acc[w.topic].push(w.question || w.topic);
    return acc;
  }, {});

  const topics = Object.entries(byTopic);
  const totalCount = weaknesses.length;

  // Severity colour per topic
  const severity = (count) => {
    if (count >= 5) return { dot: 'bg-red-500',    badge: 'text-red-400 bg-red-900/30 border-red-800',    bar: 'bg-red-500',    label: 'Critical' };
    if (count >= 3) return { dot: 'bg-orange-500', badge: 'text-orange-400 bg-orange-900/30 border-orange-800', bar: 'bg-orange-500', label: 'Needs work' };
    return               { dot: 'bg-yellow-500',  badge: 'text-yellow-400 bg-yellow-900/30 border-yellow-800', bar: 'bg-yellow-500',  label: 'Review' };
  };

  const maxCount = Math.max(...topics.map(([, qs]) => qs.length), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-[460px] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Brain size={18} className="text-orange-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100">Weakness Tracker</h2>
              <p className="text-[10px] text-zinc-500">
                {loading ? 'Loading…' : totalCount === 0 ? 'All clear — nothing to review' : `${totalCount} mistake${totalCount !== 1 ? 's' : ''} across ${topics.length} topic${topics.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition"><X size={18} /></button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Retry quiz — shown inline */}
          {retryTopic && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setRetryTopic(null)}
                  className="text-zinc-500 hover:text-zinc-200 transition"
                >
                  ← Back
                </button>
                <span className="text-xs text-zinc-500">Practising: <span className="text-violet-400 font-semibold">{retryTopic}</span></span>
              </div>
              <RetryQuiz
                subject={retryTopic}
                weakQuestions={byTopic[retryTopic] || []}
                onClose={() => setRetryTopic(null)}
                onDone={() => { setRetryTopic(null); load(); }}
              />
            </div>
          )}

          {/* Normal view */}
          {!retryTopic && (
            <div className="p-5 space-y-3">

              {/* Empty state */}
              {!loading && totalCount === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-green-900/30 flex items-center justify-center">
                    <Shield size={28} className="text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-300">You're all caught up!</p>
                  <p className="text-xs text-zinc-500 text-center max-w-[240px]">
                    Wrong quiz answers will appear here automatically so you can target them directly.
                  </p>
                </div>
              )}

              {/* Loading skeleton */}
              {loading && (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-zinc-800 animate-pulse" />
                  ))}
                </div>
              )}

              {/* Topic cards */}
              {!loading && topics.map(([topic, questions]) => {
                const count = questions.length;
                const sev   = severity(count);
                const isOpen = expandedTopic === topic;

                return (
                  <div key={topic} className={`rounded-xl border transition-all ${sev.badge}`}>
                    {/* Topic header row */}
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Severity dot */}
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-200 truncate">{topic}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${sev.badge} border`}>
                              {sev.label}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${sev.bar}`}
                              style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1">{count} wrong answer{count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setRetryTopic(topic)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition"
                        >
                          <Zap size={12} /> Practice This Topic
                        </button>
                        <button
                          onClick={() => setExpandedTopic(isOpen ? null : topic)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 transition"
                        >
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          onClick={() => setConfirmClear(topic)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-700 text-zinc-500 hover:text-red-400 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded: individual questions */}
                    {isOpen && (
                      <div className="border-t border-zinc-700/50 px-3 pb-3 pt-2 space-y-1.5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-2">Specific questions you got wrong</p>
                        {questions.map((q, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-zinc-400 leading-relaxed">
                            <span className="text-red-500 flex-shrink-0 mt-0.5">✗</span>
                            <span>{typeof q === 'string' ? q : q.question || 'Unknown question'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Revision plan */}
              {!loading && totalCount > 0 && (
                <div className="pt-1">
                  <button
                    onClick={getRevision}
                    disabled={loadingRevision}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition"
                  >
                    <BookOpen size={14} className={loadingRevision ? 'animate-pulse' : ''} />
                    {loadingRevision ? 'Generating revision plan…' : '✨ Generate Full Revision Plan'}
                  </button>

                  {revision && (
                    <div className="mt-3 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-zinc-700 flex items-center gap-2">
                        <BookOpen size={13} className="text-purple-400" />
                        <p className="text-xs font-bold text-purple-300">Your Revision Plan</p>
                      </div>
                      <div className="p-4 max-h-52 overflow-y-auto scroll-smooth">
                        <div className="prose prose-invert prose-xs max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p:  ({ children }) => <p  className="text-xs text-zinc-300 mb-2 leading-relaxed">{children}</p>,
                              li: ({ children }) => <li className="text-xs text-zinc-300 leading-relaxed">{children}</li>,
                              strong: ({ children }) => <strong className="text-zinc-100 font-bold">{children}</strong>,
                            }}
                          >
                            {revision}
                          </ReactMarkdown>
                        </div>
                        {/* Scroll hint */}
                        <div className="sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-zinc-800 to-transparent pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!retryTopic && totalCount > 0 && (
          <div className="p-4 border-t border-zinc-800 flex-shrink-0">
            {confirmClear ? (
              <div className="flex items-center gap-3">
                <p className="text-xs text-zinc-400 flex-1">
                  {confirmClear === 'all'
                    ? 'Clear all weaknesses? This cannot be undone.'
                    : `Clear "${confirmClear}"?`}
                </p>
                <button
                  onClick={() => setConfirmClear(null)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => clear(confirmClear === 'all' ? null : confirmClear)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition"
                >
                  Clear
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear('all')}
                className="w-full text-xs text-zinc-600 hover:text-red-400 transition flex items-center justify-center gap-1"
              >
                <Trash2 size={11} /> Clear all weaknesses
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}