"use client";

import { useState } from "react";

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
          .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
          .catch(() => console.error('[CopyButton] Clipboard write failed'));
      }}
      className="text-xs text-zinc-400 hover:text-white transition"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}