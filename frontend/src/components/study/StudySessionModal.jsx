"use client";
import { useState } from 'react';
import { GraduationCap, AlertTriangle, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "History", "Geography", "Economics", "Computer Science",
  "Literature", "Psychology", "Philosophy", "Law",
];

export default function StudySessionModal({ userId, onClose, onStartQuiz }) {
  const [step, setStep]               = useState('pick');   // 'pick' | 'running' | 'results'
  const [subject, setSubject]         = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [questions, setQuestions]     = useState([]);       // [{q, options, correctHint}]
  const [answers, setAnswers]         = useState([]);       // user selected letters
  const [feedbacks, setFeedbacks]     = useState([]);
  const [currentQ, setCurrentQ]       = useState(0);
  const [loading, setLoading]         = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [score, setScore]             = useState(0);
  const [weakTopics, setWeakTopics]   = useState([]);
  const TOTAL = 5;

  const finalSubject = subject === '__custom__' ? customSubject.trim() : subject;

  const startSession = async () => {
    if (!finalSubject) return;
    setLoading(true);
    setStep('running');
    const sid = `study_${userId}_${Date.now()}`;
    setSessionId(sid);
    const data = await fetchNextQuestion(null, null, 1, true, sid);
    if (data?.new_question) setQuestions([data.new_question]);
    setLoading(false);
  };

  const fetchNextQuestion = async (prevAnswer, prevQ, qNum, isStart, sid = sessionId) => {
    const fd = new FormData();
    fd.append('message',         isStart ? finalSubject : prevAnswer);
    fd.append('session_id', sid);
    fd.append('mode',            'QUIZ');
    fd.append('quiz_type',       'single');
    fd.append('question_number', qNum);
    fd.append('is_starting',     isStart ? 'true' : 'false');
    fd.append('user_id',         userId);
    fd.append('last_was_wrong',  'false');
    if (prevQ) fd.append('last_question', prevQ);
    const r    = await apiFetch(`${API_URL}/quiz`, { method: 'POST', body: fd });
    const data = await r.json();
    return data;
  };

  const handleAnswer = async (letter, qText) => {
    const newAnswers = [...answers, letter];
    setAnswers(newAnswers);
    setLoading(true);

    // Grade via quiz API feedback
    const fd = new FormData();
    fd.append('message',         letter);
    fd.append('session_id',      sessionId);
    fd.append('mode',            'QUIZ');
    fd.append('quiz_type',       'single');
    fd.append('question_number', currentQ + 2);
    fd.append('is_starting',     'false');
    fd.append('user_id',         userId);
    fd.append('last_question',   qText);
    fd.append('last_was_wrong',  'false');
    const r    = await apiFetch(`${API_URL}/quiz`, { method: 'POST', body: fd });
    const data = await r.json();

    const fb = data.feedback || '';
    const newFeedbacks = [...feedbacks, fb];
    setFeedbacks(newFeedbacks);

    const wrong = fb.toLowerCase().includes('incorrect') || fb.toLowerCase().includes('wrong') || fb.toLowerCase().includes('not correct');
    if (wrong) setWeakTopics(prev => [...prev, finalSubject]);

    if (currentQ + 1 < TOTAL) {
      // Use next question returned
      setQuestions(prev => [...prev, data.new_question]);
      setCurrentQ(currentQ + 1);
    } else {
      // Done
      const correctCount = newFeedbacks.filter(f =>
        !f.toLowerCase().includes('incorrect') && !f.toLowerCase().includes('wrong') && !f.toLowerCase().includes('not correct')
      ).length;
      setScore(correctCount);
      setStep('results');
    }
    setLoading(false);
  };

  // Parse MCQ question string into {text, options[]}
  const parseQuestion = (raw) => {
    if (!raw) return { text: '', options: [] };
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const text = lines[0] || '';
    const options = [];
    for (let i = 1; i < lines.length; i++) {
      const m = lines[i].match(/^([A-D])\)\s+(.+)/i);
      if (m) options.push({ letter: m[1].toUpperCase(), text: m[2] });
    }
    return { text, options };
  };

  const currentQuestion = questions[currentQ] || null;
  const parsed = parseQuestion(currentQuestion);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-120 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <GraduationCap size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Study Session</h2>
              <p className="text-[10px] text-zinc-400">
                {step === 'pick' ? 'Choose a subject to begin' : step === 'running' ? `Question ${currentQ + 1} of ${TOTAL} · ${finalSubject}` : 'Session Complete!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* STEP 1 — Pick subject */}
          {step === 'pick' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Select a subject</p>
              <div className="grid grid-cols-3 gap-2">
                {SUBJECTS.map(s => (
                  <button key={s} onClick={() => setSubject(s)}
                    className={`text-xs py-2.5 px-2 rounded-xl border font-medium transition text-center ${subject === s ? 'bg-violet-600 text-white border-violet-600' : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500'}`}>
                    {s}
                  </button>
                ))}
                <button onClick={() => setSubject('__custom__')}
                  className={`text-xs py-2.5 px-2 rounded-xl border font-medium transition text-center col-span-3 ${subject === '__custom__' ? 'bg-violet-600 text-white border-violet-600' : 'border-zinc-200 dark:border-zinc-700 hover:border-violet-400'}`}>
                  ✏️ Other / Custom
                </button>
              </div>
              {subject === '__custom__' && (
                <input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
                  placeholder="e.g. Organic Chemistry, World War II…"
                  className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl px-3 py-2 outline-none mt-1" />
              )}
              <button onClick={startSession} disabled={!finalSubject || loading}
                className="w-full py-3 rounded-xl bg-linear-to-r from-violet-600 to-blue-600 text-white font-bold text-sm disabled:opacity-40 transition hover:opacity-90">
                {loading ? 'Loading first question…' : `Start 5-Question Session →`}
              </button>
            </div>
          )}

          {/* STEP 2 — Running quiz */}
          {step === 'running' && (
            <div className="space-y-4">
              {/* Progress dots */}
              <div className="flex gap-2 justify-center">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <div key={i} className={`h-2 flex-1 rounded-full transition-all ${i < currentQ ? 'bg-violet-500' : i === currentQ ? 'bg-violet-300 animate-pulse' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                ))}
              </div>

              {loading && !currentQuestion && (
                <div className="flex justify-center py-8 text-zinc-400 text-sm gap-2">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                </div>
              )}

              {currentQuestion && (
                <div className="space-y-3">
                  <p className="font-semibold text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">{parsed.text}</p>
                  <div className="space-y-2">
                    {parsed.options.map(opt => (
                      <button key={opt.letter} onClick={() => !loading && handleAnswer(opt.letter, parsed.text)}
                        disabled={loading}
                        className="flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-sm transition disabled:opacity-50">
                        <span className="flex items-center justify-center w-6 h-6 rounded border border-zinc-300 dark:border-zinc-600 font-bold text-xs shrink-0">{opt.letter}</span>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                  {loading && <p className="text-xs text-zinc-400 text-center animate-pulse">Checking answer…</p>}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Results */}
          {step === 'results' && (
            <div className="space-y-4">
              {/* Score ring */}
              <div className="flex flex-col items-center gap-2 py-3">
                <div className={`text-5xl font-black ${score >= 4 ? 'text-green-500' : score >= 2 ? 'text-amber-500' : 'text-red-500'}`}>
                  {score}/{TOTAL}
                </div>
                <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  {score >= 4 ? '🎉 Excellent work!' : score >= 2 ? '👍 Good effort — keep going!' : '💪 Needs more practice'}
                </p>
              </div>

              {/* Per-question breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Question Breakdown</p>
                {questions.slice(0, TOTAL).map((q, i) => {
                  const fb = feedbacks[i] || '';
                  const wrong = data.is_correct === false;
                  const qParsed = parseQuestion(q);
                  return (
                    <div key={i} className={`p-3 rounded-xl border text-xs ${wrong ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'}`}>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">{wrong ? '❌' : '✅'}</span>
                        <div>
                          <p className="font-medium text-zinc-800 dark:text-zinc-200 leading-snug">{qParsed.text}</p>
                          {fb && <p className="text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{fb.slice(0, 180)}{fb.length > 180 ? '…' : ''}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weaknesses callout */}
              {weakTopics.length > 0 && (
                <div className="p-3 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
                  <p className="text-xs font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1 mb-1">
                    <AlertTriangle size={12} /> Weakness detected in: <span className="underline">{finalSubject}</span>
                  </p>
                  <p className="text-[10px] text-orange-600 dark:text-orange-400">
                    {weakTopics.length} wrong answer{weakTopics.length > 1 ? 's' : ''} logged to your Weakness Tracker automatically.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'results' && (
          <div className="p-4 border-t dark:border-zinc-800 flex gap-2">
            <button onClick={() => { setStep('pick'); setQuestions([]); setAnswers([]); setFeedbacks([]); setCurrentQ(0); setWeakTopics([]); setSubject(''); }}
              className="flex-1 py-2 rounded-xl border dark:border-zinc-700 text-sm font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
              Try Another
            </button>
            {weakTopics.length > 0 && (
              <button onClick={() => { onStartQuiz(finalSubject); onClose(); }}
                className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition">
                Practice Again →
              </button>
            )}
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold transition">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}