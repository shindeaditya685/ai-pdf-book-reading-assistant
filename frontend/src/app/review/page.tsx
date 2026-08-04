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
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  const card = cards[index]
  const isDone = index >= cards.length
  const passed = results.filter((r) => r.grade >= 3).length

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-paper-border bg-canvas/85 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard" aria-label="Back to dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-fg shadow-sm">
            <Brain className="h-3.5 w-3.5" />
          </div>
          <span className="font-serif text-base font-bold tracking-tight text-ink">Review</span>
          {!isDone && dueCount > 0 && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-brand tabular-nums">
              {dueCount} due
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : dueCount === 0 && !isDone ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-paper-border bg-card shadow-sm">
              <CheckCircle2 className="h-8 w-8 text-brand" />
            </div>
            <p className="font-serif text-2xl font-bold tracking-tight text-ink">All caught up</p>
            <p className="text-sm text-muted-foreground/60">No flashcards are due for review right now.</p>
            <Link href="/dashboard" className="mt-2 rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]">
              Back to Dashboard
            </Link>
          </div>
        ) : isDone ? (
          /* ── SUMMARY ── */
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
                <Sparkles className="h-7 w-7 text-brand" />
              </div>
              <h2 className="mt-4 font-serif text-2xl font-bold tracking-tight text-ink">Review complete</h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground/60 tabular-nums">{results.length} cards reviewed</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-paper-border bg-card p-4 text-center shadow-sm">
                <p className="font-mono text-2xl font-bold text-emerald-500 tabular-nums">{passed}</p>
                <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Passed</p>
              </div>
              <div className="rounded-xl border border-paper-border bg-card p-4 text-center shadow-sm">
                <p className="font-mono text-2xl font-bold text-red-500 tabular-nums">{results.length - passed}</p>
                <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Retry</p>
              </div>
              <div className="rounded-xl border border-paper-border bg-card p-4 text-center shadow-sm">
                <p className="font-mono text-2xl font-bold text-ink tabular-nums">{results.length}</p>
                <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Total</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-paper-border bg-card shadow-sm">
              <div className="border-b border-paper-border px-4 py-2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Card by card</p>
              </div>
              <div className="divide-y divide-paper-border/60">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-serif text-sm font-semibold tracking-tight text-ink">{r.word}</span>
                    <span className={`flex items-center gap-1 font-mono text-xs font-semibold ${r.grade >= 3 ? 'text-emerald-500' : 'text-red-400'}`}>
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
                className="flex items-center gap-1.5 rounded-lg border border-paper-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Review Again
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          /* ── ACTIVE REVIEW ── */
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground/60 tabular-nums">
              <span>{index + 1} of {cards.length}</span>
              <span>{Math.round(((index) / cards.length) * 100)}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted/60" role="progressbar" aria-valuenow={index} aria-valuemin={0} aria-valuemax={cards.length}>
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${(index / cards.length) * 100}%` }}
              />
            </div>

            {/* Card */}
            <div className="rounded-2xl border border-paper-border bg-card p-5 text-center shadow-lg shadow-black/5 sm:p-8">
              {!revealed ? (
                <div className="space-y-4">
                  <p className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">{card.word}</p>
                  {card.pronunciation && (
                    <p className="font-mono text-sm italic text-muted-foreground/60">/{card.pronunciation}/</p>
                  )}
                  <div className="flex items-center justify-center gap-3 font-mono text-[10px] text-muted-foreground/40 tabular-nums">
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
                      className="rounded-xl bg-brand px-8 py-3 text-sm font-bold text-brand-fg shadow-lg shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.97]"
                    >
                      Show Answer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="font-serif text-3xl font-bold tracking-tight text-ink">{card.word}</p>
                  {card.pronunciation && (
                    <p className="font-mono text-sm italic text-muted-foreground/60">/{card.pronunciation}/</p>
                  )}

                  <div className="mx-auto mt-4 max-w-md space-y-3 rounded-xl bg-muted/30 p-4 text-left">
                    {card.meaning && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Meaning</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-ink/85">{card.meaning}</p>
                      </div>
                    )}
                    {card.translation && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand/80">Translation</p>
                        <p className="mt-0.5 font-serif text-sm font-medium italic text-brand">{card.translation}</p>
                      </div>
                    )}
                    {card.sentence && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Example</p>
                        <p className="mt-0.5 border-l-2 border-brand/30 pl-2 font-serif text-sm italic leading-relaxed text-ink/70">
                          &ldquo;{card.sentence}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="pt-2 font-mono text-[11px] text-muted-foreground/40">How well did you remember?</p>
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
            <div className="text-center font-mono text-[10px] text-muted-foreground/40 tabular-nums">
              Reviewed {card.totalReviews} time{card.totalReviews !== 1 ? 's' : ''} · Interval {card.interval}d · Stability {card.stability?.toFixed(1) || card.ef?.toFixed(1)}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
