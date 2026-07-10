'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, Flame, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { DailyRing } from '@/components/word-lab/daily-ring'
import { StudyPhase } from '@/components/word-lab/study-phase'
import { TestPhase } from '@/components/word-lab/test-phase'
import { ResultsView } from '@/components/word-lab/results-view'
import { HistoryView } from '@/components/word-lab/history-view'
import { ReviewPhase } from '@/components/word-lab/review-phase'
import { WordLabWord, LabPhase, TestResult, WordLabStats } from '@/components/word-lab/types'

export default function WordLabPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [phase, setPhase] = useState<LabPhase>('study')
  const [words, setWords] = useState<WordLabWord[]>([])
  const [studiedIds, setStudiedIds] = useState<string[]>([])
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [stats, setStats] = useState<WordLabStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [questions, setQuestions] = useState<any[] | null>(null)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [, forceUpdate] = useState(0)

  const loadToday = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const res = await authFetch('/api/word-lab/today')
      if (res.ok) {
        const data = await res.json()
        setWords(data.words || [])
        setStudiedIds(data.studiedIds || [])
        if (data.completed) {
          setPhase('results')
          setTestResults(data.testResults || [])
        } else if ((data.studiedIds?.length || 0) >= (data.words?.length || 0)) {
          setPhase('test')
        }
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to load')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/word-lab/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // stats are optional
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadToday()
    loadStats()
  }, [user, authLoading, router, loadToday, loadStats])

  const handleMarkStudied = async (id: string) => {
    setStudiedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    try {
      await authFetch('/api/word-lab/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: id }),
      })
    } catch {
      // non-critical
    }
  }

  const handleStartTest = async () => {
    setGeneratingQuestions(true)
    setQuestions(null)
    try {
      const res = await authFetch('/api/word-lab/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      })
      if (res.ok) {
        const data = await res.json()
        const shuffled = [...data.questions]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        for (const q of shuffled) {
          if (q.options && Array.isArray(q.options)) {
            for (let i = q.options.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1))
              ;[q.options[i], q.options[j]] = [q.options[j], q.options[i]]
            }
          }
        }
        setQuestions(shuffled)
        setPhase('test')
      } else {
        setError('Failed to generate questions. Please try again.')
      }
    } catch {
      setError('Failed to generate questions. Please try again.')
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const handleTestComplete = async (results: TestResult[]) => {
    setTestResults(results)
    setPhase('results')
    setSaving(true)
    try {
      const res = await authFetch('/api/word-lab/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch {
      // results saved locally
    } finally {
      setSaving(false)
    }
    loadStats()
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-stone-200 bg-white/80 px-4 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-900/80">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-400 transition-all hover:border-stone-300 hover:text-stone-600 dark:border-stone-700 dark:hover:border-stone-600 dark:hover:text-stone-300">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 shadow-sm">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-serif text-sm font-bold tracking-tight text-stone-900 dark:text-white">Word Lab</span>
          {stats && stats.currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Flame className="h-3 w-3" />
              {stats.currentStreak}-day streak
            </span>
          )}
        </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPhase(phase === 'review' ? 'study' : 'review')}
              className="rounded-lg border border-rose-200 px-2.5 py-1 text-[10px] font-bold tracking-wider text-rose-500 transition-all hover:border-rose-300 hover:text-rose-700 dark:border-rose-800/30 dark:text-rose-400 dark:hover:border-rose-700"
            >
              Review
            </button>
            <button
              onClick={() => setPhase(phase === 'history' ? 'study' : 'history')}
              className="rounded-lg border border-stone-200 px-2.5 py-1 text-[10px] font-bold tracking-wider text-stone-500 transition-all hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-200"
            >
              {phase === 'history' ? 'Today' : 'History'}
            </button>

          </div>
          {phase === 'study' && (
            <div className="flex items-center gap-2">
              <DailyRing studied={studiedIds.length} total={words.length} size={32} strokeWidth={3} />
            </div>
          )}
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400">
            {error}
          </div>
        )}

        {words.length === 0 && !error ? (
          <div className="rounded-xl border border-stone-200 bg-white p-10 text-center shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
            <GraduationCap className="mx-auto h-10 w-10 text-stone-300 dark:text-stone-600" />
            <h3 className="mt-4 font-serif text-xl font-bold tracking-tight text-stone-900 dark:text-white">No Words Yet</h3>
            <p className="mt-1.5 text-sm text-stone-400 dark:text-stone-500">
              Start reading and saving words to build your daily vocabulary list.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              Go to Reading Desk
            </Link>
          </div>
        ) : (
          <>
            {phase === 'study' && !generatingQuestions && (
              <StudyPhase
                words={words}
                studiedIds={studiedIds}
                onMarkStudied={handleMarkStudied}
                onStartTest={handleStartTest}
              />
            )}

            {generatingQuestions && (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                <p className="mt-4 text-sm font-medium text-stone-500">Generating questions with AI...</p>
                <p className="mt-1 text-xs text-stone-400">Creating fill-in-the-blank, multiple choice, and reverse recall questions</p>
              </div>
            )}

            {phase === 'test' && questions && (
              <TestPhase
                questions={questions}
                onComplete={handleTestComplete}
              />
            )}

            {phase === 'results' && (
              <ResultsView
                results={testResults}
                words={words}
                stats={stats}
                onDone={() => router.push('/dashboard')}
              />
            )}

            {phase === 'history' && (
              <HistoryView onBack={() => setPhase(words.length > 0 ? 'study' : 'history')} />
            )}

            {phase === 'review' && (
              <ReviewPhase
                onBack={() => setPhase(words.length > 0 ? 'study' : 'history')}
                onPhaseChange={setPhase}
              />
            )}

            {saving && (
              <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-stone-900">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving results...
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
