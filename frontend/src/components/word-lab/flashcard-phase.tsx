'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Volume2, Sparkles, Calendar, Play, ArrowLeft, Trash2 } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { CustomTestWord } from './types'

const GRADE_LABELS = [
  { label: 'Again', description: 'Re-queue for this session', color: 'bg-red-500 hover:bg-red-600', grade: 0 },
  { label: 'Hard', description: 'Recalled with difficulty', color: 'bg-orange-500 hover:bg-orange-600', grade: 2 },
  { label: 'Good', description: 'Recalled after some hesitation', color: 'bg-emerald-500 hover:bg-emerald-600', grade: 4 },
  { label: 'Easy', description: 'Perfect recall', color: 'bg-sky-500 hover:bg-sky-600', grade: 5 },
]

interface WordCard {
  word: string
  pronunciation: string
  meaning: string
  translation: string
  example: string
  _id: string
  sessionDate?: string
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center ${color}`}>
      <p className="text-xs font-bold">{count}</p>
      <p className="text-[9px] opacity-70">{label}</p>
    </div>
  )
}

export function FlashcardPhase() {
  const [phase, setPhase] = useState<'setup' | 'loading' | 'review' | 'complete'>('setup')
  const [error, setError] = useState('')

  // Setup state
  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(sevenDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [preview, setPreview] = useState<{ words: CustomTestWord[]; wordCount: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // Review state
  const [cards, setCards] = useState<WordCard[]>([])
  const [queue, setQueue] = useState<WordCard[]>([])
  const [retryQueue, setRetryQueue] = useState<WordCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reviewStats, setReviewStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 })

  const currentCard = queue[currentIndex] || null

  const handlePreview = async () => {
    if (!dateFrom || !dateTo) return
    setPreviewing(true)
    setError('')
    try {
      const res = await authFetch('/api/word-lab/custom-test/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo }),
      })
      const data = await res.json()
      if (res.ok) {
        setPreview({ words: data.words, wordCount: data.wordCount })
      } else {
        setError(data.error || 'Failed to preview')
      }
    } catch {
      setError('Failed to load preview')
    } finally {
      setPreviewing(false)
    }
  }

  const handleStart = async () => {
    if (!preview || preview.words.length === 0) return
    setPhase('loading')
    setError('')
    try {
      const res = await authFetch('/api/word-lab/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', words: preview.words }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to create flashcards')
        setPhase('setup')
        return
      }

      const fetchRes = await authFetch('/api/word-lab/flashcards?dueOnly=false')
      if (fetchRes.ok) {
        const allCards = await fetchRes.json()
        const shuffled = [...allCards].sort(() => Math.random() - 0.5)
        setCards(allCards)
        setQueue(shuffled)
        setRetryQueue([])
        setCurrentIndex(0)
        setIsFlipped(false)
        setReviewStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 })
        setPhase('review')
      } else {
        setError('Failed to load flashcards')
        setPhase('setup')
      }
    } catch {
      setError('Something went wrong')
      setPhase('setup')
    }
  }

  const handleGrade = useCallback(async (grade: number) => {
    if (!currentCard || isSubmitting) return
    setIsSubmitting(true)

    const cardId = currentCard._id
    try {
      await authFetch('/api/word-lab/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', cardId, grade }),
      })
    } catch {
      // non-critical
    } finally {
      setIsSubmitting(false)
    }

    const statKey = grade === 0 ? 'again' : grade <= 2 ? 'hard' : grade === 4 ? 'good' : 'easy'
    setReviewStats((prev) => ({ ...prev, [statKey]: prev[statKey] + 1, reviewed: prev.reviewed + 1 }))

    if (grade === 0) {
      setRetryQueue((prev) => [...prev, currentCard])
    }

    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1)
      setIsFlipped(false)
    } else {
      // End of queue — check retry queue
      const hasRetry = grade === 0 ? retryQueue.length + 1 >= 1 : retryQueue.length > 0
      if (hasRetry) {
        const nextQueue = grade === 0
          ? [...retryQueue, currentCard]
          : [...retryQueue]
        setQueue(nextQueue.sort(() => Math.random() - 0.5))
        setRetryQueue([])
        setCurrentIndex(0)
        setIsFlipped(false)
      } else {
        setPhase('complete')
      }
    }
  }, [currentCard, currentIndex, isSubmitting, retryQueue])

  const handleDelete = useCallback(async (card: WordCard) => {
    setDeletingId(card._id)
    try {
      await authFetch(`/api/word-lab/flashcards?id=${card._id}`, { method: 'DELETE' })
      const isCurrent = queue[currentIndex]?._id === card._id
      setCards((prev) => prev.filter((c) => c._id !== card._id))
      setQueue((prev) => {
        const next = prev.filter((c) => c._id !== card._id)
        if (next.length === 0) setPhase('setup')
        return next
      })
      setRetryQueue((prev) => prev.filter((c) => c._id !== card._id))
      if (isCurrent && currentIndex >= queue.length - 1) {
        setCurrentIndex((i) => Math.max(0, --i))
      }
    } catch {
      // non-critical
    } finally {
      setDeletingId(null)
    }
  }, [queue, currentIndex])

  const currentCardView = queue[currentIndex] || null

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
        <p className="mt-4 text-sm font-medium text-stone-500">Creating flashcards...</p>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-full max-w-sm text-center">
          <Sparkles className="mx-auto h-10 w-10 text-amber-500" />
          <h3 className="mt-4 font-serif text-xl font-bold text-stone-900 dark:text-white">Session Complete!</h3>
          <p className="mt-1 text-sm text-stone-400">You reviewed {reviewStats.reviewed} cards</p>

          <div className="mx-auto mt-6 grid w-full max-w-[220px] grid-cols-2 gap-2">
            <StatBadge label="Again" count={reviewStats.again} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" />
            <StatBadge label="Hard" count={reviewStats.hard} color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" />
            <StatBadge label="Good" count={reviewStats.good} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
            <StatBadge label="Easy" count={reviewStats.easy} color="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" />
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <button
              onClick={() => setPhase('setup')}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-5 py-2.5 text-xs font-bold text-stone-600 transition-all hover:border-stone-300 dark:border-stone-700 dark:text-stone-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'review') {
    return (
      <div className="flex flex-col gap-3">
        {/* Progress indicator: dots + counter */}
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-[3px]">
            {queue.slice(0, 20).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < currentIndex
                    ? 'bg-emerald-400 dark:bg-emerald-500'
                    : i === currentIndex
                    ? 'bg-stone-400 dark:bg-stone-500'
                    : 'bg-stone-200 dark:bg-stone-700'
                }`}
              />
            ))}
            {queue.length > 20 && (
              <span className="ml-1 text-[10px] font-medium text-stone-400 dark:text-stone-500">
                +{queue.length - 20}
              </span>
            )}
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-stone-400 dark:text-stone-500 tabular-nums">
            {currentIndex + 1}/{queue.length}
            {retryQueue.length > 0 && (
              <span className="ml-1.5 text-red-400 dark:text-red-500">+{retryQueue.length}</span>
            )}
          </span>
        </div>

        {/* Card */}
        <div
          className="relative h-[300px] cursor-pointer select-none sm:h-[320px]"
          onClick={() => !isSubmitting && setIsFlipped((f) => !f)}
        >
          <div className="preserve-3d h-full w-full [perspective:1000px]">
            <motion.div
              className="relative h-full w-full"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Front — word */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-[--paper-border] bg-white shadow-lg shadow-stone-200/60 dark:border-stone-700/50 dark:bg-stone-900/60 dark:shadow-black/20"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <p className="px-4 text-center font-serif text-3xl font-bold tracking-tight text-[--ink] dark:text-white">
                  {currentCardView?.word}
                </p>
                {currentCardView?.pronunciation && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const u = new SpeechSynthesisUtterance(currentCardView.word)
                        u.rate = 0.85
                        speechSynthesis.cancel()
                        speechSynthesis.speak(u)
                      }}
                      className="text-emerald-500 transition-colors hover:text-emerald-600"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs italic text-stone-400 dark:text-stone-500">
                      {currentCardView.pronunciation}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <p className="text-[10px] font-medium text-stone-300 dark:text-stone-600">
                    Tap to reveal
                  </p>
                </div>
              </div>

              {/* Back — meaning */}
              <div
                className="absolute inset-0 overflow-y-auto rounded-2xl border border-[--paper-border] bg-white p-4 shadow-lg shadow-stone-200/60 dark:border-stone-700/50 dark:bg-stone-900/60 dark:shadow-black/20"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (currentCardView) handleDelete(currentCardView)
                  }}
                  disabled={deletingId === currentCardView?._id}
                  className="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-stone-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                  title="Delete this flashcard"
                >
                  {deletingId === currentCardView?._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      Meaning
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-stone-800 dark:text-stone-200">
                      {currentCardView?.meaning}
                    </p>
                  </div>

                  {currentCardView?.translation && (
                    <div className="rounded-lg bg-stone-50 p-2.5 dark:bg-stone-800/60">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                        Translation
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-stone-800 dark:text-stone-200">
                        {currentCardView.translation}
                      </p>
                    </div>
                  )}

                  {currentCardView?.example && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                        Example
                      </p>
                      <p className="mt-0.5 border-l-2 border-stone-200 pl-2.5 text-xs italic leading-relaxed text-stone-500 dark:border-stone-700 dark:text-stone-400">
                        &ldquo;{currentCardView.example}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Grade buttons */}
        <AnimatePresence mode="wait">
          {isFlipped ? (
            <motion.div
              key="ratings"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-2"
            >
              {GRADE_LABELS.map((g) => (
                <button
                  key={g.grade}
                  onClick={() => handleGrade(g.grade)}
                  disabled={isSubmitting}
                  className={`rounded-xl px-2.5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.97] disabled:opacity-60 ${g.color}`}
                >
                  <div>{g.label}</div>
                  <div className="mt-0.5 font-normal opacity-80">{g.description}</div>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-[11px] font-medium text-stone-300 dark:text-stone-600"
            >
              Tap the card to see the answer
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Setup phase
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[--paper-border] bg-white p-5 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
              <Calendar className="h-3 w-3" />
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPreview(null) }}
              max={dateTo}
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-800/30"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
              <Calendar className="h-3 w-3" />
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPreview(null) }}
              min={dateFrom}
              max={today}
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-800/30"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={!dateFrom || !dateTo || previewing}
            className="flex items-center gap-1.5 rounded-lg bg-[--ink] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            {previewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {previewing ? 'Loading...' : 'Preview'}
          </button>
          {preview && preview.wordCount > 0 && (
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {preview.wordCount} word{preview.wordCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400">
          {error}
        </div>
      )}

      {preview && preview.wordCount > 0 && (
        <div className="rounded-xl border border-[--paper-border] bg-white p-5 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-stone-900 dark:text-white">{preview.wordCount}</span>
              <span className="ml-1.5 text-sm text-stone-400 dark:text-stone-500">words to study</span>
            </div>
            <button
              onClick={handleStart}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-400 active:scale-[0.97]"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </button>
          </div>
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-stone-50 p-3 dark:bg-stone-800/50">
            <div className="flex flex-wrap gap-1.5">
              {preview.words.map((w) => (
                <span
                  key={w.id}
                  className="rounded-md bg-white px-2 py-1 text-xs font-medium text-stone-700 shadow-sm dark:bg-stone-800 dark:text-stone-300"
                >
                  {w.word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
