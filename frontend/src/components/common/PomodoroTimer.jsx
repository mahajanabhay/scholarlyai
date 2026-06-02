"use client";
import { useState, useEffect, useRef } from 'react';
import { X, Timer, RotateCcw } from 'lucide-react';

export default function PomodoroTimer({ onClose }) {
  const MODES = {
    focus:  { label: "Focus",       minutes: 25, color: "text-rose-500" },
    short:  { label: "Short Break", minutes: 5,  color: "text-green-500" },
    long:   { label: "Long Break",  minutes: 15, color: "text-blue-500" },
  };

  const [timerMode, setTimerMode] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    setSecondsLeft(MODES[timerMode].minutes * 60);
    setIsRunning(false);
    clearInterval(intervalRef.current);
  }, [timerMode]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const reset = () => {
    setIsRunning(false);
    setSecondsLeft(MODES[timerMode].minutes * 60);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = 1 - secondsLeft / (MODES[timerMode].minutes * 60);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="absolute bottom-24 right-6 z-50 bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-2xl shadow-2xl p-4 w-56 select-none">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
          <Timer size={12} /> Pomodoro
        </span>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-1 mb-4">
        {Object.entries(MODES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setTimerMode(key)}
            className={`flex-1 text-[10px] font-bold py-1 rounded-lg transition ${
              timerMode === key
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {key === "focus" ? "Focus" : key === "short" ? "Short" : "Long"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center mb-4">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" width="96" height="96">
            <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor"
              className="text-zinc-100 dark:text-zinc-800" strokeWidth="6" />
            <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor"
              className={MODES[timerMode].color}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <span className={`text-xl font-bold tabular-nums ${MODES[timerMode].color}`}>
            {mm}:{ss}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setIsRunning(r => !r)}
          className="flex-1 py-2 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-80 transition"
        >
          {isRunning ? "Pause" : secondsLeft === 0 ? "Done!" : "Start"}
        </button>
        <button
          onClick={reset}
          className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}