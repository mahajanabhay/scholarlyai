"use client";
import { useState } from "react";
import { trackEvent, Events } from "@/lib/analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science",
  "History", "Geography", "Economics", "Literature", "Philosophy",
  "Psychology", "Law", "Medicine", "Engineering", "Languages"
];

export default function OnboardingModal({ userId, onComplete, apiFetch }) {
  const [step, setStep]         = useState(1);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});
  const [quizDone, setQuizDone]   = useState(false);
  const [quizError, setQuizError] = useState("");

  const toggle = (s) =>
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const loadQuiz = async () => {
    setLoading(true);
    setQuizError("");
    const subject = selected[0] || "General Knowledge";
    try {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("num_questions", "3");
      fd.append("difficulty", "medium");
      const res = await apiFetch(`${API_URL}/quiz/generate`, { method: "POST", body: fd });
      const data = await res.json();
      setQuestions(data.questions || []);
      setStep(3);
    } catch (e) {
      setQuizError("Couldn't load quiz. You can skip and start studying.");
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async () => {
    setLoading(true);
    const subject = selected[0] || "General Knowledge";
    const wrongTopics = questions
      .filter((q, i) => answers[i] !== q.answer)
      .map(q => q.question);

    try {
      // Record weaknesses from wrong answers
      if (wrongTopics.length > 0) {
        const fd = new FormData();
        fd.append("subject", subject);
        fd.append("wrong_topics", JSON.stringify(wrongTopics));
        fd.append("score", String(questions.length - wrongTopics.length));
        fd.append("total", String(questions.length));
        await apiFetch(`${API_URL}/study-session/results`, { method: "POST", body: fd });
      }
    } catch (e) {
      console.error("Weakness recording failed", e);
    }

    setQuizDone(true);
    setLoading(false);
  };

  const saveAndComplete = async () => {
    setLoading(true);
    try {
      if (selected.length > 0) {
        const fd = new FormData();
        fd.append("subject_focus", JSON.stringify(selected));
        await apiFetch(`${API_URL}/profile/${userId}`, { method: "POST", body: fd });
      }
      await apiFetch(`${API_URL}/profile/${userId}/onboarding-complete`, { method: "POST" });
      onComplete(selected);
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
          {[1, 2, 3].map(n => (
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
                <button key={s} onClick={() => toggle(s)} style={{
                  padding: "0.4rem 0.9rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  background: selected.includes(s) ? "#7c5cfc" : "rgba(255,255,255,0.05)",
                  color: selected.includes(s) ? "#fff" : "rgba(255,255,255,0.5)",
                  border: selected.includes(s) ? "1px solid #7c5cfc" : "1px solid rgba(255,255,255,0.08)",
                }}>{s}</button>
              ))}
            </div>
            {quizError && <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "1rem" }}>{quizError}</p>}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setStep(1)} style={backBtnStyle}>←</button>
              <button onClick={selected.length > 0 ? loadQuiz : saveAndComplete} disabled={loading} style={{ ...btnStyle, flex: 1, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Loading..." : selected.length === 0 ? "Skip →" : `Quick quiz on ${selected[0]} →`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Mini quiz */}
        {step === 3 && !quizDone && (
          <div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.4rem", letterSpacing: "-0.02em" }}>Quick baseline quiz</h2>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", margin: "0 0 1.5rem" }}>3 questions on {selected[0]} — helps Clarix find your weak spots instantly.</p>
            {questions.map((q, i) => (
              <div key={i} style={{ marginBottom: "1.25rem" }}>
                <p style={{ fontSize: "0.9rem", fontWeight: 500, margin: "0 0 0.6rem" }}>{i + 1}. {q.question}</p>
                {["A", "B", "C", "D"].map(opt => (
                  q.options?.[opt] && (
                    <button key={opt} onClick={() => setAnswers(a => ({ ...a, [i]: opt }))} style={{
                      display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "0.35rem", transition: "all 0.15s",
                      background: answers[i] === opt ? "#7c5cfc" : "rgba(255,255,255,0.04)",
                      color: answers[i] === opt ? "#fff" : "rgba(255,255,255,0.6)",
                      border: answers[i] === opt ? "1px solid #7c5cfc" : "1px solid rgba(255,255,255,0.08)",
                    }}>{opt}) {q.options[opt]}</button>
                  )
                ))}
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setStep(2)} style={backBtnStyle}>←</button>
              <button
                onClick={submitQuiz}
                disabled={loading || Object.keys(answers).length < questions.length}
                style={{ ...btnStyle, flex: 1, opacity: (loading || Object.keys(answers).length < questions.length) ? 0.5 : 1 }}
              >
                {loading ? "Saving..." : "Submit →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 done — results */}
        {step === 3 && quizDone && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎯</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>
              {questions.filter((q, i) => answers[i] === q.answer).length}/{questions.length} correct
            </h2>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", margin: "0 0 2rem", lineHeight: 1.6 }}>
              {questions.filter((q, i) => answers[i] !== q.answer).length > 0
                ? "Clarix has noted your weak areas and will target them in your planner."
                : "Perfect score! Clarix will keep challenging you."}
            </p>
            <button onClick={saveAndComplete} disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1 }}>
              {loading ? "Setting up..." : "Go to dashboard →"}
            </button>
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