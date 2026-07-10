'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { DailyRing } from './daily-ring'
import { Flame, ArrowRight, Loader2 } from 'lucide-react'

export function WordLabPreview() {
  const router = useRouter()
  const [data, setData] = useState<{
    studied: number
    total: number
    streak: number
    isComplete: boolean
    score: number | null
    testTotal: number
    words: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await authFetch('/api/word-lab/today')
        if (!res.ok) { setLoading(false); return }
        const json = await res.json()
        if (cancelled) return
        const words = json.words || []
        const studiedIds = json.studiedIds || []
        const isComplete = !!json.completed

        // Also fetch stats for streak
        const statsRes = await authFetch('/api/word-lab/stats')
        const stats = statsRes.ok ? await statsRes.json() : null

        setData({
          studied: studiedIds.length,
          total: words.length,
          streak: stats?.currentStreak || 0,
          isComplete,
          score: json.score ?? null,
          testTotal: (json.testResults || []).length,
          words: words.map((w: any) => w.word),
        })
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700/50 dark:bg-stone-900/60">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-stone-300" />
          <span className="text-xs text-stone-400">Loading Word Lab...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => router.push('/word-lab')}
      className="cursor-pointer rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all hover:border-amber-300 hover:shadow-md dark:border-stone-700/50 dark:bg-stone-900/60 dark:hover:border-amber-700"
    >
      <div className="flex items-start gap-3">
        {data && data.total > 0 ? (
          data.isComplete && data.score !== null ? (
            <DailyRing studied={data.score} total={data.testTotal} size={48} strokeWidth={3} glow={data.score === data.testTotal} />
          ) : (
            <DailyRing studied={data.studied} total={data.total} size={48} strokeWidth={3} glow={data.isComplete} />
          )
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
            <span className="text-lg">📖</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-stone-900 dark:text-white">Word Lab</p>
            {data && data.streak > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Flame className="h-2.5 w-2.5" />
                {data.streak}
              </span>
            )}
          </div>
          {data && data.total > 0 ? (
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {data.studied === 0 ? 'Your daily words are ready' : `${data.studied}/${data.total} studied`}
            </p>
          ) : (
            <p className="text-xs text-stone-400 dark:text-stone-500">Learn 10 new words daily</p>
          )}
          {data && data.words.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {data.words.slice(0, 5).map((w) => (
                <span
                  key={w}
                  className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                >
                  {w}
                </span>
              ))}
              {data.words.length > 5 && (
                <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-400 dark:bg-stone-800 dark:text-stone-500">
                  +{data.words.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-stone-300 dark:text-stone-600" />
      </div>
    </div>
  )
}
