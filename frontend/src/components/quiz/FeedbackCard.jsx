"use client";
export default function FeedbackCard({ feedback, score, total, isQuizComplete, remarkMath, rehypeKatex, ReactMarkdown }) {
  if (!feedback) return null;
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
  const acuracyColor = accuracy >= 80 ? 'text-green-600 dark:text-green-400' : accuracy >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  
  return (
    <div className="space-y-3 w-full">
      {isQuizComplete && score !== undefined && total !== undefined && (
        <div className="grid grid-cols-3 gap-2 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 p-4 rounded-xl border dark:border-zinc-700">
          <div className="text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold">Score</p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{score}/{total}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold">Accuracy</p>
            <p className={`text-2xl font-black mt-1 ${acuracyColor}`}>{accuracy}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold">Status</p>
            <p className={`text-sm font-bold mt-2 ${accuracy >= 80 ? 'text-green-600 dark:text-green-400' : accuracy >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              {accuracy >= 80 ? '✓ Great!' : accuracy >= 60 ? '○ Good' : '✗ Review'}
            </p>
          </div>
        </div>
      )}
      <div className="text-xs text-zinc-600 dark:text-zinc-400 border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 py-2 space-y-1 leading-relaxed bg-zinc-50 dark:bg-zinc-900 p-3 rounded">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {feedback}
        </ReactMarkdown>
      </div>
      {isQuizComplete && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 What's Next?</p>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
            <li>Review weak topics in the sidebar</li>
            <li>Take another quiz to improve</li>
            <li>Check your study plan</li>
          </ul>
        </div>
      )}
    </div>
  );
}