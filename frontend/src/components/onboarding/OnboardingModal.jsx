"use client";
import { useState } from "react";
import { trackEvent, Events } from "@/lib/analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOTAL_QUIZ_QUESTIONS = 3;

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science",
  "History", "Geography", "Economics", "Literature", "Philosophy",
  "Psychology", "Law", "Medicine", "Engineering", "Languages"
];

export default function OnboardingModal({ userId, onComplete, apiFetch }) {
  const [step, setStep]           = useState(1);
  const [selected, setSelected]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [quizError, setQuizError] = useState("");

  const [sessionId]      = useState(() => `onboarding_${userId}_${Date.now()}`);
  const [questionNum, setQuestionNum]   = useState(1);
  const [currentQuestion, setCurrentQ]  = useState("");
  const [userAnswer, setUserAnswer]     = useState("");
  const [feedback, setFeedback]         = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [quizDone, setQuizDone]         = useState(false);

  const toggle = (s) =>
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const startQuiz = async () => {
    setLoading(true);
    setQuizError("");
    const subject = selected[0] || "General Knowledge";
    try {
      const fd = new FormData();
      fd.append("message", subject);
      fd.append("session_id", sessionId);
      fd.append("mode", "QUIZ");
      fd.append("quiz_type", "single");
      fd.append("question_number", "1");
      fd.append("is_starting", "true");
      fd.append("last_was_wrong", "false");
      fd.append("user_id", userId);
      const res = await apiFetch(`${API_URL}/quiz`, { method: "POST", body: fd });
      const data = await res.json();
      setCurrentQ(data.new_question || "");
      setQuestionNum(1);
      setStep(3);
    } catch (e) {
      setQuizError("Couldn't load quiz. You can skip and start studying.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim()) return;
    setLoading(true);
    const subject = selected[0] || "General Knowledge";
    try {
      const wasLastQuestion = questionNum >= TOTAL_QUIZ_QUESTIONS;

      // Extract correct answer letter from question before submitting
      const answerLine = currentQuestion.split('\n').find(l => l.trim().toUpperCase().startsWith('ANSWER:'));
      const correctLetter = answerLine ? answerLine.split(':')[1].trim().toUpperCase().charAt(0) : null;

      const fd = new FormData();
      fd.append("message", userAnswer.trim());
      fd.append("session_id", sessionId);
      fd.append("mode", "QUIZ");
      fd.append("quiz_type", "single");
      fd.append("question_number", String(questionNum + 1));
      fd.append("is_starting", "false");
      fd.append("last_question", currentQuestion);
      fd.append("user_id", userId);
      fd.append("last_was_wrong", "false");

      const res = await apiFetch(`${API_URL}/quiz`, { method: "POST", body: fd });
      const data = await res.json();

      const isCorrect = correctLetter
        ? userAnswer.trim().toUpperCase().charAt(0) === correctLetter
        : data.is_correct;
      if (isCorrect) setCorrectCount(c => c + 1);
      setFeedback(data.feedback || "");

      if (wasLastQuestion) {
        setQuizDone(true);
      } else {
        // brief pause to show feedback before next question
        setTimeout(() => {
          setCurrentQ(data.new_question || "");
          setQuestionNum(n => n + 1);
          setUserAnswer("");
          setFeedback("");
        }, 1800);
      }
    } catch (e) {
      setQuizError("Something went wrong grading that answer.");
    } finally {
      setLoading(false);
    }
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

        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "2rem" }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ flex: 1, height: "3px", borderRadius: "99px", background: n <= step ? "#7c5cfc" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
          ))}
        </div>

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
              <button onClick={selected.length > 0 ? startQuiz : saveAndComplete} disabled={loading} style={{ ...btnStyle, flex: 1, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Loading..." : selected.length === 0 ? "Skip →" : `Quick quiz on ${selected[0]} →`}
              </button>
            </div>
          </div>
        )}

        {step === 3 && !quizDone && (
          <div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.4rem", letterSpacing: "-0.02em" }}>
              Question {questionNum} of {TOTAL_QUIZ_QUESTIONS}
            </h2>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", margin: "0 0 1.25rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {currentQuestion.split('\n').filter(l => !l.trim().toUpperCase().startsWith('ANSWER:')).join('\n')}
            </p>
            <textarea
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              placeholder="Type your answer..."
              disabled={loading || !!feedback}
              rows={3}
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e8e8f0", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: "1rem", resize: "vertical" }}
            />
            {feedback && (
              <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginBottom: "1rem", whiteSpace: "pre-wrap" }}>
                {feedback}
              </p>
            )}
            {quizError && <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "1rem" }}>{quizError}</p>}
            <button
              onClick={submitAnswer}
              disabled={loading || !!feedback || !userAnswer.trim()}
              style={{ ...btnStyle, opacity: (loading || !!feedback || !userAnswer.trim()) ? 0.5 : 1 }}
            >
              {loading ? "Checking..." : "Submit →"}
            </button>
          </div>
        )}

        {step === 3 && quizDone && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎯</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>
              {correctCount}/{TOTAL_QUIZ_QUESTIONS} correct
            </h2>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)", margin: "0 0 2rem", lineHeight: 1.6 }}>
              {correctCount < TOTAL_QUIZ_QUESTIONS
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