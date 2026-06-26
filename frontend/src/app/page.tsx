'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Sparkles, Brain, Users, Bookmark, Clock, Languages, Volume2, Search, Zap, BarChart3, GraduationCap, Globe, MessageSquare, Layers, SunMoon, ChevronRight, Heart, Cpu } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import { LandingNav } from '@/components/landing-nav'
import { AuthCTA } from '@/components/auth-cta'

/* ── Animation Variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: 'easeOut' as const },
  }),
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.5, delay: i * 0.08 },
  }),
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.1, ease: 'easeOut' as const },
  }),
}

/* ── Animated Counter Hook ── */
function useCounter(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target, duration])

  return { count, ref }
}

/* ── Section Wrapper with InView animation ── */
function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeUp}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Floating Orb ── */
function FloatingOrb({ className, color, size, delay = 0 }: { className: string; color: string; size: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }}
      animate={{
        y: [0, -20, 0, 20, 0],
        x: [0, 10, 0, -10, 0],
        scale: [1, 1.1, 1, 0.95, 1],
      }}
      transition={{
        duration: 12,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    />
  )
}

/* ── Feature Categories ── */
const FEATURE_CATEGORIES = [
  {
    title: 'AI & Language',
    description: 'Powered by cutting-edge AI models',
    accent: 'emerald',
    iconBg: 'from-emerald-500/20 to-emerald-600/10',
    borderColor: 'border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-400/40',
    iconColor: 'text-emerald-400',
    features: [
      { icon: Brain, title: 'AI Word Lookup', desc: 'Select any word and get contextual meanings powered by Groq AI with Gemini fallback. No more context switching.' },
      { icon: Globe, title: '100+ Languages', desc: 'Translate words and sentences into any language. Perfect for language learners reading foreign texts.' },
      { icon: Volume2, title: 'Text-to-Speech', desc: 'Full-page TTS with adjustable speed and multiple accent options. Great for auditory learning.' },
      { icon: GraduationCap, title: 'Flashcards', desc: 'Auto-create flashcards from word lookups. Spaced repetition for effective vocabulary building.' },
    ],
  },
  {
    title: 'Reading Tools',
    description: 'Everything for deep, focused reading',
    accent: 'violet',
    iconBg: 'from-violet-500/20 to-violet-600/10',
    borderColor: 'border-violet-500/20',
    hoverBorder: 'hover:border-violet-400/40',
    iconColor: 'text-violet-400',
    features: [
      { icon: Bookmark, title: 'Smart Bookmarks', desc: 'Save words with meanings, pronunciations, and examples. Revisit them anytime you want.' },
      { icon: Search, title: 'Full-Text Search', desc: 'Search within any PDF document with highlighted results and quick navigation between matches.' },
      { icon: Clock, title: 'Pomodoro Timer', desc: 'Built-in focus timer with customizable durations. Stay in the zone while you read.' },
      { icon: Layers, title: 'Annotations', desc: 'Highlight text, draw freehand, add sticky notes. Undo/redo support and color-coded highlights.' },
    ],
  },
  {
    title: 'Social & Analytics',
    description: 'Track progress and read together',
    accent: 'amber',
    iconBg: 'from-amber-500/20 to-amber-600/10',
    borderColor: 'border-amber-500/20',
    hoverBorder: 'hover:border-amber-400/40',
    iconColor: 'text-amber-400',
    features: [
      { icon: Users, title: 'Collaborative Reading', desc: 'Create reading groups with invite codes. Share highlights, annotations, and comments in real-time.' },
      { icon: MessageSquare, title: 'Question Generator', desc: 'AI generates comprehension questions from your PDF to test understanding and retention.' },
      { icon: SunMoon, title: 'Dark & Light Mode', desc: 'Beautiful theme support for comfortable reading day or night. Easy on the eyes, always.' },
      { icon: BarChart3, title: 'Reading Analytics', desc: 'Track pages read, time spent, words looked up, and maintain your reading streak.' },
    ],
  },
]

/* ── How It Works Steps ── */
const STEPS = [
  { step: '01', icon: BookOpen, title: 'Upload Your PDF', desc: 'Drag and drop any PDF document. Your reading progress, bookmarks, and highlights are saved automatically.', color: 'emerald' },
  { step: '02', icon: Sparkles, title: 'Read with AI', desc: 'Click any word to get an AI-powered explanation. Hear pronunciation, see translations, and save flashcards.', color: 'teal' },
  { step: '03', icon: BarChart3, title: 'Track & Collaborate', desc: 'Monitor your reading stats, join collaborative sessions, and review flashcards to reinforce learning.', color: 'cyan' },
]

