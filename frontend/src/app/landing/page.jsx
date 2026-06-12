"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    {
      icon: "🧠",
      title: "Study-Only AI",
      desc: "Clarix refuses to drift. No jokes, no recipes, no distractions — only academic responses, every time.",
    },
    {
      icon: "📋",
      title: "Adaptive Quizzes",
      desc: "Single MCQs or full question papers. The AI tracks what you got wrong and drills you until you get it right.",
    },
    {
      icon: "📉",
      title: "Weakness Tracker",
      desc: "Every wrong answer is recorded. Clarix builds a personalised list of gaps and helps you close them.",
    },
    {
      icon: "🗓️",
      title: "AI Daily Planner",
      desc: "Generates a study plan from your weaknesses every morning. No guesswork on what to study next.",
    },
    {
      icon: "🏆",
      title: "XP & Streaks",
      desc: "Earn XP for every session, quiz, and plan completed. Build streaks that keep you coming back.",
    },
    {
      icon: "📚",
      title: "Knowledge Base",
      desc: "Upload your own PDFs. Clarix reads them and answers questions directly from your material.",
    },
  ];

  const steps = [
    { n: "01", title: "Sign up free", desc: "Create your account in seconds. No credit card required." },
    { n: "02", title: "Pick your subjects", desc: "Tell Clarix what you're studying. It personalises everything from day one." },
    { n: "03", title: "Start a session", desc: "Ask anything academic. Quiz yourself. Upload notes. Build your plan." },
    { n: "04", title: "Track your growth", desc: "Watch your XP rise, streaks hold, and weaknesses shrink over time." },
  ];

  const faqs = [
    { q: "Is Clarix free to use?", a: "Yes — Clarix is free to start. Advanced features will be available on a Pro plan coming soon." },
    { q: "What subjects does Clarix cover?", a: "All major academic disciplines — science, mathematics, history, literature, engineering, medicine, law, economics, philosophy, programming, and more." },
    { q: "Can I upload my own study material?", a: "Yes. Upload any PDF — textbooks, lecture notes, past papers — and Clarix will answer questions directly from your documents." },
    { q: "Why does Clarix refuse non-academic questions?", a: "By design. Most AI tools let you drift off-topic. Clarix stays locked to academics so your study sessions stay productive." },
    { q: "Is my data safe?", a: "All data is encrypted in transit and at rest. We never sell your data or use it to train models." },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0a0a0f", color: "#e8e8f0", minHeight: "100vh", overflowX: "hidden" }}>

      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 2rem",
        height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(10,10,15,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        transition: "all 0.3s ease",
      }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>
          Clarix
          <span style={{ color: "#7c5cfc", marginLeft: "2px" }}>.</span>
        </span>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <a href="#features" style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>Features</a>
          <a href="#how-it-works" style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>How it works</a>
          <a href="#faq" style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>FAQ</a>
          <button
            onClick={() => router.push("/login")}
            style={{ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "1px solid rgba(124,92,252,0.5)", background: "transparent", color: "#a78bfa", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Sign in
          </button>
          <button
            onClick={() => router.push("/signup")}
            style={{ padding: "0.45rem 1.1rem", borderRadius: "8px", border: "none", background: "#7c5cfc", color: "#fff", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
          >
            Get started
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6rem 2rem 4rem", textAlign: "center", position: "relative" }}>

        {/* Background glow */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "300px", background: "radial-gradient(ellipse, rgba(124,92,252,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 1rem", borderRadius: "999px", border: "1px solid rgba(124,92,252,0.3)", background: "rgba(124,92,252,0.08)", marginBottom: "2rem" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7c5cfc", display: "inline-block" }} />
          <span style={{ fontSize: "0.8rem", color: "#a78bfa", letterSpacing: "0.04em" }}>Now in open beta · Free to use</span>
        </div>

        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(2.8rem, 7vw, 5.5rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 1.5rem", maxWidth: "800px" }}>
          The AI that only
          <br />
          <span style={{ color: "#7c5cfc" }}>talks academics.</span>
        </h1>

        <p style={{ fontSize: "clamp(1rem, 2vw, 1.2rem)", color: "rgba(255,255,255,0.5)", maxWidth: "520px", lineHeight: 1.7, margin: "0 0 2.5rem" }}>
          Clarix is a strict, distraction-free study AI. Quizzes, planners, weakness tracking, and deep explanations — built for students who mean it.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => router.push("/signup")}
            style={{ padding: "0.85rem 2rem", borderRadius: "10px", border: "none", background: "#7c5cfc", color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em" }}
          >
            Start studying free →
          </button>
          <button
            onClick={() => document.getElementById("features").scrollIntoView({ behavior: "smooth" })}
            style={{ padding: "0.85rem 2rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: "1rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            See features
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "3rem", marginTop: "5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {[["6+", "Study modes"], ["100%", "Academic focus"], ["0", "Distractions"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "2rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>{val}</div>
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", marginTop: "0.25rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "6rem 2rem", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#7c5cfc", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>What Clarix does</p>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
            Everything you need.<br />Nothing you don't.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {features.map((f) => (
            <div key={f.title} style={{
              padding: "1.75rem",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              transition: "border-color 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(124,92,252,0.3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.5rem", letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: "6rem 2rem", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <p style={{ fontSize: "0.8rem", color: "#7c5cfc", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Getting started</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
              Up and studying in minutes.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem" }}>
            {steps.map((s, i) => (
              <div key={s.n} style={{ position: "relative" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "3rem", fontWeight: 800, color: "rgba(124,92,252,0.15)", lineHeight: 1, marginBottom: "0.75rem" }}>{s.n}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1rem", fontWeight: 700, margin: "0 0 0.5rem" }}>{s.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "6rem 2rem", maxWidth: "700px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#7c5cfc", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Common questions</p>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>FAQ</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", overflow: "hidden", background: openFaq === i ? "rgba(124,92,252,0.05)" : "transparent", transition: "background 0.2s" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: "100%", padding: "1.1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", color: "#e8e8f0", fontSize: "0.95rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                {f.q}
                <span style={{ fontSize: "1.25rem", color: "#7c5cfc", marginLeft: "1rem", flexShrink: 0, transform: openFaq === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 1.5rem 1.25rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "6rem 2rem", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "500px", height: "200px", background: "radial-gradient(ellipse, rgba(124,92,252,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 1rem", position: "relative" }}>
          Ready to study smarter?
        </h2>
        <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.4)", margin: "0 0 2.5rem", position: "relative" }}>
          Join thousands of students who study with strict focus and real results.
        </p>
        <button
          onClick={() => router.push("/signup")}
          style={{ padding: "1rem 2.5rem", borderRadius: "12px", border: "none", background: "#7c5cfc", color: "#fff", fontSize: "1.05rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em", position: "relative" }}
        >
          Start for free →
        </button>
        <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.2)", marginTop: "1rem", position: "relative" }}>No credit card required.</p>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "2rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>
          Clarix<span style={{ color: "#7c5cfc" }}>.</span> by OAL Studios
        </span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {["Privacy Policy", "Terms of Service", "Contact"].map(link => (
            <div key={link}>
              {link === "Privacy Policy" ? (
                <Link href="/privacy" style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>
                  {link}
                </Link>
              ) : link === "Terms of Service" ? (
                <Link href="/terms" style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>
                  {link}
                </Link>
              ) : (
                <a href="mailto:legal@oalstudios.com" style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>
                  {link}
                </a>
              )}
            </div>
          ))}
        </div>
        <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.2)" }}>© 2025 OAL Studios</span>
      </footer>

    </div>
  );
}