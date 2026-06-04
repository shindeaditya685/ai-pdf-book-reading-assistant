import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Brain,
  ArrowRight,
  Quote,
  Github,
  ExternalLink,
  Heart,
  Code2,
  GraduationCap,
  MessageSquare,
  Globe,
  Volume2,
  Layers,
} from "lucide-react";

const techStack = [
  { icon: Brain, label: "Next.js 16", desc: "React framework with App Router" },
  { icon: Code2, label: "TypeScript", desc: "Type-safe codebase" },
  { icon: Layers, label: "Zustand", desc: "State management" },
  {
    icon: Sparkles,
    label: "Groq AI",
    desc: "Primary AI provider (llama-3.3-70b)",
  },
  { icon: Globe, label: "Gemini AI", desc: "Fallback AI provider" },
  { icon: Volume2, label: "Web Speech API", desc: "Text-to-speech engine" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 border-b border-emerald-500/10 bg-background/60 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/20">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                PDFMind<span className="text-emerald-500">AI</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl active:scale-[0.97]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--emerald-500)/0.08)_0%,transparent_50%,hsl(var(--emerald-500)/0.03)_100%)]" />
        <div className="mx-auto max-w-4xl px-4 pb-20 pt-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
              <Heart className="h-3.5 w-3.5 text-red-400" />
              Built with purpose
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              The Story Behind{" "}
              <span className="text-emerald-500">PDFMindAI</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-7 text-muted-foreground">
              How a simple frustration during a reading session turned into a
              full-featured AI-powered reading assistant.
            </p>
          </div>
        </div>
      </section>

      {/* ── THE STORY ── */}
      <section className="border-b py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl border border-emerald-500/10 bg-gradient-to-br from-emerald-50/50 to-transparent p-8 shadow-sm dark:from-emerald-950/10 sm:p-10">
            <Quote className="absolute right-6 top-6 h-12 w-12 text-emerald-500/10" />
            <div className="relative space-y-5 text-base leading-7 text-muted-foreground">
              <p>
                I use{" "}
                <span className="font-bold text-foreground">Free4Talk</span> for
                English practice. One day, I was reading a book with a friend,
                and I kept running into the same problem — I&apos;d come across
                a word I didn&apos;t understand, had no idea how to pronounce
                it, and had to stop everything to Google it. By the time I got
                back to reading, I&apos;d already lost my flow.
              </p>
              <p>
                And even after looking it up, I&apos;d forget the meaning a few
                days later. The cycle repeated endlessly. It was frustrating,
                messy, and completely killed the joy of reading.
              </p>
              <p>
                So I decided to build something that would solve this — a tool
                that lets you read any PDF, click any word, and get the meaning,
                pronunciation, and translation{" "}
                <span className="italic text-foreground">instantly</span>. No
                more tab-switching. No more context loss.
              </p>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-5 dark:bg-emerald-950/20">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  &ldquo;I built PDFMindAI because I wanted to make reading in a
                  foreign language feel effortless. What started as a personal
                  frustration became a tool I genuinely use every day.&rdquo;
                </p>
              </div>
              <p>
                Today, PDFMindAI has grown far beyond word lookups. It has
                AI-powered explanations, full-page text-to-speech, collaborative
                reading groups, flashcards, reading analytics, a Pomodoro timer,
                and support for over 100 languages. But the core mission remains
                the same — remove every barrier between you and the text.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CREATOR ── */}
      <section className="border-b py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              About the Creator
            </h2>
            <p className="mt-4 text-muted-foreground">
              Built by someone who actually uses it.
            </p>
          </div>
          <div className="mt-10 rounded-xl border bg-background/60 p-6 shadow-sm sm:p-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/20">
                <span className="text-2xl font-bold text-white">A</span>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-xl font-bold text-foreground">Aditya</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Creator of PDFMindAI
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  If you&apos;re from Free4Talk, you might know me as{" "}
                  <span className="font-semibold text-foreground">
                    only for Study
                  </span>{" "}
                  or <span className="font-semibold text-foreground">Zx</span>.
                  Follow me there if you use the platform!
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-200/50 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-800/30 dark:bg-violet-950/20 dark:text-violet-400">
                    <GraduationCap className="h-3 w-3" />
                    Language Learner
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/50 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-400">
                    <Code2 className="h-3 w-3" />
                    Developer
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TECH STACK ── */}
      <section className="border-b py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built With
            </h2>
            <p className="mt-4 text-muted-foreground">
              The technology powering PDFMindAI.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {techStack.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-xl border bg-background/60 p-4 shadow-sm transition-all hover:border-emerald-400/50 hover:shadow-md"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="mt-3 text-sm font-bold text-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground/60">
            Plus: MongoDB Atlas, JWT Auth, pdfjs-dist, Tesseract.js OCR,
            Tailwind CSS v4, shadcn/ui, Lucide Icons, and more.
          </p>
        </div>
      </section>

      {/* ── FEATURES OVERVIEW ── */}
      <section className="border-b py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              What It Does
            </h2>
            <p className="mt-4 text-muted-foreground">
              A quick overview of every feature.
            </p>
          </div>
          <div className="mt-10 space-y-4">
            {[
              {
                label: "AI Word Lookup",
                desc: "Click any word for instant contextual meaning, pronunciation, translation, and example sentences. Powered by Groq AI with Gemini fallback.",
              },
              {
                label: "Multi-Language Translation",
                desc: "Translate words into 29 languages including Hindi, Marathi, Bengali, Spanish, French, Japanese, Arabic, Pashto, Farsi, and more.",
              },
              {
                label: "Text-to-Speech",
                desc: "Full-page read-aloud with adjustable speed and multiple accent options (US, British, Australian, Indian).",
              },
              {
                label: "Collaborative Reading Groups",
                desc: "Create reading sessions with invite codes. Share highlights, annotations, bookmarks, and flashcards in real-time with color-coded authors.",
              },
              {
                label: "Smart Flashcards",
                desc: "Automatically build flashcards from words you look up. Review and practice anytime.",
              },
              {
                label: "Annotations",
                desc: "Highlight text, draw freehand, add sticky notes. Full undo/redo support with color-coded highlights.",
              },
              {
                label: "Reading Analytics",
                desc: "Track pages read, time spent, words looked up, daily goals, and maintain a reading streak.",
              },
              {
                label: "AI Question Generator",
                desc: "Generate comprehension questions from any PDF to test understanding.",
              },
              {
                label: "AI Summarizer",
                desc: "Get AI-powered summaries of your PDF content with a single click.",
              },
              {
                label: "Pomodoro Timer",
                desc: "Built-in focus timer with customizable durations and a completion sound.",
              },
              {
                label: "Full-Text Search",
                desc: "Search within any PDF with highlighted results and quick navigation.",
              },
              {
                label: "Focus Mode",
                desc: "Immersive reading mode that hides all toolbars and distractions.",
              },
            ].map(({ label, desc }) => (
              <div
                key={label}
                className="rounded-xl border bg-background/60 p-4 shadow-sm transition-all hover:border-emerald-400/50 sm:p-5"
              >
                <p className="text-sm font-bold text-foreground">{label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Want to contribute or just say hi?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            This project is open-source and always improving. If you have ideas,
            feedback, or just want to chat, reach out.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 hover:shadow-xl active:scale-[0.97]"
            >
              Start Reading Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border bg-background px-8 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.97]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500">
                <BookOpen className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">
                PDFMind<span className="text-emerald-500">AI</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link
                href="/"
                className="transition-colors hover:text-foreground"
              >
                Home
              </Link>
              <span className="text-xs text-muted-foreground/30">
                by Aditya
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
