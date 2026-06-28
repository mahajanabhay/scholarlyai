"use client";
import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, FileText, Loader2, BookOpen } from "lucide-react";
import { apiFetch } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function KnowledgePanel() {
  const [docs, setDocs]           = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState(null);
  const [msg, setMsg]             = useState(null);
  const fileRef                   = useRef();

  const load = () =>
    apiFetch(`${API_URL}/knowledge/documents`)
      .then(r => r.json())
      .then(d => setDocs(d.documents || []))
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
      setMsg({ ok: false, text: 'Only PDF files are supported.' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMsg({ ok: false, text: 'File exceeds 20MB limit.' });
      return;
    }
    setUploading(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await apiFetch(`${API_URL}/knowledge/upload`, {
        method: "POST",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.detail || "Upload failed." }); return; }
      setMsg({ ok: true, text: `${file.name} ingested successfully.` });
      load();
    } catch {
      setMsg({ ok: false, text: "Upload failed." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (filename) => {
    setDeleting(filename);
    setMsg(null);
    try {
      const r = await apiFetch(`${API_URL}/knowledge/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.detail || "Delete failed." }); return; }
      setMsg({ ok: true, text: `${filename} removed.` });
      load();
    } catch {
      setMsg({ ok: false, text: "Delete failed." });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <BookOpen size={18} className="text-violet-500" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Knowledge Base</h2>
          <p className="text-xs text-zinc-500">Upload PDFs for AI to reference</p>
        </div>
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-white/8 hover:border-violet-500/50 text-zinc-500 dark:text-zinc-400 hover:text-violet-500 transition-all text-sm font-semibold disabled:opacity-50"
      >
        {uploading
          ? <><Loader2 size={15} className="animate-spin" /> Ingesting...</>
          : <><Upload size={15} /> Upload PDF</>}
      </button>
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={upload} />

      {msg && (
        <p className={`text-xs font-semibold ${msg.ok ? "text-green-500" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-400 space-y-2">
            <FileText size={28} className="opacity-30" />
            <p className="text-xs">No documents uploaded yet</p>
          </div>
        ) : (
          docs.map(doc => (
            <div key={doc} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/3 border border-zinc-100 dark:border-white/6 group">
              <FileText size={15} className="text-violet-400 shrink-0" />
              <span className="flex-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{doc}</span>
              <button
                onClick={() => remove(doc)}
                disabled={deleting === doc}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-400"
              >
                {deleting === doc ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}