"use client";
import { useState } from "react";
export default function QuizCard({ content, onOptionSelected, isAnswered, quizType }) {
  const [selectedOption, setSelectedOption] = useState(null);

  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const questionText = lines[0] || "";
  const options = [];

  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^([A-D])\)\s+(.+)/i);
    if (match) {
      options.push({ letter: match[1].toUpperCase(), text: match[2] });
    }
  }

  const handleOptionClick = (letter) => {
    if (!isAnswered) {
      setSelectedOption(letter);
      onOptionSelected(letter);
    }
  };

  return (
    <div className="space-y-3 w-full">
      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
        {questionText}
      </p>
      <div className="flex flex-col gap-2">
        {options.map(opt => (
          <button
            key={opt.letter}
            onClick={() => handleOptionClick(opt.letter)}
            disabled={isAnswered}
            className={`flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
              selectedOption === opt.letter && isAnswered
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white'
                : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'
            } ${isAnswered && selectedOption !== opt.letter ? 'opacity-50' : ''}`}
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded border font-bold text-xs ${
              selectedOption === opt.letter && isAnswered
                ? 'bg-white dark:bg-black text-black dark:text-white border-white dark:border-black'
                : 'border-zinc-400 dark:border-zinc-500'
            }`}>
              {opt.letter}
            </span>
            <span>{opt.text}</span>
          </button>
        ))}
      </div>
      {isAnswered && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 italic">
          Answer submitted — next question coming…
        </p>
      )}
    </div>
  );
}