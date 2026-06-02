/**
 * markdownComponents.jsx
 *
 * Shared ReactMarkdown component maps used across the app.
 *
 * The core problem this file solves:
 *   ReactMarkdown wraps block elements (code, pre) in <p> tags by default.
 *   <pre> inside <p> is invalid HTML — browsers fix it by splitting the <p>,
 *   which React doesn't expect, causing a hydration mismatch crash.
 *
 * Fix: override `p` to render a <div> when its children contain a block-level
 * element (pre, code block, ul, ol, table, blockquote). This keeps the DOM
 * valid while preserving paragraph styling for pure-text content.
 */

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// ── Copy button for code blocks ───────────────────────────────────────────────
function CopyButton({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white text-[10px] font-medium transition opacity-0 group-hover:opacity-100"
      aria-label="Copy code"
    >
      {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  );
}

// ── Safe <p> wrapper ──────────────────────────────────────────────────────────
// Renders as <div> when children contain block-level elements,
// otherwise renders as a normal <p>. Prevents the <pre>-in-<p> crash.
function SafeParagraph({ children, ...props }) {
  const hasBlock = (() => {
    const kids = Array.isArray(children) ? children : [children];
    return kids.some(child => {
      if (!child || typeof child !== 'object') return false;
      const type = child.type;
      if (typeof type === 'string') {
        return ['pre', 'div', 'ul', 'ol', 'table', 'blockquote', 'h1', 'h2', 'h3'].includes(type);
      }
      // React component — treat as block to be safe
      return typeof type === 'function';
    });
  })();

  if (hasBlock) {
    return <div className="mb-3" {...props}>{children}</div>;
  }
  return <p className="mb-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300" {...props}>{children}</p>;
}

// ── Code block renderer ───────────────────────────────────────────────────────
function CodeBlock({ children, className, inline, ...props }) {
  const code = String(children).replace(/\n$/, '');
  const lang  = (className || '').replace('language-', '') || 'code';

  if (inline) {
    return (
      <code className="bg-zinc-100 dark:bg-zinc-800 text-orange-500 dark:text-orange-400 px-1.5 py-0.5 rounded text-[13px] font-mono">
        {code}
      </code>
    );
  }

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">{lang}</span>
      </div>
      <div className="relative">
        <pre className="bg-zinc-50 dark:bg-zinc-900 p-4 text-xs font-mono overflow-x-auto leading-relaxed text-zinc-800 dark:text-zinc-200 m-0">
          <code>{code}</code>
        </pre>
        <CopyButton code={code} />
      </div>
    </div>
  );
}

// ── Standard chat markdown ────────────────────────────────────────────────────
// Used for regular AI responses in the chat window.
export const mdComponents = {
  p:          (props) => <SafeParagraph {...props} />,
  pre:        ({ children }) => <>{children}</>,   // pre is handled by CodeBlock
  code:       (props) => <CodeBlock {...props} />,
  h1:         ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-zinc-900 dark:text-zinc-100">{children}</h1>,
  h2:         ({ children }) => <h2 className="text-base font-bold mt-3 mb-2 text-zinc-900 dark:text-zinc-100">{children}</h2>,
  h3:         ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1 text-zinc-800 dark:text-zinc-200">{children}</h3>,
  ul:         ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-zinc-700 dark:text-zinc-300 ml-2">{children}</ul>,
  ol:         ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-zinc-700 dark:text-zinc-300 ml-2">{children}</ol>,
  li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-violet-400 pl-3 italic text-zinc-500 dark:text-zinc-400 my-2 text-sm">{children}</blockquote>,
  hr:         () => <hr className="border-zinc-200 dark:border-zinc-700 my-4" />,
  a:          ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline">{children}</a>,
  table:      ({ children }) => <div className="overflow-x-auto my-3"><table className="text-xs border-collapse w-full">{children}</table></div>,
  th:         ({ children }) => <th className="border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 font-bold text-left">{children}</th>,
  td:         ({ children }) => <td className="border border-zinc-300 dark:border-zinc-700 px-3 py-1.5">{children}</td>,
  strong:     ({ children }) => <strong className="font-bold text-zinc-900 dark:text-zinc-100">{children}</strong>,
  em:         ({ children }) => <em className="italic text-zinc-600 dark:text-zinc-400">{children}</em>,
};

// ── Code-mode markdown ────────────────────────────────────────────────────────
// Used when mode === 'CODE'. Same as above but code blocks get
// a slightly more prominent style.
export const codeMdComponents = {
  ...mdComponents,
  code: (props) => <CodeBlock {...props} />,
  pre:  ({ children }) => <>{children}</>,
};