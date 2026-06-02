"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { FileText, Eye, EyeOff, Loader2, CheckSquare } from "lucide-react";

/**
 * QuestionPaperView
 *
 * Renders a generated exam question paper (markdown string) with a
 * "Show Answers" button that fetches model answers from the backend.
 *
 * Props:
 *   paper            {string}   — markdown content of the question paper
 *   onShowAnswers    {function} — async callback that fetches answers
 *   isLoadingAnswers {boolean}  — true while answers are being fetched
 *   answers          {string|null} — markdown answer key once loaded
 */
export default function QuestionPaperView({
  paper,
  onShowAnswers,
  isLoadingAnswers,
  answers,
}) {
  const [showAnswers, setShowAnswers] = useState(false);

  const handleToggleAnswers = async () => {
    // Fetch on first reveal only
    if (!answers && !isLoadingAnswers) {
      await onShowAnswers();
    }
    setShowAnswers((prev) => !prev);
  };

  return (
    <div className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
        <FileText size={15} className="text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 tracking-wide uppercase">
          Question Paper
        </span>
      </div>

      {/* Paper content */}
      <div className="px-5 py-4 text-sm text-zinc-800 dark:text-zinc-200 prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {paper}
        </ReactMarkdown>
      </div>

      {/* Show / Hide answers */}
      <div className="px-5 pb-5">
         <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
          💡 Type a new request below to generate a different paper
        </p>
        <button
          onClick={handleToggleAnswers}
          disabled={isLoadingAnswers}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all
            bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300
            border border-amber-200 dark:border-amber-700
            hover:bg-amber-100 dark:hover:bg-amber-900/50
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingAnswers ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Loading answers…
            </>
          ) : showAnswers && answers ? (
            <>
              <EyeOff size={13} />
              Hide Answers
            </>
          ) : (
            <>
              <Eye size={13} />
              Show Model Answers
            </>
          )}
        </button>

        {/* Answer key */}
        {showAnswers && answers && (
          <div className="mt-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <CheckSquare size={13} className="text-green-600 dark:text-green-400" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                Model Answers
              </span>
            </div>
            <div className="text-xs text-green-900 dark:text-green-100 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {answers}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}