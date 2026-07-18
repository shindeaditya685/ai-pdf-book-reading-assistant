'use client'

import { BookOpen, PenLine, Mic, BookText } from 'lucide-react'
import { BandScoreRing } from './band-score-ring'
import { SkillCard } from './skill-card'

interface DashboardViewProps {
  score: number | null
  onSelectModule: (module: 'reading' | 'writing' | 'speaking' | 'vocab') => void
}

const SKILLS = [
  { id: 'reading' as const, icon: BookOpen, label: 'Reading', description: 'Timed passages with MCQ, TFNG, Heading & Completion tasks', color: 'blue' as const },
  { id: 'writing' as const, icon: PenLine, label: 'Writing', description: 'Task 1 & 2 prompts with AI band-score evaluation & corrections', color: 'amber' as const },
  { id: 'speaking' as const, icon: Mic, label: 'Speaking', description: 'Cue cards, recording, real-time transcription & AI examiner feedback', color: 'rose' as const },
  { id: 'vocab' as const, icon: BookText, label: 'Vocabulary', description: 'Topic-based Band 7–9 word lists with definition quizzes', color: 'emerald' as const },
]

function TodaysChallenge() {
  const challenges = [
    { day: 'Mon', label: 'Reading' },
    { day: 'Tue', label: 'Writing' },
    { day: 'Wed', label: 'Speaking' },
    { day: 'Thu', label: 'Reading' },
    { day: 'Fri', label: 'Writing' },
    { day: 'Sat', label: 'Vocabulary' },
    { day: 'Sun', label: 'Mock Test' },
  ]
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1
  const current = challenges[todayIdx]
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-xs font-bold tracking-tight text-stone-700 dark:text-stone-300">
          Weekly Study Plan
        </h3>
        <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
          Today: {current.label}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {challenges.map((c, i) => (
          <div key={c.day} className="flex-1 flex flex-col items-center gap-1">
            <span className={`text-[9px] font-semibold ${i === todayIdx ? 'text-blue-600 dark:text-blue-400' : 'text-stone-400'}`}>
              {c.day}
            </span>
            <div
              className={`h-8 w-full max-w-[28px] rounded-lg transition-all ${
                i === todayIdx
                  ? 'bg-blue-600 shadow-sm'
                  : i < todayIdx
                    ? 'bg-stone-200 dark:bg-stone-700'
                    : 'border border-dashed border-stone-200 dark:border-stone-700'
              }`}
            />
            <span className={`text-[8px] font-medium ${i === todayIdx ? 'text-blue-600 font-bold dark:text-blue-400' : 'text-stone-400'}`}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardView({ score, onSelectModule }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      {/* Hero section: Band score ring + welcome */}
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-10">
        <div className="relative shrink-0 pt-2">
          <BandScoreRing score={score} target={7} />
        </div>
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
              IELTS Preparation
            </h1>
            <p className="mt-1 text-sm text-stone-400 dark:text-stone-500 leading-relaxed">
              Practice all four skills with timed exercises, AI-powered evaluation, and detailed band-score feedback.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: BookOpen, label: 'Reading', value: '3', sub: 'passages' },
              { icon: PenLine, label: 'Writing', value: '6', sub: 'tasks' },
              { icon: Mic, label: 'Speaking', value: '10', sub: 'cue cards' },
              { icon: BookText, label: 'Vocabulary', value: '6', sub: 'topics' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-stone-100 bg-white/60 p-3 text-center dark:border-stone-800 dark:bg-stone-900/20">
                <item.icon className="mx-auto h-3.5 w-3.5 text-stone-400" />
                <p className="mt-1.5 font-serif text-lg font-bold tracking-tight text-stone-800 dark:text-stone-200">{item.value}</p>
                <p className="text-[10px] text-stone-400">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skill cards grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SKILLS.map((skill) => (
          <SkillCard
            key={skill.id}
            icon={skill.icon}
            label={skill.label}
            description={skill.description}
            stat={skill.id === 'reading' ? '3' : skill.id === 'writing' ? '6' : skill.id === 'speaking' ? '10' : '6'}
            statLabel={skill.id === 'reading' ? 'passages' : skill.id === 'writing' ? 'tasks' : skill.id === 'speaking' ? 'cue cards' : 'topics'}
            color={skill.color}
            onClick={() => onSelectModule(skill.id)}
          />
        ))}
      </div>

      {/* Weekly plan */}
      <TodaysChallenge />
    </div>
  )
}
