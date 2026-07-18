'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, Flame, Loader2, BookOpen, Sparkles, History, Ear, Brain, ListChecks } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { DailyRing } from '@/components/word-lab/daily-ring'
import { StudyPhase } from '@/components/word-lab/study-phase'
import { TestPhase } from '@/components/word-lab/test-phase'
import { ResultsView } from '@/components/word-lab/results-view'
import { HistoryView } from '@/components/word-lab/history-view'
import { ReviewPhase } from '@/components/word-lab/review-phase'
import { CustomTestSetup } from '@/components/word-lab/custom-test-setup'
import { FlashcardPhase } from '@/components/word-lab/flashcard-phase'
import { PronunciationCoach } from '@/components/word-lab/pronunciation-coach'
import { WordLabWord, LabPhase, TestResult, WordLabStats, CustomTestWord } from '@/components/word-lab/types'

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

  const [customWords, setCustomWords] = useState<CustomTestWord[]>([])
  const [customQuestionType, setCustomQuestionType] = useState<string>('multiple-choice')
  const [customQuestions, setCustomQuestions] = useState<any[] | null>(null)
  const [customTestResults, setCustomTestResults] = useState<TestResult[]>([])
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [isRetesting, setIsRetesting] = useState(false)

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
    if (isRetesting) {
      setIsRetesting(false)
      router.push('/dashboard')
      return
    }
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

  const handleCustomStartTest = (words: CustomTestWord[], questionType: string, questions: any[], dateFrom: string, dateTo: string) => {
    setCustomWords(words)
    setCustomQuestionType(questionType)
    setCustomQuestions(questions)
    setCustomDateFrom(dateFrom)
    setCustomDateTo(dateTo)
    setPhase('custom-test')
  }

  const handleCustomTestComplete = async (results: TestResult[]) => {
    setCustomTestResults(results)
    setPhase('custom-results')
    setSaving(true)
    try {
      await authFetch('/api/word-lab/custom-test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: customDateFrom,
          dateTo: customDateTo,
          questionType: customQuestionType,
          words: customWords,
          results,
        }),
      })
    } catch {
      // saved locally
    } finally {
      setSaving(false)
    }
  }

  const handleCustomBack = () => {
    setPhase('custom-setup')
    setCustomQuestions(null)
    setCustomTestResults([])
  }

  const handleRetest = async (missedWords: WordLabWord[]) => {
    setIsRetesting(true)
    setGeneratingQuestions(true)
    try {
      const res = await authFetch('/api/word-lab/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: missedWords }),
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
      }
    } catch {
      setError('Failed to generate retest questions')
    } finally {
      setGeneratingQuestions(false)
    }
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
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-paper-border bg-card/80 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground/60 transition-all hover:border-muted-foreground/30 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand shadow-sm">
            <GraduationCap className="h-3.5 w-3.5 text-brand-fg" />
          </div>
          <span className="font-serif text-sm font-bold tracking-tight text-ink">Word Lab</span>
          {stats && stats.currentStreak > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand ring-1 ring-brand/20">
              <Flame className="h-3 w-3" />
              {stats.currentStreak}-day streak
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1">
            {[
              { key: 'flashcard', label: 'Cards', phaseCheck: 'flashcard' },
              { key: 'review', label: 'Review', phaseCheck: 'review' },
              { key: 'pronunciation', label: 'Speak', phaseCheck: 'pronunciation' },
            ].map((btn) => {
              const isActive = phase === btn.phaseCheck
              return (
                <button
                  key={btn.key}
                  onClick={() => setPhase(btn.phaseCheck as any)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider transition-all ${
                    isActive
                      ? 'bg-brand text-brand-fg shadow-sm'
                      : 'text-muted-foreground/60 hover:text-ink hover:bg-muted/50'
                  }`}
                >
                  {btn.label}
                </button>
              )
            })}
            <div className="mx-1 h-4 w-px bg-paper-border" />
            <button
              onClick={() => setPhase(phase === 'custom-setup' ? (words.length > 0 ? 'study' : 'history') : 'custom-setup')}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider transition-all ${
                phase === 'custom-setup' || phase === 'custom-test' || phase === 'custom-results'
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted-foreground/40 hover:text-muted-foreground/70'
              }`}
            >
              {phase === 'custom-setup' || phase === 'custom-test' || phase === 'custom-results' ? 'Daily' : 'Custom'}
            </button>
            <button
              onClick={() => setPhase(phase === 'history' ? 'study' : 'history')}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider transition-all ${
                phase === 'history'
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted-foreground/40 hover:text-muted-foreground/70'
              }`}
            >
              {phase === 'history' ? 'Today' : 'History'}
            </button>
          </div>
          {phase === 'study' && (
            <DailyRing studied={studiedIds.length} total={words.length} size={28} strokeWidth={3} />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400">
            {error}
          </div>
        )}

        {words.length === 0 && !error && !['custom-setup', 'custom-test', 'custom-results', 'history', 'review', 'flashcard', 'pronunciation'].includes(phase) ? (
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
                onRetest={handleRetest}
              />
            )}

            {phase === 'history' && (
              <HistoryView onBack={() => setPhase(words.length > 0 ? 'study' : 'history')} onRetest={handleRetest} />
            )}

            {phase === 'review' && (
              <ReviewPhase
                onBack={() => setPhase(words.length > 0 ? 'study' : 'history')}
                onPhaseChange={setPhase}
              />
            )}

            {phase === 'flashcard' && (
              <FlashcardPhase />
            )}

            {phase === 'pronunciation' && words.length > 0 && (
              <PronunciationCoach
                words={words}
                onBack={() => setPhase('study')}
              />
            )}

            {phase === 'custom-setup' && (
              <CustomTestSetup
                onStartTest={handleCustomStartTest}
                onBack={() => setPhase(words.length > 0 ? 'study' : 'history')}
              />
            )}

            {phase === 'custom-test' && customQuestions && (
              <TestPhase
                questions={customQuestions}
                onComplete={handleCustomTestComplete}
              />
            )}

            {phase === 'custom-results' && (
              <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
                <div className="text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-violet-400" />
                  <h3 className="mt-3 font-serif text-lg font-bold text-stone-900 dark:text-white">Custom Test Complete</h3>
                  <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
                    You got {customTestResults.filter((r) => r.correct).length} / {customTestResults.length} correct
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <div className="h-2 flex-1 max-w-xs rounded-full bg-stone-200 dark:bg-stone-700">
                      <div
                        className="h-2 rounded-full bg-violet-500 transition-all"
                        style={{ width: `${(customTestResults.filter((r) => r.correct).length / customTestResults.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                      {Math.round((customTestResults.filter((r) => r.correct).length / customTestResults.length) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {customTestResults.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 text-sm ${
                        r.correct
                          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/30 dark:bg-emerald-950/10'
                          : 'border-rose-200 bg-rose-50 dark:border-rose-800/30 dark:bg-rose-950/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-stone-900 dark:text-white">{r.word}</span>
                          <span className="ml-2 text-xs text-stone-400 dark:text-stone-500">
                            {r.questionType.replace('-', ' ')}
                          </span>
                        </div>
                        <span className={`text-xs font-bold ${r.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {r.correct ? 'Correct' : 'Wrong'}
                        </span>
                      </div>
                      {!r.correct && (
                        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                          Your answer: {r.userAnswer || '(empty)'} &middot; Correct: {r.correctAnswer}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex justify-center gap-3">
                  <button
                    onClick={handleCustomBack}
                    className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-bold text-stone-600 transition-all hover:border-stone-300 dark:border-stone-700 dark:text-stone-400"
                  >
                    Back to Setup
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                  >
                    Done
                  </button>
                </div>
              </div>
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