/* ── Hero Features ── */
const HERO_FEATURES = [
  { icon: Brain, label: 'AI Word Explanations', desc: 'Click any word for instant contextual meaning, pronunciation, and translation.', gradient: 'from-emerald-500 to-teal-500' },
  { icon: Languages, label: 'Multi-Language', desc: 'Translate words into 100+ languages. Pashto, Farsi, Dutch, and more.', gradient: 'from-violet-500 to-purple-500' },
  { icon: Volume2, label: 'Text-to-Speech', desc: 'Listen to any text with natural voices. Adjust speed and accent.', gradient: 'from-amber-500 to-orange-500' },
  { icon: Users, label: 'Collaborative Groups', desc: 'Read together in real-time. Share highlights, notes, and comments.', gradient: 'from-cyan-500 to-blue-500' },
]

/* ── Page Styles ── */
const pageStyles = `
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  @keyframes shimmer-border {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes typing-dot {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-3px); }
  }
  .gradient-text {
    background: linear-gradient(135deg, #10b981 0%, #14b8a6 30%, #06b6d4 60%, #8b5cf6 100%);
    background-size: 200% 200%;
    animation: gradient-shift 6s ease infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-glow {
    background: radial-gradient(ellipse at center, rgba(16,185,129,0.15) 0%, transparent 70%);
  }
  .card-shimmer:hover::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent);
    background-size: 200% 100%;
    animation: shimmer-border 2s linear infinite;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
  .typing-dot:nth-child(1) { animation-delay: 0s; }
  .typing-dot:nth-child(2) { animation-delay: 0.15s; }
  .typing-dot:nth-child(3) { animation-delay: 0.3s; }
`

