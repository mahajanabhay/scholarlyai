import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "ScholarlyAI — Your AI Study Partner",
  description: "Learn, quiz, summarise and analyse any topic with ScholarlyAI. Upload your textbooks and study smarter.",
  keywords: "ScholarlyAI, study, AI, quiz, learning, education",
  authors: [{ name: "ScholarlyAI" }],
  openGraph: {
    title: "ScholarlyAI — Your AI Study Partner",
    description: "Learn, quiz, summarise and analyse any topic with ScholarlyAI",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}