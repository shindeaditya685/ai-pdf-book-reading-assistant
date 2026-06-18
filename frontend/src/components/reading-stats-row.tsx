'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'

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
    { label: 'Pages Today', value: stats.todayPages.toString() },
    { label: 'Reading Today', value: `${stats.todayMinutes}m` },
    { label: 'Day Streak', value: stats.streak.toString() },
    { label: 'Words Lookup', value: stats.totalWords.toLocaleString() },
  ]

  return (
    <div
      className="grid grid-cols-2 gap-px border md:grid-cols-4"
      style={{ backgroundColor: 'var(--paper-border)', borderColor: 'var(--paper-border)' }}
    >
      {items.map((s) => (
        <div key={s.label} className="p-5" style={{ backgroundColor: 'var(--canvas)' }}>
          <span
            className="mb-1 block text-[9px] uppercase tracking-tighter"
            style={{ color: 'var(--accent-warm)' }}
          >
            {s.label}
          </span>
          <span className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}