export default function LandingPage() {
  /* Animated counters for stats */
  const stat1 = useCounter(100, 2000)
  const stat2 = useCounter(12, 1500)
  const stat3 = useCounter(50, 1800)

  return (
    <>
      <style>{pageStyles}</style>
      <div className="min-h-screen bg-background overflow-x-hidden">

        {/* ═══════════════════════════════════════════
            NAVBAR
        ═══════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════
            HERO SECTION
        ═══════════════════════════════════════════ */}
        <section className="relative overflow-hidden border-b border-border/50">
          {/* Floating orbs */}
          <FloatingOrb className="-left-20 top-10" color="rgba(16,185,129,0.2)" size="400px" delay={0} />
          <FloatingOrb className="-right-20 top-40" color="rgba(139,92,246,0.12)" size="350px" delay={3} />
          <FloatingOrb className="left-1/3 -bottom-20" color="rgba(6,182,212,0.1)" size="300px" delay={6} />

          {/* Grid pattern overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              {/* Animated badge */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 backdrop-blur-sm"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </motion.div>
                AI-Powered PDF Reading Assistant
              </motion.div>

              {/* Hero heading with gradient text */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
                className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-7xl"
              >
                <span className="text-foreground">Read Smarter,</span>
                <br />
                <span className="gradient-text">Not Harder</span>
              </motion.h1>

              {/* Subtext */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-6 text-base leading-7 text-muted-foreground sm:text-lg lg:text-xl max-w-2xl mx-auto"
              >
                Upload any PDF and unlock <span className="text-foreground font-medium">AI-powered word explanations</span>, instant translations, text-to-speech, flashcards, collaborative reading groups, and detailed analytics — all in one beautiful workspace.
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
              >
                <AuthCTA />
              </motion.div>

              {/* Trust pills */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground/60"
              >
                {['No credit card required', 'Free to use', '100+ languages'].map((text, i) => (
                  <span key={text} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/60" />
                    {text}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* ── Bento Feature Grid ── */}
            <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4
            ">
              {HERO_FEATURES.map(({ icon: Icon, label, desc, gradient }, i) => (
                <motion.div
                  key={label}
                  variants={scaleIn}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                  className="card-shimmer group relative overflow-hidden rounded-2xl border border-border/50 bg-background/60 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="mt-4 text-sm font-bold text-foreground">{label}</p>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{desc}</p>
                  {/* Hover glow */}
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30"
                    style={{ background: `linear-gradient(135deg, var(--color-emerald-500, #10b981), transparent)` }}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            HOW IT WORKS — ANIMATED TIMELINE
        ═══════════════════════════════════════════ */}
        <section className="relative border-b border-border/50 py-28 overflow-hidden">
          {/* Background accent */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection className="mx-auto max-w-2xl text-center mb-20">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground mb-4">
                <Zap className="h-3.5 w-3.5 text-emerald-500" />
                Simple Setup
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                How It Works
              </h2>
              <p className="mt-4 text-muted-foreground text-base">
                Three simple steps to transform your reading experience.
              </p>
            </AnimatedSection>

            <div className="relative grid gap-8 md:grid-cols-3">
              {/* Connecting line (desktop) */}
              <div className="pointer-events-none absolute left-0 right-0 top-[60px] hidden h-[2px] md:block"
                style={{
                  background: 'linear-gradient(90deg, transparent 10%, rgba(16,185,129,0.15) 30%, rgba(16,185,129,0.15) 70%, transparent 90%)',
                }}
              />

              {STEPS.map(({ step, icon: Icon, title, desc, color }, i) => (
                <motion.div
                  key={step}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  custom={i * 2}
                  className="relative text-center"
                >
                  {/* Step circle */}
                  <div className="relative mx-auto mb-6">
                    <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center">
                      {/* Outer ring */}
                      <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/20" />
                      {/* Inner circle */}
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 ring-1 ring-emerald-500/20">
                        <Icon className="h-8 w-8 text-emerald-500" />
                      </div>
                    </div>
                    {/* Step number */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-background px-3 py-0.5 text-xs font-bold text-emerald-500 ring-1 ring-emerald-500/20">
                      {step}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground max-w-xs mx-auto">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FEATURES GRID — CATEGORIZED
        ═══════════════════════════════════════════ */}
        <section className="border-b border-border/50 py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AnimatedSection className="mx-auto max-w-2xl text-center mb-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground mb-4">
                <Cpu className="h-3.5 w-3.5 text-emerald-500" />
                Feature-Rich
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Everything You Need
              </h2>
              <p className="mt-4 text-muted-foreground text-base">
                Powerful features designed for deep reading and language learning.
              </p>
            </AnimatedSection>

            <div className="space-y-16">
              {FEATURE_CATEGORIES.map((cat, catIdx) => (
                <div key={cat.title}>
                  <AnimatedSection delay={catIdx * 0.5}>
                    <div className="mb-6 flex items-center gap-3">
                      <div className={`h-8 w-1 rounded-full bg-gradient-to-b ${cat.iconBg}`} />
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{cat.title}</h3>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                    </div>
                  </AnimatedSection>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {cat.features.map(({ icon: Icon, title, desc }, i) => (
                      <motion.div
                        key={title}
                        variants={fadeUp}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-30px' }}
                        custom={i}
                        className={`group relative overflow-hidden rounded-xl border ${cat.borderColor} bg-background/60 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${cat.hoverBorder}`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${cat.iconBg}`}>
                          <Icon className={`h-4 w-4 ${cat.iconColor}`} />
                        </div>
                        <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            COLLABORATIVE SECTION
        ═══════════════════════════════════════════ */}
        <section className="relative border-b border-border/50 py-28 overflow-hidden">
          <FloatingOrb className="-right-40 top-20" color="rgba(139,92,246,0.08)" size="400px" delay={2} />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <AnimatedSection>
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
                  <Users className="h-3.5 w-3.5" />
                  New Feature
                </div>
                <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  Read Together,{' '}
                  <span className="bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent">Anywhere</span>
                </h2>
                <p className="mt-4 text-muted-foreground leading-7 text-base">
                  Create a reading group, share an invite code, and read the same PDF with friends or classmates. See each other&apos;s highlights and annotations in real-time with color-coded authors.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    'Real-time highlight synchronization',
                    'Color-coded per-user annotations',
                    'Threaded comments with @mentions',
                    'Shared PDF loading for all members',
                  ].map((item, i) => (
                    <motion.li
                      key={item}
                      variants={fadeUp}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      custom={i}
                      className="flex items-start gap-3 text-sm text-muted-foreground"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                        <ChevronRight className="h-3 w-3 text-violet-500" />
                      </div>
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </AnimatedSection>

              {/* Mock Chat UI */}
              <AnimatedSection delay={2}>
                <div
                  className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-violet-50/50 via-background to-purple-50/30 p-8 shadow-xl dark:from-violet-950/20 dark:to-purple-950/10"
                  style={{ transform: 'perspective(800px) rotateY(-2deg)' }}
                >
                  {/* Glow border */}
                  <div className="pointer-events-none absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-violet-500/20 via-transparent to-purple-500/20 opacity-50" style={{ padding: '1px', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'exclude', WebkitMaskComposite: 'xor' }} />

                  <div className="space-y-4">
                    {/* Message 1 */}
                    <div className="rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">alice</span>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">Page 12 · highlight</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-500/10">
                        The mitochondria is the powerhouse of the cell.
                      </p>
                      <div className="mt-3 border-t border-border/40 pt-3">
                        <div className="text-xs">
                          <span className="font-semibold text-violet-500">bob</span>
                          <span className="text-foreground ml-1.5">Great point! This relates to what we discussed in Chapter 3.</span>
                        </div>
                      </div>
                    </div>

                    {/* Message 2 */}
                    <div className="rounded-xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-violet-500 shadow-sm shadow-violet-500/50" />
                        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">bob</span>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">Page 15 · note</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground bg-violet-500/5 rounded-lg px-3 py-2 border border-violet-500/10">
                        Need to review this section again. @alice what do you think?
                      </p>
                    </div>

                    {/* Typing indicator */}
                    <div className="flex items-center gap-2 px-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">charlie</span>
                      <div className="flex items-center gap-1 ml-1">
                        <span className="typing-dot inline-block h-1 w-1 rounded-full bg-muted-foreground/40" style={{ animation: 'typing-dot 1.2s infinite' }} />
                        <span className="typing-dot inline-block h-1 w-1 rounded-full bg-muted-foreground/40" style={{ animation: 'typing-dot 1.2s infinite' }} />
                        <span className="typing-dot inline-block h-1 w-1 rounded-full bg-muted-foreground/40" style={{ animation: 'typing-dot 1.2s infinite' }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground/40 ml-auto">typing…</span>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            STATS — ANIMATED COUNTERS
        ═══════════════════════════════════════════ */}
        <section className="border-b border-border/50 py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 text-center sm:grid-cols-3">
              {[
                { ref: stat1.ref, count: stat1.count, suffix: '+', label: 'Languages Supported', sublabel: 'Word translations, TTS accents, multi-language flashcards', icon: Globe, color: 'emerald' },
                { ref: stat2.ref, count: stat2.count, suffix: '+', label: 'AI Features', sublabel: 'From word lookup to flashcard generation, all AI-powered', icon: Zap, color: 'violet' },
                { ref: stat3.ref, count: stat3.count, suffix: 'K+', label: 'Words Explained', sublabel: 'Contextual meanings delivered to curious readers worldwide', icon: Brain, color: 'amber' },
              ].map(({ ref, count, suffix, label, sublabel, icon: Icon, color }, i) => (
                <motion.div
                  key={label}
                  ref={ref}
                  variants={scaleIn}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                  className="relative rounded-2xl border border-border/50 bg-background/60 p-8 shadow-sm backdrop-blur-sm"
                >
                  <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-${color}-500/10 ring-1 ring-${color}-500/20`}>
                    <Icon className={`h-5 w-5 text-${color}-500`} />
                  </div>
                  <div className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                    {count}{suffix}
                  </div>
                  <p className="mt-2 text-sm font-bold text-foreground">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            CTA — PREMIUM GRADIENT BLOCK
        ═══════════════════════════════════════════ */}
        <section className="relative py-32 overflow-hidden">
          {/* Background gradient */}
          <div className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.08) 0%, transparent 70%)',
            }}
          />
          <FloatingOrb className="left-1/4 top-1/4" color="rgba(16,185,129,0.1)" size="300px" delay={1} />
          <FloatingOrb className="right-1/4 bottom-1/4" color="rgba(6,182,212,0.08)" size="250px" delay={4} />

          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <AnimatedSection>
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-xl shadow-emerald-500/25"
              >
                <BookOpen className="h-8 w-8 text-white" />
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Ready to Transform
                <br />
                <span className="gradient-text">Your Reading?</span>
              </h2>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
                Join readers who use PDFMindAI to read faster, understand deeper, and learn better. It&apos;s free to get started.
              </p>
              <AuthCTA primaryLabel="Get Started Free" className="mt-10" />
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FOOTER — REFINED MULTI-COLUMN
        ═══════════════════════════════════════════ */}
        <footer className="border-t border-border/50">
          {/* Top gradient line */}
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {/* Brand column */}
              <div className="lg:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/20">
                    <BookOpen className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-base font-bold">PDFMind<span className="text-emerald-500">AI</span></span>
                </div>
                <p className="text-xs text-muted-foreground leading-5 max-w-[240px]">
                  AI-powered PDF reading assistant. Read smarter, learn faster, and collaborate seamlessly.
                </p>
              </div>

              {/* Product links */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-4">Product</h4>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'IELTS Prep', href: '/ielts' },
                    { label: 'Flashcards', href: '/review' },
                    { label: 'Vocabulary', href: '/vocabulary' },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resources links */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-4">Resources</h4>
                <ul className="space-y-2.5">
                  {[
                    { label: 'About', href: '/about' },
                    { label: 'Profile', href: '/profile' },
                    { label: 'Library', href: '/library' },
                    { label: 'Quotes', href: '/quotes' },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal links */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-4">Legal</h4>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Terms of Service', href: '/terms' },
                    { label: 'Privacy Policy', href: '/privacy' },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 sm:flex-row">
              <p className="text-xs text-muted-foreground/60">
                &copy; {new Date().getFullYear()} PDFMindAI. All rights reserved.
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground/60">
                Made with <Heart className="h-3 w-3 text-red-400" /> for readers everywhere
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
