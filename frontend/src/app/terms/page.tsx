import Link from 'next/link'
import { BookOpen, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service',
  description: 'PDFMindAI Terms of Service — the rules and conditions for using our AI PDF reading assistant.',
}

const sections = [
  {
    title: '1. Eligibility',
    body: 'You must be at least 13 years old to use the Service. If you are under 18, you represent that you have your parent or guardian\'s permission.',
  },
  {
    title: '2. Accounts',
    body: 'You must provide accurate information when creating an account. You are responsible for safeguarding your password. We are not liable for any loss caused by unauthorized access to your account. You may not share your account credentials with others. Notify us immediately upon learning of any unauthorized use.',
  },
  {
    title: '3. Use of the Service',
    body: 'PDFMindAI is an AI-powered PDF reading assistant. You may use it to upload and view PDFs, receive AI-generated word explanations, translations, and summaries, save bookmarks and flashcards, and participate in collaborative reading sessions you have been invited to.',
  },
  {
    title: '4. User Content',
    body: 'You retain ownership of your User Content (PDFs, annotations, comments, notes, chat messages, etc.). You grant PDFMindAI a worldwide, non-exclusive, royalty-free license to host and process your User Content solely to operate the Service for you. You are solely responsible for your User Content and represent that you have the right to upload it and that it does not infringe any third-party rights or contain unlawful material.',
  },
  {
    title: '5. Acceptable Use',
    body: 'You agree NOT to upload copyrighted material you do not have the right to use, upload malware or harmful content, harass or harm others, attempt to gain unauthorized access, scrape or crawl the Service, reverse engineer the Service, use the Service to build a competing product, or interfere with the Service or its security features.',
  },
  {
    title: '6. AI-Generated Content',
    body: 'The Service uses artificial intelligence (Google Gemini and Groq LLMs) to generate word explanations, translations, and summaries. AI Output is provided for informational and educational purposes only and may be inaccurate or incomplete. Do not rely on AI Output as the sole source for important decisions (medical, legal, financial, academic). When you use an AI feature, the selected word and surrounding sentence are sent to third-party AI providers (Google and Groq) — do not use the Service on documents containing sensitive personal information you do not wish to share with those providers.',
  },
  {
    title: '7. Third-Party Services',
    body: 'The Service integrates with Google Gemini API, Groq API, MongoDB Atlas, Web Speech API (browser-native), and Tesseract.js (client-side OCR). Your use of these services is subject to their respective terms and privacy policies. Tesseract.js OCR and Web Speech API run entirely in your browser; no data is sent to a server for those features.',
  },
  {
    title: '8. Subscriptions and Payments',
    body: 'If we offer paid plans in the future, the pricing, billing cycle, and refund policy will be presented at the time of purchase.',
  },
  {
    title: '9. Intellectual Property',
    body: 'The Service, including its design, code, features, branding, and trademarks, is owned by PDFMindAI and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works of the Service.',
  },
  {
    title: '10. Collaborative Sessions',
    body: 'When you create a collaborative reading session, you are the session owner and can invite other users by sharing the invite code. You are responsible for the users you invite and the content shared in your session. We may delete sessions that violate these Terms.',
  },
  {
    title: '11. Termination',
    body: 'We may suspend or terminate your account and access to the Service at any time, with or without notice, for conduct that violates these Terms or is otherwise harmful to other users or the Service. You may delete your account at any time from the Profile page.',
  },
  {
    title: '12. Disclaimers',
    body: 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.',
  },
  {
    title: '13. Limitation of Liability',
    body: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, PDFMINDIAI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR GOODWILL. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED USD $100 OR THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM, WHICHEVER IS GREATER.',
  },
  {
    title: '14. Indemnification',
    body: 'You agree to indemnify and hold PDFMindAI harmless from any claim, demand, loss, or expense arising from your use of the Service, your User Content, or your violation of these Terms.',
  },
  {
    title: '15. Governing Law and Disputes',
    body: 'These Terms are governed by the laws of the jurisdiction in which PDFMindAI operates, without regard to conflict-of-law rules. Any dispute shall be resolved in the competent courts of that jurisdiction.',
  },
  {
    title: '16. Changes to these Terms',
    body: 'We may update these Terms from time to time. If we make material changes, we will notify you by email or in-app notice at least 14 days before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the new Terms.',
  },
  {
    title: '17. Contact',
    body: 'Questions about these Terms? Email us at legal@pdfmindai.com.',
  },
]

export default function TermsPage() {
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
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective Date: 01 January 2026</p>
          <p className="mt-6 text-base leading-7 text-muted-foreground">
            By accessing or using PDFMindAI (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.
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

        <div className="mt-16 rounded-xl border border-emerald-500/20 bg-emerald-50/30 p-6 dark:bg-emerald-950/10">
          <p className="text-sm text-foreground">
            By using PDFMindAI, you acknowledge that you have read, understood, and agreed to these Terms of Service and our{' '}
            <Link href="/privacy" className="font-semibold text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">
              Privacy Policy
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
              <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
              <span>&copy; 2026 PDFMindAI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
