"use client";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science",
  "History", "Geography", "Economics", "Literature", "Philosophy",
  "Psychology", "Law", "Medicine", "Engineering", "Languages"
];

export default function OnboardingModal({ userId, onComplete, apiFetch }) {
  const [step, setStep]               = useState(1);
  const [selected, setSelected]       = useState([]);
  const [topic, setTopic]             = useState("");
  const [loading, setLoading]         = useState(false);

  const toggle = (s) =>
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const saveAndComplete = async () => {
    setLoading(true);
    try {
      // Save subject focus
      if (selected.length > 0) {
        const fd = new FormData();
        fd.append("subject_focus", JSON.stringify(selected));
        await apiFetch(`${API_URL}/profile/${userId}`, { method: "POST", body: fd });
      }
      // Mark onboarding complete
      await apiFetch(`${API_URL}/profile/${userId}/onboarding-complete`, { method: "POST" });
      onComplete(selected, topic);
      trackEvent(Events.ONBOARDING_DONE, { subjects: selected.length });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "2.5rem", width: "100%", maxWidth: "520px", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: "#e8e8f0" }}>

        {/* Progress */}
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "2rem" }}>
          {[1,2,3].map(n => (
            <div key={n} style={{ flex: 1, height: "3px", borderRadius: "99px", background: n <= step ? "#7c5cfc" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
          ))}
        </div>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>👋</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.75rem", letterSpacing: "-0.02em" }}>Welcome to Clarix.</h2>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: "0 0 2rem" }}>
              Clarix is your strict, distraction-free study AI. It only talks academics — no small talk, no off-topic answers. Let's set you up in 2 quick steps.
            </p>
            <button onClick={() => setStep(2)} style={btnStyle}>Get started →</button>
          </div>
        )}

        {/* Step 2 — Pick subjects */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.4rem", letterSpacing: "-0.02em" }}>What are you studying?</h2>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", margin: "0 0 1.5rem" }}>Pick all that apply. This personalises your quizzes and planner.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2rem" }}>
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  style={{
                    padding: "0.4rem 0.9rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    background: selected.includes(s) ? "#7c5cfc" : "rgba(255,255,255,0.05)",
                    color: selected.includes(s) ? "#fff" : "rgba(255,255,255,0.5)",
                    border: selected.includes(s) ? "1px solid #7c5cfc" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >{s}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setStep(1)} style={backBtnStyle}>← Back</button>
              <button onClick={() => setStep(3)} style={{ ...btnStyle, flex: 1 }}>
                {selected.length === 0 ? "Skip →" : `Continue with ${selected.length} subject${selected.length > 1 ? "s" : ""} →`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — First topic */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.4rem", letterSpacing: "-0.02em" }}>What do you want to study first?</h2>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", margin: "0 0 1.5rem" }}>Enter any topic — Clarix will explain it, quiz you, and track your progress.</p>
            <input
              type="text"
              placeholder="e.g. Photosynthesis, Newton's Laws, World War II..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8e8f0", fontSize: "0.95rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: "1.5rem" }}
            />
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setStep(2)} style={backBtnStyle}>← Back</button>
              <button onClick={saveAndComplete} disabled={loading} style={{ ...btnStyle, flex: 1 }}>
                {loading ? "Setting up..." : "Start studying →"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const btnStyle = {
  width: "100%", padding: "0.85rem", borderRadius: "10px", border: "none",
  background: "#7c5cfc", color: "#fff", fontSize: "0.95rem", fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};

const backBtnStyle = {
  padding: "0.85rem 1.25rem", borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
  color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit",
};