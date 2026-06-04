"use client";
import Link from "next/link";

export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Who We Are",
      content: `Clarix is a product of OAL Studios. We build academic tools for students. For privacy-related questions, contact us at privacy@oalstudios.com.`,
    },
    {
      title: "2. What Data We Collect",
      content: `We collect: (a) Account data — your name, email address, and hashed password when you register. (b) Usage data — study sessions, quiz results, XP, streaks, planner tasks, and weakness records. (c) Uploaded content — PDFs you upload to the knowledge base. (d) Technical data — IP address, browser type, and basic device information for security and rate-limiting purposes.`,
    },
    {
      title: "3. How We Use Your Data",
      content: `We use your data to: provide and personalise the Service, generate your study plans and weakness reports, send verification and transactional emails, maintain security and prevent abuse, and improve the platform's reliability. We do not use your data for advertising or to train AI models.`,
    },
    {
      title: "4. Data Storage",
      content: `Your data is stored in a PostgreSQL database hosted on secured servers. Uploaded PDFs are stored on the same server and processed locally using vector embeddings. All data is encrypted in transit via HTTPS.`,
    },
    {
      title: "5. Data Retention",
      content: `We retain your account data for as long as your account is active. If you delete your account, all associated data — including chat history, quiz records, uploaded files, and profile information — is permanently deleted within 30 days.`,
    },
    {
      title: "6. Sharing of Data",
      content: `We do not sell your data. We do not share your personal data with third parties except: (a) service providers necessary to operate the platform (e.g. email delivery), under strict data processing agreements; (b) when required by law or to protect the rights of OAL Studios.`,
    },
    {
      title: "7. Cookies",
      content: `Clarix does not use tracking cookies or advertising cookies. We use localStorage in your browser solely to store your authentication token and session preferences. No third-party analytics or ad-tracking scripts are loaded.`,
    },
    {
      title: "8. Your Rights",
      content: `You have the right to: access the personal data we hold about you, request correction of inaccurate data, request deletion of your account and all associated data, export your study history, and withdraw consent at any time by deleting your account. To exercise these rights, email privacy@oalstudios.com.`,
    },
    {
      title: "9. Children's Privacy",
      content: `Clarix is not directed at children under 13. We do not knowingly collect personal data from children under 13. If we become aware that we have collected such data, we will delete it promptly.`,
    },
    {
      title: "10. Security",
      content: `We implement industry-standard security measures including password hashing (bcrypt), JWT-based authentication with expiry, rate limiting on all endpoints, and HTTPS-only access. No system is 100% secure — we encourage you to use a strong, unique password.`,
    },
    {
      title: "11. Changes to This Policy",
      content: `We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance.`,
    },
    {
      title: "12. Contact",
      content: `For any privacy-related questions or requests, contact: privacy@oalstudios.com`,
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
          <Link href="/terms" style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Terms</Link>
          <Link href="/privacy" style={{ fontSize: "0.85rem", color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}>Privacy</Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "4rem 2rem 6rem" }}>
        <p style={{ fontSize: "0.8rem", color: "#7c5cfc", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Legal</p>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.5rem" }}>Privacy Policy</h1>
        <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.3)", margin: "0 0 3rem" }}>Last updated: June 2025 · OAL Studios</p>

        <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: "3rem", padding: "1.25rem 1.5rem", borderLeft: "2px solid #7c5cfc", background: "rgba(124,92,252,0.05)", borderRadius: "0 8px 8px 0" }}>
          Your privacy matters to us. This policy explains what data we collect, how we use it, and your rights regarding your information.
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
          <Link href="/terms" style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>Terms</Link>
          <Link href="/privacy" style={{ fontSize: "0.8rem", color: "#a78bfa", textDecoration: "none" }}>Privacy</Link>
        </div>
        <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.2)" }}>© 2025 OAL Studios</span>
      </footer>
    </div>
  );
}