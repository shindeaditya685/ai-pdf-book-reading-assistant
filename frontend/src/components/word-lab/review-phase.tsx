'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/api'
import { Volume2, CheckCircle2, XCircle, Loader2, RefreshCw, ArrowLeft } from 'lucide-react'
import { LabPhase } from './types'

interface ReviewItem {
  id: string
  wordId: string
  word: string
  pronunciation: string
  meaning: string
  translation: string
  example: string
  interval: number
  correctCount: number
  wrongCount: number
}

interface ReviewPhaseProps {
  onBack: () => void
  onPhaseChange: (phase: LabPhase) => void
}

type ReviewStage = 'loading' | 'review' | 'done'

export function ReviewPhase({ onBack, onPhaseChange }: ReviewPhaseProps) {
  const [stage, setStage] = useState<ReviewStage>('loading')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<Array<{ item: ReviewItem; correct: boolean }>>([])
  const [submitting, setSubmitting] = useState(false)
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await authFetch('/api/word-lab/review')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setItems(data.items || [])
          setStage((data.items?.length || 0) > 0 ? 'review' : 'done')
        }
      } catch {
        if (!cancelled) setStage('done')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const current = items[currentIndex]

  const handleResult = async (correct: boolean) => {
    const newResults = [...results, { item: current, correct }]
    setResults(newResults)
    setFlipped(false)

    if (currentIndex + 1 >= items.length) {
      setSubmitting(true)
      try {
        const payload = newResults.map((r) => ({
          wordId: r.item.wordId,
          word: r.item.word,
          pronunciation: r.item.pronunciation,
          meaning: r.item.meaning,
          translation: r.item.translation,
          example: r.item.example,
          correct: r.correct,
        }))
        const res = await authFetch('/api/word-lab/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: payload }),
        })
        if (res.ok) {
          const data = await res.json()
          setDueCount(data.dueCount || 0)
        }
      } catch {
        // ignore
      } finally {
        setSubmitting(false)
      }
      setStage('done')
    } else {
      setCurrentIndex(currentIndex + 1)
    }
  }

  if (stage === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        <p className="mt-3 text-xs text-stone-400">Loading review queue...</p>
      </div>
    )
  }

  if (stage === 'done') {
    const correctCount = results.filter((r) => r.correct).length
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
        {items.length === 0 ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h3 className="mt-3 font-serif text-lg font-bold text-stone-900 dark:text-white">All Caught Up</h3>
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              No words due for review. Check back tomorrow!
            </p>
          </>
        ) : (
          <>
            <RefreshCw className="mx-auto h-10 w-10 text-amber-400" />
            <h3 className="mt-3 font-serif text-lg font-bold text-stone-900 dark:text-white">Review Complete</h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {correctCount}/{items.length} correct
              {dueCount > 0 && ` \u00B7 ${dueCount} still due`}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {results.map((r, i) => (
                <span key={i}>
                  {r.correct ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  )}
                </span>
              ))}
            </div>
          </>
        )}
        <button
          onClick={() => onPhaseChange('study')}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
        >
          Back to Today
        </button>
      </div>
    )
  }

  if (!current) return null

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-400 transition-all hover:border-stone-300 hover:text-stone-600 dark:border-stone-700 dark:hover:border-stone-600 dark:hover:text-stone-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] text-stone-400 dark:text-stone-500">
          {currentIndex + 1} / {items.length}
        </span>
      </div>

      <div
        onClick={() => setFlipped(!flipped)}
        className="min-h-[240px] cursor-pointer rounded-xl border border-stone-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-stone-700/50 dark:bg-stone-900/60"
      >
        {!flipped ? (
          <div className="flex h-full flex-col items-center justify-center pt-8">
            <p className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">{current.word}</p>
            {current.pronunciation && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-stone-400 dark:text-stone-500">
                <span>{current.pronunciation}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const u = new SpeechSynthesisUtterance(current.word)
                    u.lang = 'en-US'
                    u.rate = 0.85
                    speechSynthesis.cancel()
                    speechSynthesis.speak(u)
                  }}
                  className="rounded-md p-0.5 text-stone-400 transition-colors hover:text-amber-500"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <p className="mt-6 text-[10px] text-stone-400 dark:text-stone-500">Tap to reveal</p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-lg font-bold text-stone-900 dark:text-white">{current.word}</p>
            {current.pronunciation && (
              <p className="text-sm text-stone-400 dark:text-stone-500">{current.pronunciation}</p>
            )}
            <p className="text-sm text-stone-600 dark:text-stone-300">{current.meaning}</p>
            {current.translation && (
              <p className="text-xs text-stone-400 dark:text-stone-500">{current.translation}</p>
            )}
            {current.example && (
              <p className="text-xs italic text-stone-400 dark:text-stone-500">&ldquo;{current.example}&rdquo;</p>
            )}
            <div className="flex items-center gap-3 text-[10px] text-stone-400">
              <span>Interval: {current.interval}d</span>
              <span>Missed {current.wrongCount}x</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => handleResult(false)}
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-600 transition-all hover:bg-rose-100 active:scale-[0.97] disabled:opacity-50 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400 dark:hover:bg-rose-950/20"
        >
          <XCircle className="h-3.5 w-3.5" />
          Still Don&rsquo;t Know
        </button>
        <button
          onClick={() => handleResult(true)}
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-600 transition-all hover:bg-emerald-100 active:scale-[0.97] disabled:opacity-50 dark:border-emerald-800/30 dark:bg-emerald-950/10 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Got It
        </button>
      </div>
    </div>
  )
}
