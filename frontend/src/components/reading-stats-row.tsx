'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { BookOpen, Clock, Flame, Brain } from 'lucide-react'

type ReadingStats = {
  todayPages: number
  todayMinutes: number
  streak: number
  totalWords: number
}

export function ReadingStatsRow() {
  const [stats, setStats] = useState<ReadingStats | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [statsRes, libraryRes] = await Promise.all([
          authFetch('/api/reading-stats?days=1'),
          authFetch('/api/library'),
        ])
        let todayPages = 0
        let todayMinutes = 0
        let streak = 0
        let totalWords = 0

        if (statsRes.ok) {
          const data = await statsRes.json()
          todayPages = data.today?.pagesRead || 0
          todayMinutes = Math.round((data.today?.timeSpentMs || 0) / 60000)
          streak = data.streak || 0
        }
        if (libraryRes.ok) {
          const lib = await libraryRes.json()
          totalWords = (lib.books || []).reduce((s: number, b: any) => s + (b.wordCount || 0), 0)
        }
        if (!cancelled) setStats({ todayPages, todayMinutes, streak, totalWords })
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!stats) return null

  const items = [
    { label: 'Pages Today', value: stats.todayPages.toString(), icon: BookOpen, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/10' },
    { label: 'Reading Today', value: `${stats.todayMinutes}m`, icon: Clock, color: 'text-blue-500 bg-blue-500/10 border-blue-500/10' },
    { label: 'Day Streak', value: stats.streak.toString(), icon: Flame, color: 'text-orange-500 bg-orange-500/10 border-orange-500/10' },
    { label: 'Words Lookup', value: stats.totalWords.toLocaleString(), icon: Brain, color: 'text-violet-500 bg-violet-500/10 border-violet-500/10' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((s) => {
        const Icon = s.icon
        const borderClass = s.color.split(' ')[2]
        const iconClasses = s.color.split(' ').slice(0, 2).join(' ')
        return (
          <div
            key={s.label}
            className={`flex flex-col justify-between rounded-2xl border bg-background/40 backdrop-blur-md p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01] ${borderClass}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {s.label}
              </span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClasses}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <span className="mt-4 text-2xl font-black tracking-tight text-foreground">
              {s.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}
