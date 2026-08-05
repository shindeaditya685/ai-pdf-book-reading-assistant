import Link from "next/link";
import {
  BookOpen,
  Heart,
  ArrowRight,
  Sparkles,
  MessageSquare,
  Lightbulb,
  ThumbsUp,
  Quote,
} from "lucide-react";

const helpers = [
  { name: "Eri", gradient: "from-emerald-500 to-teal-600" },
  { name: "Shree", gradient: "from-violet-500 to-purple-600" },
  { name: "Shaleena", gradient: "from-amber-500 to-orange-600" },
  { name: "Prism", gradient: "from-cyan-500 to-blue-600" },
  { name: "Nyxyara", gradient: "from-rose-500 to-pink-600" },
  { name: "Invincible", gradient: "from-indigo-500 to-violet-600" },
  { name: "Mike", gradient: "from-teal-500 to-cyan-600" },
];

const contributions = [
  {
    icon: Lightbulb,
    title: "Feature Ideas",
    desc: "Fresh ideas that shaped everything from Word Lists and Quote Chat to the IELTS Prep module.",
  },
  {
    icon: MessageSquare,
    title: "Honest Feedback",
    desc: "Patient testing and candid feedback that caught bugs, polished rough edges, and guided the design.",
  },
  {
    icon: ThumbsUp,
    title: "Support & Encouragement",
    desc: "The motivation to keep shipping — every nudge, cheer, and shared reading session kept this project alive.",
  },
];

export default function ThanksPage() {
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
              With gratitude
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Thank <span className="text-emerald-500">You</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-7 text-muted-foreground">
              Every great project is shaped by the people who believe in it.
              These are the people whose ideas, feedback, and encouragement made
              PDFMindAI better.
            </p>
          </div>
        </div>
      </section>

      {/* ── THE WALL OF THANKS ── */}
      <section className="border-b py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              The Wall of Thanks
            </h2>
            <p className="mt-4 text-muted-foreground">
              To the readers who helped make this what it is today.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {helpers.map(({ name, gradient }) => (
              <div
                key={name}
                className="group relative overflow-hidden rounded-xl border bg-background/60 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-md"
              >
                <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500/10 to-transparent blur-xl transition-opacity group-hover:opacity-100" />
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md`}
                  >
                    <span className="text-lg font-bold text-white">
                      {name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">{name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="h-3 w-3" />
                      Helped shape PDFMindAI
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-lg border border-emerald-500/10 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
                  <Quote className="h-4 w-4 text-emerald-500/40" />
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    Thank you for your ideas, feedback, and support. This
                    project is better because of you.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW THEY HELPED ── */}
      <section className="border-b py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              What Their Support Means
            </h2>
            <p className="mt-4 text-muted-foreground">
              From first spark to finished feature.
            </p>
          </div>
          <div className="mt-10 space-y-4">
            {contributions.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-xl border bg-background/60 p-5 shadow-sm transition-all hover:border-emerald-400/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Want to be on this wall too?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Use PDFMindAI, share your ideas and feedback, and help us keep
            improving the reading experience.
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
              <Link
                href="/terms"
                className="transition-colors hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                href="/privacy"
                className="transition-colors hover:text-foreground"
              >
                Privacy
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
