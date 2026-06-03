"use client";
import Link from "next/link";

export default function TermsPage() {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: `By accessing or using Clarix ("the Service"), provided by OAL Studios, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.`,
    },
    {
      title: "2. Description of Service",
      content: `Clarix is an AI-powered academic study assistant. It provides study sessions, quizzes, daily planners, weakness tracking, and related educational tools. The Service is intended solely for academic and educational use.`,
    },
    {
      title: "3. Eligibility",
      content: `You must be at least 13 years of age to use Clarix. By using the Service, you confirm that you meet this requirement. Users under 18 should have parental or guardian consent.`,
    },
    {
      title: "4. User Accounts",
      content: `You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. OAL Studios is not liable for any loss resulting from unauthorized account access.`,
    },
    {
      title: "5. Acceptable Use",
      content: `You agree not to misuse the Service. Prohibited activities include: attempting to circumvent the academic-only restrictions of the AI, uploading malicious files, using the Service for commercial resale without permission, attempting to reverse-engineer or scrape the platform, and any activity that violates applicable law.`,
    },
    {
      title: "6. AI-Generated Content",
      content: `Clarix uses large language models to generate educational responses. While we implement guardrails to improve accuracy, AI-generated content may occasionally contain errors. You should verify critical information with authoritative sources. OAL Studios is not liable for decisions made based on AI-generated content.`,
    },
    {
      title: "7. User-Uploaded Content",
      content: `You retain ownership of any files you upload (e.g. PDFs). By uploading, you grant OAL Studios a limited licence to process that content solely to provide the Service to you. We do not use your uploaded content to train AI models.`,
    },
    {
      title: "8. Privacy",
      content: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review it to understand how we collect and use your data.`,
    },
    {
      title: "9. Intellectual Property",
      content: `All platform code, design, branding, and non-user content belong to OAL Studios. You may not copy, reproduce, or distribute any part of the Service without written permission.`,
    },
    {
      title: "10. Termination",
      content: `We reserve the right to suspend or terminate your account at our discretion if you violate these Terms. You may delete your account at any time from your profile settings.`,
    },
    {
      title: "11. Disclaimer of Warranties",
      content: `The Service is provided "as is" without warranties of any kind. OAL Studios does not guarantee uninterrupted, error-free operation. We are not responsible for any loss of data or study progress.`,
    },
    {
      title: "12. Limitation of Liability",
      content: `To the fullest extent permitted by law, OAL Studios shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.`,
    },
    {
      title: "13. Changes to Terms",
      content: `We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the new Terms. We will notify users of significant changes via email or in-app notification.`,
    },
    {
      title: "14. Governing Law",
      content: `These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of India.`,
    },
    {
      title: "15. Contact",
      content: `For questions about these Terms, contact us at: legal@oalstudios.com`,
    },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif", background: "#0a0a0f", color: "#e8e8f0", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ padding: "1.25rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/landing" style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.15rem", fontWeight: 800, color: "#fff", textDecoration: "none" }}>
          Clarix<span style={{ color: "#7c5cfc" }}>.</span>
        </Link>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <Link href="/terms" style={{ fontSize: "0.85rem", color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}>Terms</Link>
          <Link href="/privacy" style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Privacy</Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "4rem 2rem 6rem" }}>
        <p style={{ fontSize: "0.8rem", color: "#7c5cfc", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Legal</p>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.5rem" }}>Terms of Service</h1>
        <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.3)", margin: "0 0 3rem" }}>Last updated: June 2025 · OAL Studios</p>

        <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "3rem", padding: "1.25rem 1.5rem", borderLeft: "2px solid #7c5cfc", background: "rgba(124,92,252,0.05)", borderRadius: "0 8px 8px 0" }}>
          Please read these Terms carefully before using Clarix. They set out your rights and responsibilities when using our Service.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {sections.map((s) => (
            <div key={s.title}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem", color: "#e8e8f0" }}>{s.title}</h2>
              <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: 0 }}>{s.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ padding: "2rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>Clarix<span style={{ color: "#7c5cfc" }}>.</span> by OAL Studios</span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <Link href="/terms" style={{ fontSize: "0.8rem", color: "#a78bfa", textDecoration: "none" }}>Terms</Link>
          <Link href="/privacy" style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>Privacy</Link>
        </div>
        <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.2)" }}>© 2025 OAL Studios</span>
      </footer>
    </div>
  );
}