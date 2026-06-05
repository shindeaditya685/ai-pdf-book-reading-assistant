import Link from 'next/link'
import { BookOpen, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy',
  description: 'PDFMindAI Privacy Policy — how we collect, use, share, and protect your information.',
}

const sections = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide (account details, uploaded PDFs, annotations, bookmarks, flashcards, chat messages, support communications) and information collected automatically (usage data, device, browser, theme preferences, JWT token, local storage). When you click a word to get its meaning, the selected word and surrounding sentence are sent to Google Gemini and/or Groq for processing.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'We use your information to provide, maintain, and improve the Service; authenticate you; deliver AI-generated explanations, translations, and summaries; sync your data across devices; enable real-time collaborative reading sessions; generate anonymized usage analytics; detect and prevent abuse; and respond to support requests.',
  },
  {
    title: '3. Third-Party Services',
    body: 'We share data with the following third parties strictly to operate the Service: Google Gemini (AI word explanations, sentence simplification, summaries, question generation); Groq (primary AI word explanations, with Gemini fallback); MongoDB Atlas (database hosting); Tesseract.js (client-side OCR, runs entirely in your browser — no data sent); Web Speech API (browser-native TTS — no data sent). We do not sell your data. We do not share your data with advertisers.',
  },
  {
    title: '4. Cookies and Local Storage',
    body: 'The Service does not use tracking cookies. We use browser local storage for the JWT auth token, your translation language, TTS accent, theme preferences, and the currently open PDF (kept locally, cleared on logout). You can clear local storage from your browser settings at any time.',
  },
  {
    title: '5. Data Storage and Security',
    body: 'Data is stored in MongoDB Atlas (encrypted at rest by the cloud provider). Passwords are hashed with bcrypt (10 rounds) — we never store plain-text passwords. Authentication uses signed JWTs (HS256) with a 7-day expiry. The Service is served over HTTPS in production. We follow industry best practices, but no system is 100% secure.',
  },
  {
    title: '6. Data Retention',
    body: 'Account data is retained while your account is active and deleted within 30 days of account deletion, except where retention is required by law. Uploaded PDFs and annotations are retained while your account is active, or until you delete them. Reading history is retained for the lifetime of your account. Chat messages in collaborative sessions are retained while the session exists. Database backups may persist for up to 30 days after deletion.',
  },
  {
    title: '7. Your Rights',
    body: 'You have the right to access, correct, and delete the personal data we hold about you, and to export your data in a portable format. You can opt out of AI features by not clicking words; no AI calls are made until you trigger one. To exercise these rights, go to your Profile page or email privacy@pdfmindai.com. We will respond within 30 days.',
  },
  {
    title: '8. Children\'s Privacy',
    body: 'The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us personal information, contact privacy@pdfmindai.com and we will delete it.',
  },
  {
    title: '9. International Data Transfers',
    body: 'PDFMindAI uses providers that may process data in countries other than your own (e.g., Google and Groq in the US, MongoDB Atlas in various regions). By using the Service, you consent to the transfer of your data to these jurisdictions.',
  },
  {
    title: '10. Do Not Track',
    body: 'The Service does not track users across third-party websites and does not respond to Do Not Track signals.',
  },
  {
    title: '11. Changes to this Policy',
    body: 'We may update this Privacy Policy. If we make material changes, we will notify you by email or in-app notice at least 14 days before the changes take effect. The "Effective Date" at the top of this page reflects the latest revision.',
  },
  {
    title: '12. Contact',
    body: 'Questions or complaints about this Privacy Policy? Email us at privacy@pdfmindai.com. If you are in the European Economic Area, UK, or California and believe we have not addressed your concern, you have the right to lodge a complaint with your local data-protection authority.',
  },
]

const providerTable = [
  { name: 'Google Gemini', purpose: 'AI word explanations, simplification, summaries, question generation', data: 'Selected word, surrounding sentence, page number, target language', policy: 'policies.google.com/privacy' },
  { name: 'Groq', purpose: 'Primary AI word explanations (fallback to Gemini)', data: 'Same as above', policy: 'groq.com/privacy-policy' },
  { name: 'MongoDB Atlas', purpose: 'Database hosting', data: 'All persistent user data', policy: 'mongodb.com/legal/privacy-policy' },
  { name: 'Tesseract.js', purpose: 'OCR for image-only PDFs (client-side)', data: 'None — runs in your browser', policy: 'n/a' },
  { name: 'Web Speech API', purpose: 'Text-to-speech (browser-native)', data: 'None — runs in your browser', policy: 'n/a' },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-emerald-500/10 bg-background/60 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/20">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              PDFMind<span className="text-emerald-500">AI</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Legal</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective Date: 01 January 2026</p>
          <p className="mt-6 text-base leading-7 text-muted-foreground">
            This Privacy Policy explains how PDFMindAI ("the Service") collects, uses, shares, and protects your information. By using the Service, you agree to the practices described here.
          </p>
        </div>

        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-bold text-foreground">{s.title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-bold text-foreground">Third-Party Providers — Detail</h2>
          <div className="mt-3 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Data shared</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {providerTable.map((p) => (
                  <tr key={p.name}>
                    <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.purpose}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-16 rounded-xl border border-emerald-500/20 bg-emerald-50/30 p-6 dark:bg-emerald-950/10">
          <p className="text-sm text-foreground">
            By using PDFMindAI, you acknowledge that you have read and understood this Privacy Policy. For the full agreement, see our{' '}
            <Link href="/terms" className="font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="border-t py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500">
                <BookOpen className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">PDFMind<span className="text-emerald-500">AI</span></span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
              <span>&copy; 2026 PDFMindAI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
