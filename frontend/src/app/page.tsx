import Link from 'next/link'
import { BookOpen, Sparkles, Brain, Users, Bookmark, Clock, Languages, Volume2, Search, ArrowRight, Zap, Shield, BarChart3, GraduationCap, Globe, MessageSquare, Layers, SunMoon, ChevronRight } from 'lucide-react'
import { LandingNav } from '@/components/landing-nav'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 border-b border-emerald-500/10 bg-background/60 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/20">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">PDFMind<span className="text-emerald-500">AI</span></span>
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">v2.0</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/about"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              About
            </Link>
            <LandingNav />
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--emerald-500)/0.08)_0%,transparent_50%,hsl(var(--emerald-500)/0.03)_100%)]" />
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              AI-Powered PDF Reading Assistant
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Read Smarter, Not Harder
            </h1>
            <p className="mt-6 text-lg leading-7 text-muted-foreground sm:text-xl">
              Upload any PDF and unlock AI-powered word explanations, instant translations, text-to-speech, flashcards, collaborative reading groups, and detailed reading analytics — all in one beautiful workspace.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.97]"
              >
                Start Reading Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border bg-background px-8 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.97]"
              >
                Sign In
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground/60">
              No credit card required · Free to use · 100+ languages supported
            </p>
          </div>

          {/* ── HERO FEATURES GRID ── */}
          <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Brain, label: 'AI Word Explanations', desc: 'Click any word for instant contextual meaning, pronunciation, and translation.' },
              { icon: Languages, label: 'Multi-Language', desc: 'Translate words into 100+ languages. Pashto, Farsi, Dutch, and more.' },
              { icon: Volume2, label: 'Text-to-Speech', desc: 'Listen to any text with natural voices. Adjust speed and accent.' },
              { icon: Users, label: 'Collaborative Groups', desc: 'Read together in real-time. Share highlights, notes, and comments.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="group rounded-xl border bg-background/60 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="mt-4 text-sm font-bold text-foreground">{label}</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="border-b py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">How It Works</h2>
            <p className="mt-4 text-muted-foreground">Three simple steps to transform your reading experience.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              { step: '01', icon: BookOpen, title: 'Upload Your PDF', desc: 'Drag and drop any PDF document. Your reading progress, bookmarks, and highlights are saved automatically.' },
              { step: '02', icon: Sparkles, title: 'Read with AI', desc: 'Click any word to get an AI-powered explanation. Hear pronunciation, see translations, and save flashcards.' },
              { step: '03', icon: BarChart3, title: 'Track & Collaborate', desc: 'Monitor your reading stats, join collaborative sessions, and review flashcards to reinforce learning.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="relative rounded-xl border bg-background/60 p-6 shadow-sm">
                <span className="text-4xl font-black text-emerald-500/20">{step}</span>
                <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="border-b py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Everything You Need</h2>
            <p className="mt-4 text-muted-foreground">Powerful features designed for deep reading and language learning.</p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Brain, title: 'AI Word Lookup', desc: 'Select any word and get contextual meanings powered by Groq AI with Gemini fallback. No more context switching to a dictionary.' },
              { icon: Globe, title: '100+ Languages', desc: 'Translate words and sentences into any language. Perfect for language learners reading foreign texts.' },
              { icon: Volume2, title: 'Text-to-Speech', desc: 'Full-page TTS with adjustable speed and multiple accent options. Great for auditory learning and pronunciation.' },
              { icon: Bookmark, title: 'Smart Bookmarks', desc: 'Save words with their meanings, pronunciations, and example sentences. Revisit them anytime.' },
              { icon: GraduationCap, title: 'Flashcards', desc: 'Automatically create flashcards from words you lookup. Spaced repetition for effective vocabulary building.' },
              { icon: Users, title: 'Collaborative Reading', desc: 'Create reading groups with invite codes. Share highlights, annotations, and comments in real-time.' },
              { icon: Search, title: 'Full-Text Search', desc: 'Search within any PDF document with highlighted results and quick navigation between matches.' },
              { icon: MessageSquare, title: 'Question Generator', desc: 'AI generates comprehension questions from your PDF to test understanding and retention.' },
              { icon: Clock, title: 'Pomodoro Timer', desc: 'Built-in focus timer with customizable durations. Stay in the zone while you read.' },
              { icon: Layers, title: 'Annotations', desc: 'Highlight text, draw freehand, add sticky notes. Undo/redo support and color-coded highlights.' },
              { icon: SunMoon, title: 'Dark & Light Mode', desc: 'Beautiful theme support for comfortable reading day or night.' },
              { icon: BarChart3, title: 'Reading Analytics', desc: 'Track pages read, time spent, words looked up, and maintain your reading streak.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-xl border bg-background/60 p-5 shadow-sm transition-all hover:border-emerald-400/50 hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COLLABORATIVE SECTION ── */}
      <section className="border-b py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-semibold text-emerald-500">
                <Users className="h-3.5 w-3.5" />
                New Feature
              </div>
              <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Read Together, <span className="text-emerald-500">Anywhere</span>
              </h2>
              <p className="mt-4 text-muted-foreground leading-7">
                Create a reading group, share an invite code, and read the same PDF with friends or classmates. See each other&apos;s highlights and annotations in real-time with color-coded authors. Discuss passages with threaded comments and @mentions.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Real-time highlight synchronization',
                  'Color-coded per-user annotations',
                  'Threaded comments with @mentions',
                  'Shared PDF loading for all members',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/10 p-8 shadow-sm">
              <div className="space-y-4">
                <div className="rounded-lg border bg-background p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">alice</span>
                    <span className="text-[10px] text-muted-foreground/50 ml-auto">Page 12 · highlight</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-2 py-1">
                    The mitochondria is the powerhouse of the cell.
                  </p>
                  <div className="mt-2 border-t border-border/40 pt-2">
                    <div className="text-xs">
                      <span className="font-semibold text-violet-500">bob</span>
                      <span className="text-foreground ml-1">Great point! This relates to what we discussed in Chapter 3.</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border bg-background p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                    <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">bob</span>
                    <span className="text-[10px] text-muted-foreground/50 ml-auto">Page 15 · note</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-2 py-1">
                    Need to review this section again. @alice what do you think?
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS / TRUST ── */}
      <section className="border-b py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 text-center sm:grid-cols-3">
            {[
              { icon: Zap, value: 'AI-Powered', label: 'Groq + Gemini AI for instant word explanations and translations' },
              { icon: Shield, value: 'Secure', label: 'JWT authentication with encrypted credentials. Your data stays private.' },
              { icon: Globe, value: '100+ Languages', label: 'Word translations, TTS accents, and multi-language flashcards.' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={value} className="rounded-xl border bg-background/60 p-6 shadow-sm">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="mt-4 text-lg font-bold text-foreground">{value}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to Transform Your Reading?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join thousands of readers who use PDFMindAI to read faster, understand deeper, and learn better.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 hover:shadow-xl active:scale-[0.97]"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border bg-background px-8 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.97]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500">
                <BookOpen className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">PDFMind<span className="text-emerald-500">AI</span></span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link href="/about" className="transition-colors hover:text-foreground">About</Link>
              <span>&copy; {new Date().getFullYear()} PDFMindAI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
