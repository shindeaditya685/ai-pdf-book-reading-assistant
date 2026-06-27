'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Brain, BookOpen, ChevronRight, CheckCircle2, XCircle, RotateCcw, ThumbsUp, ThumbsDown, Sparkles, Hash } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'

interface ReviewCard {
  _id: string
  word: string
  meaning: string
  pronunciation: string
  translation: string
  sentence: string
  pageNumber: number
  pdfFileName: string
  ef: number
  stability?: number
  difficulty?: number
  interval: number
  repetitions: number
  nextReview: string
  totalReviews: number
}

export default function ReviewPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [cards, setCards] = useState<ReviewCard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<{ word: string; grade: number }[]>([])
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadCards()
  }, [user, authLoading, router])

  const loadCards = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/flashcards?dueOnly=true')
      if (res.ok) {
        const data = await res.json()
        setCards(data || [])
        setDueCount(data?.length || 0)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleReveal = () => setRevealed(true)

  const handleGrade = async (grade: number) => {
    if (!cards[index]) return
    setSubmitting(true)
    try {
      await authFetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', id: cards[index]._id, grade }),
      })
    } catch { /* ignore */ }
    setResults((prev) => [...prev, { word: cards[index].word, grade }])
    setRevealed(false)
    setSubmitting(false)
    if (index < cards.length - 1) {
      setIndex((i) => i + 1)
    } else {
      setIndex(cards.length) // done
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  const card = cards[index]
  const isDone = index >= cards.length

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-violet-500/10 bg-background/60 px-4 shadow-[0_1px_0_0_rgba(139,92,246,0.05)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/20 ring-1 ring-violet-500/20">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">Review</span>
          {!isDone && dueCount > 0 && (
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              {dueCount} due
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : dueCount === 0 && !isDone ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground/60">No flashcards are due for review right now.</p>
            <Link href="/dashboard" className="mt-2 rounded-lg bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-600 transition-colors">
              Back to Dashboard
            </Link>
          </div>
        ) : isDone ? (
          /* ── SUMMARY ── */
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-800/20">
                <Sparkles className="h-8 w-8 text-violet-500" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">Review Complete!</h2>
              <p className="mt-1 text-sm text-muted-foreground/60">{results.length} cards reviewed</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-background/60 p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-emerald-500 tabular-nums">{results.filter((r) => r.grade >= 3).length}</p>
                <p className="text-[10px] font-semibold text-muted-foreground/60">Good / Easy</p>
              </div>
              <div className="rounded-xl border bg-background/60 p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-red-500 tabular-nums">{results.filter((r) => r.grade < 3).length}</p>
                <p className="text-[10px] font-semibold text-muted-foreground/60">Again</p>
              </div>
              <div className="rounded-xl border bg-background/60 p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-foreground tabular-nums">{results.length}</p>
                <p className="text-[10px] font-semibold text-muted-foreground/60">Total</p>
              </div>
            </div>

            <div className="rounded-xl border bg-background/60 shadow-sm">
              <div className="border-b border-border/40 px-4 py-2">
                <p className="text-xs font-semibold text-muted-foreground/60">Card-by-card</p>
              </div>
              <div className="divide-y divide-border/20">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-medium text-foreground">{r.word}</span>
                    <span className={`flex items-center gap-1 text-xs font-semibold ${r.grade >= 3 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {r.grade >= 3 ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                      {r.grade >= 3 ? 'Passed' : 'Retry'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => { setIndex(0); setResults([]); setRevealed(false); loadCards() }}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Review Again
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg bg-violet-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          /* ── ACTIVE QUIZ ── */
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-muted-foreground/60">
              <span>{index + 1} of {cards.length}</span>
              <span className="tabular-nums">{Math.round(((index) / cards.length) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all"
                style={{ width: `${(index / cards.length) * 100}%` }}
              />
            </div>

            {/* Card */}
            <div className="rounded-2xl border bg-background/60 p-5 shadow-lg backdrop-blur-sm text-center sm:p-8">
              {!revealed ? (
                <div className="space-y-4">
                  <p className="text-2xl font-bold text-foreground sm:text-3xl">{card.word}</p>
                  {card.pronunciation && (
                    <p className="text-sm italic text-muted-foreground/60">{card.pronunciation}</p>
                  )}
                  <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/40">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-2.5 w-2.5" />
                      {(card.pdfFileName || '').split('/').pop()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-2.5 w-2.5" />
                      Pg {card.pageNumber}
                    </span>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={handleReveal}
                      className="rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-600 hover:to-violet-700 hover:shadow-xl hover:shadow-violet-500/30 active:scale-[0.97]"
                    >
                      Show Answer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-2xl font-bold text-foreground">{card.word}</p>
                  {card.pronunciation && (
                    <p className="text-sm italic text-muted-foreground/60">{card.pronunciation}</p>
                  )}

                  <div className="mx-auto mt-4 max-w-md space-y-3 rounded-xl bg-muted/30 p-4 text-left">
                    {card.meaning && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Meaning</p>
                        <p className="mt-0.5 text-sm text-foreground">{card.meaning}</p>
                      </div>
                    )}
                    {card.translation && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Translation</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{card.translation}</p>
                      </div>
                    )}
                    {card.sentence && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Example</p>
                        <p className="mt-0.5 text-sm italic text-muted-foreground/80 border-l-2 border-muted-foreground/20 pl-2">"{card.sentence}"</p>
                      </div>
                    )}
                  </div>

                  <p className="pt-2 text-[11px] text-muted-foreground/40">How well did you remember?</p>
                  <div className="grid grid-cols-3 gap-1.5 sm:flex sm:justify-center sm:gap-3">
                    <button
                      onClick={() => handleGrade(1)}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-2.5 text-[10px] font-bold text-red-600 transition-all hover:bg-red-100 hover:shadow-md disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Again</span>
                    </button>
                    <button
                      onClick={() => handleGrade(3)}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-[10px] font-bold text-amber-600 transition-all hover:bg-amber-100 hover:shadow-md disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-950/30"
                    >
                      <ThumbsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Good</span>
                    </button>
                    <button
                      onClick={() => handleGrade(5)}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2.5 text-[10px] font-bold text-emerald-600 transition-all hover:bg-emerald-100 hover:shadow-md disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Easy</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Card info footer */}
            <div className="text-center text-[10px] text-muted-foreground/30">
              Reviewed {card.totalReviews} time{card.totalReviews !== 1 ? 's' : ''} · Interval: {card.interval}d · Stability: {card.stability?.toFixed(1) || card.ef?.toFixed(1)}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
