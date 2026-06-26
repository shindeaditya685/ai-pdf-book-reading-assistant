'use client'

import { useMemo } from 'react'
import { CheckCircle2, XCircle, Flame, BookText, Award, TrendingUp } from 'lucide-react'
import { DailyRing } from './daily-ring'
import { TestResult, WordLabStats, WordLabWord } from './types'

const LEVEL_CONFIG = {
  bronze: { label: 'Bronze', min: 0, icon: '🥉', color: 'text-amber-700' },
  silver: { label: 'Silver', min: 5, icon: '🥈', color: 'text-stone-500' },
  gold: { label: 'Gold', min: 15, icon: '🥇', color: 'text-yellow-500' },
  diamond: { label: 'Diamond', min: 30, icon: '💎', color: 'text-cyan-500' },
}

function CalendarHeatmap({ logs }: { logs: { date: string; score: number | null }[] }) {
  const today = new Date()
  const days: Array<{ date: string; score: number | null; day: number }> = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const log = logs.find((l) => l.date === dateStr)
    days.push({ date: dateStr, score: log?.score ?? null, day: d.getDate() })
  }

  const weeks: typeof days[] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="w-6 text-center text-[8px] font-medium text-stone-400 dark:text-stone-500">
            {d[0]}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="flex gap-1">
          {week.map((d) => {
            let bg = 'bg-stone-100 dark:bg-stone-800'
            if (d.score === 10) bg = 'bg-amber-500'
            else if (d.score !== null && d.score >= 7) bg = 'bg-amber-400'
            else if (d.score !== null && d.score >= 5) bg = 'bg-amber-300'
            else if (d.score !== null) bg = 'bg-amber-200'
            return (
              <div
                key={d.date}
                className={`h-6 w-6 rounded-md ${bg} flex items-center justify-center text-[8px] font-bold ${
                  d.score === 10 ? 'text-white' : d.score !== null ? 'text-stone-700' : 'text-stone-300 dark:text-stone-600'
                }`}
                title={`${d.date}: ${d.score !== null ? `${d.score}/10` : 'No test'}`}
              >
                {d.day}
              </div>
            )
          })}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1 text-[9px] text-stone-400 dark:text-stone-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-stone-100 dark:bg-stone-800" /> Missed</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-200" /> &lt;5</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-300" /> 5-6</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-400" /> 7-9</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-500" /> 10/10</span>
      </div>
    </div>
  )
}

export function ResultsView({
  results,
  words,
  stats,
  onDone,
}: {
  results: TestResult[]
  words: WordLabWord[]
  stats: WordLabStats | null
  onDone: () => void
}) {
  const correct = results.filter((r) => r.correct).length
  const total = results.length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
  const missed = results.filter((r) => !r.correct)

  const level = stats?.level || 'bronze'
  const levelInfo = LEVEL_CONFIG[level]

  const calendarData = useMemo(() => {
    return (stats?.dailyLogs || []).map((log) => ({
      date: log.date,
      score: log.score,
    }))
  }, [stats])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3">
          <DailyRing studied={correct} total={total} size={72} strokeWidth={5} glow={accuracy === 100} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
          {accuracy === 100 ? 'Perfect Score!' : 'Daily Test Complete'}
        </h2>
        <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
          {correct}/{total} correct &middot; {accuracy}% accuracy
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center dark:border-stone-700/50 dark:bg-stone-900/60">
          <Flame className="mx-auto h-4 w-4 text-amber-500" />
          <p className="mt-1 text-lg font-bold text-stone-900 dark:text-white">{stats?.currentStreak || 0}</p>
          <p className="text-[9px] font-medium text-stone-400 dark:text-stone-500">Day streak</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center dark:border-stone-700/50 dark:bg-stone-900/60">
          <BookText className="mx-auto h-4 w-4 text-amber-500" />
          <p className="mt-1 text-lg font-bold text-stone-900 dark:text-white">{stats?.totalWordsLearned || 0}</p>
          <p className="text-[9px] font-medium text-stone-400 dark:text-stone-500">Words learned</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center dark:border-stone-700/50 dark:bg-stone-900/60">
          <TrendingUp className="mx-auto h-4 w-4 text-amber-500" />
          <p className="mt-1 text-lg font-bold text-stone-900 dark:text-white">
            {stats && stats.totalAttempted > 0 ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100) : 0}%
          </p>
          <p className="text-[9px] font-medium text-stone-400 dark:text-stone-500">Avg accuracy</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center dark:border-stone-700/50 dark:bg-stone-900/60">
          <Award className={`mx-auto h-4 w-4 ${levelInfo.color}`} />
          <p className="mt-1 text-lg font-bold text-stone-900 dark:text-white">{levelInfo.icon}</p>
          <p className="text-[9px] font-medium text-stone-400 dark:text-stone-500">{levelInfo.label}</p>
        </div>
      </div>

      {missed.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Words to review</p>
          <div className="space-y-1.5">
            {missed.map((r) => {
              const wordData = words.find((w) => w.id === r.wordId)
              return (
                <div
                  key={r.wordId}
                  className="flex items-start gap-2 rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-700/50 dark:bg-stone-900/60"
                >
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-stone-900 dark:text-white">{r.word}</p>
                    <p className="text-[10px] text-rose-500">
                      You typed: {r.userAnswer || '(empty)'}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      Correct: {r.correctAnswer}
                    </p>
                    {wordData?.meaning && (
                      <p className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">{wordData.meaning}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Last 30 days</p>
        <CalendarHeatmap logs={calendarData} />
      </div>

      <div className="text-center">
        <button
          onClick={onDone}
          className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-8 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
        >
          Done — Back to Dashboard
        </button>
      </div>
    </div>
  )
}
