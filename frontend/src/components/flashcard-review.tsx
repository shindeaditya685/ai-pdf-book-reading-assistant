'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Brain,
  BookOpen,
  RotateCcw,
  Loader2,
  Sparkles,
  Volume2,
  CheckCircle2,
  BarChart3,
  Plus,
  Trash2,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { usePDFStore, type Flashcard } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/auth-context'

const GRADE_LABELS = [
  { label: 'Again', description: 'Complete blackout', color: 'bg-red-500 hover:bg-red-600', grade: 0 },
  { label: 'Hard', description: 'Recalled with difficulty', color: 'bg-orange-500 hover:bg-orange-600', grade: 2 },
  { label: 'Good', description: 'Recalled after some hesitation', color: 'bg-emerald-500 hover:bg-emerald-600', grade: 4 },
  { label: 'Easy', description: 'Perfect recall', color: 'bg-sky-500 hover:bg-sky-600', grade: 5 },
]

export function FlashcardReview() {
  const {
    flashcards,
    showFlashcards,
    setShowFlashcards,
    flashcardsLoading,
    setFlashcards,
    updateFlashcard,
    removeFlashcard,
    pdfFileName,
    shareSession,
    sharedFlashcards,
    removeSharedFlashcard,
    addFlashcard,
  } = usePDFStore()

  const { user } = useAuth()
  const [subTab, setSubTab] = useState<'personal' | 'shared'>('personal')
  const [importingCardId, setImportingCardId] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingCards, setIsLoadingCards] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'due'>('due')
  const [sessionComplete, setSessionComplete] = useState(false)
  const [reviewStats, setReviewStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const filteredCards = useMemo(() => {
    if (filterMode === 'due') {
      const now = Date.now()
      return flashcards.filter((f) => {
        if (!f.nextReview) return true
        return new Date(f.nextReview).getTime() <= now
      })
    }
    return flashcards
  }, [flashcards, filterMode])

  const currentCard = filteredCards[currentIndex] || null

  const loadFlashcards = useCallback(async () => {
    if (!pdfFileName) return
    setIsLoadingCards(true)
    try {
      const res = await authFetch(`/api/flashcards?pdfFileName=${encodeURIComponent(pdfFileName)}&dueOnly=false`)
      if (res.ok) {
        const data = await res.json()
        setFlashcards(data)
      }
    } catch {
      // silent
    } finally {
      setIsLoadingCards(false)
    }
  }, [pdfFileName, setFlashcards])

  useEffect(() => {
    if (showFlashcards && pdfFileName) {
      loadFlashcards()
      setCurrentIndex(0)
      setIsFlipped(false)
      setSessionComplete(false)
      setReviewStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 })
    }
  }, [showFlashcards, pdfFileName, loadFlashcards])

  const handleReview = useCallback(
    async (grade: number) => {
      if (!currentCard || isSubmitting) return
      const cardId = currentCard._id || currentCard.id
      if (!cardId) return

      setIsSubmitting(true)
      try {
        const res = await authFetch('/api/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'review', id: cardId, grade }),
        })
        const data = await res.json()
        if (data.success) {
          updateFlashcard(cardId, {
            stability: data.stability,
            difficulty: data.difficulty,
            interval: data.interval,
            nextReview: data.nextReview,
            totalReviews: data.totalReviews,
          })
        }
      } catch {
        // silent
      } finally {
        setIsSubmitting(false)
      }

      setReviewStats((prev) => {
        const key = grade === 0 ? 'again' : grade <= 2 ? 'hard' : grade === 4 ? 'good' : 'easy'
        return { ...prev, [key]: prev[key] + 1, reviewed: prev.reviewed + 1 }
      })

      if (currentIndex < filteredCards.length - 1) {
        setCurrentIndex((i) => i + 1)
        setIsFlipped(false)
      } else {
        setSessionComplete(true)
      }
    },
    [currentCard, currentIndex, filteredCards.length, isSubmitting, updateFlashcard]
  )

  const handleDeleteCard = useCallback(async () => {
    if (!currentCard) return
    const cardId = currentCard._id || currentCard.id
    if (!cardId) return
    await authFetch(`/api/flashcards?id=${encodeURIComponent(cardId)}`, { method: 'DELETE' })
    removeFlashcard(cardId)

    if (shareSession) {
      await authFetch(`/api/share/flashcards?id=${encodeURIComponent(cardId)}&sessionId=${encodeURIComponent(shareSession._id)}`, { method: 'DELETE' }).catch(() => {})
      removeSharedFlashcard(cardId)
    }

    if (currentIndex >= filteredCards.length - 1) {
      setCurrentIndex(Math.max(0, filteredCards.length - 2))
    }
    setIsFlipped(false)
  }, [currentCard, currentIndex, filteredCards.length, removeFlashcard, shareSession, removeSharedFlashcard])

  const handleDeleteSharedCard = useCallback(async (flashcardId: string) => {
    if (!shareSession) return
    try {
      await authFetch(`/api/share/flashcards?id=${encodeURIComponent(flashcardId)}&sessionId=${encodeURIComponent(shareSession._id)}`, { method: 'DELETE' })
      removeSharedFlashcard(flashcardId)
    } catch (err) {
      console.error('Failed to delete shared flashcard:', err)
    }
  }, [shareSession, removeSharedFlashcard])

  const handleImportCard = useCallback(async (fc: any) => {
    if (!pdfFileName) return
    setImportingCardId(fc.flashcardId)
    try {
      const res = await authFetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          word: fc.word,
          meaning: fc.meaning,
          pronunciation: fc.pronunciation || '',
          translation: fc.translation || '',
          sentence: fc.sentence || '',
          pageNumber: fc.pageNumber || 1,
          pdfFileName,
          bookmarkId: '',
        }),
      })
      const data = await res.json()
      if (data.success) {
        const newPersonalCard = {
          _id: data.id,
          id: data.id,
          bookmarkId: '',
          word: fc.word,
          meaning: fc.meaning,
          pronunciation: fc.pronunciation || '',
          translation: fc.translation || '',
          sentence: fc.sentence || '',
          pageNumber: fc.pageNumber || 1,
          pdfFileName,
          ef: 2.5,
          stability: 0,
          difficulty: 4.93,
          interval: 0,
          repetitions: 0,
          nextReview: new Date().toISOString(),
          lastReview: null,
          totalReviews: 0,
          createdAt: new Date().toISOString(),
        }
        addFlashcard(newPersonalCard)
      }
    } catch (err) {
      console.error('Failed to import flashcard:', err)
    } finally {
      setImportingCardId(null)
    }
  }, [pdfFileName, addFlashcard])

  const handleRestartSession = useCallback(() => {
    setCurrentIndex(0)
    setIsFlipped(false)
    setSessionComplete(false)
    setReviewStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 })
    loadFlashcards()
  }, [loadFlashcards])

  const dueCount = flashcards.filter((f) => {
    if (!f.nextReview) return true
    return new Date(f.nextReview).getTime() <= Date.now()
  }).length

  return (
    <ResponsivePanel
      open={showFlashcards}
      onClose={() => setShowFlashcards(false)}
      ariaLabel="Flashcards"
      header={
        <PanelHeader
          icon={Brain}
          iconClassName="text-violet-500"
          title="Flashcards"
          badge={
            <span className="text-[10px] text-muted-foreground">
              {shareSession ? flashcards.length + sharedFlashcards.length : flashcards.length}
            </span>
          }
          onClose={() => setShowFlashcards(false)}
        />
      }
    >
      {shareSession && (
        <div className="mx-4 mt-3 flex gap-0.5 rounded-lg bg-muted/40 p-0.5">
          <button
            onClick={() => setSubTab('personal')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'personal' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            My Cards ({flashcards.length})
          </button>
          <button
            onClick={() => setSubTab('shared')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'shared' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Session ({sharedFlashcards.length})
          </button>
        </div>
      )}

      {(!shareSession || subTab === 'personal') && (
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <button
            onClick={() => { setFilterMode('due'); setCurrentIndex(0); setIsFlipped(false); setSessionComplete(false) }}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              filterMode === 'due'
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Due ({dueCount})
          </button>
          <button
            onClick={() => { setFilterMode('all'); setCurrentIndex(0); setIsFlipped(false); setSessionComplete(false) }}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              filterMode === 'all'
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({flashcards.length})
          </button>
          {isLoadingCards && <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      )}

      <div className="flex h-full min-h-0 flex-col p-4">
          {(!shareSession || subTab === 'personal') ? (
            isLoadingCards ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
              </div>
            ) : flashcards.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">No flashcards yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Bookmark a word, then create a flashcard from the popup
                  </p>
                </div>
              </div>
            ) : filteredCards.length === 0 && !sessionComplete ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                  <p className="mt-3 text-sm font-medium text-foreground">All caught up!</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    No due cards right now. Check back later.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 h-8 gap-1.5 text-xs"
                    onClick={() => setFilterMode('all')}
                  >
                    <BarChart3 className="h-3 w-3" />
                    Browse all cards
                  </Button>
                </div>
              </div>
            ) : sessionComplete ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="w-full">
                  <Sparkles className="mx-auto h-8 w-8 text-amber-500" />
                  <p className="mt-3 text-sm font-semibold text-foreground">Session Complete!</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    You reviewed {reviewStats.reviewed} cards
                  </p>

                  <div className="mx-auto mt-4 grid w-full max-w-[200px] grid-cols-2 gap-2">
                    <StatBadge label="Again" count={reviewStats.again} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" />
                    <StatBadge label="Hard" count={reviewStats.hard} color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" />
                    <StatBadge label="Good" count={reviewStats.good} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
                    <StatBadge label="Easy" count={reviewStats.easy} color="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" />
                  </div>

                  <div className="mt-6 flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handleRestartSession}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restart
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => { setFilterMode('all'); setSessionComplete(false); setCurrentIndex(0); setIsFlipped(false) }}
                    >
                      <BarChart3 className="h-3 w-3" />
                      Browse all
                    </Button>
                  </div>
                </div>
              </div>
            ) : currentCard ? (
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {currentIndex + 1} / {filteredCards.length}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    Page {currentCard.pageNumber}
                  </span>
                </div>

                {/* Flashcard */}
                <div
                  ref={cardRef}
                  className="relative flex-1 cursor-pointer select-none"
                  onClick={() => !isSubmitting && setIsFlipped((f) => !f)}
                >
                  <div className="preserve-3d h-full w-full [perspective:800px]">
                    <motion.div
                      className="relative h-full w-full"
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border bg-background p-6 shadow-lg"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <p className="text-center text-2xl font-bold text-foreground">
                          {currentCard.word}
                        </p>
                        {currentCard.partOfSpeech && (
                          <span className="mt-2 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                            {currentCard.partOfSpeech}
                          </span>
                        )}
                        {currentCard.pronunciation && (
                          <div className="mt-3 flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const utterance = new SpeechSynthesisUtterance(currentCard.word)
                                utterance.rate = 0.85
                                speechSynthesis.cancel()
                                speechSynthesis.speak(utterance)
                              }}
                              className="text-emerald-500 hover:text-emerald-600 transition-colors"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs italic text-muted-foreground">
                              {currentCard.pronunciation}
                            </span>
                          </div>
                        )}
                        <p className="mt-6 text-[10px] text-muted-foreground/50">
                          Tap to reveal answer
                        </p>
                      </div>

                      {/* Back */}
                      <div
                        className="absolute inset-0 overflow-y-auto rounded-2xl border bg-background p-5 shadow-lg"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Meaning
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {currentCard.meaning}
                        </p>

                        {currentCard.translation && (
                          <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/20">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              Translation
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-foreground">
                              {currentCard.translation}
                            </p>
                          </div>
                        )}

                        {currentCard.example && (
                          <div className="mt-3 border-l-2 border-muted-foreground/15 pl-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Example
                            </p>
                            <p className="mt-0.5 text-xs italic leading-relaxed text-foreground/80">
                              {(() => {
                                const word = currentCard.word || ''
                                const ex = currentCard.example || ''
                                if (!word) return ex
                                const idx = ex.toLowerCase().indexOf(word.toLowerCase())
                                if (idx === -1) return ex
                                return (
                                  <>
                                    {ex.slice(0, idx)}
                                    <strong className="font-semibold not-italic text-foreground">{ex.slice(idx, idx + word.length)}</strong>
                                    {ex.slice(idx + word.length)}
                                  </>
                                )
                              })()}
                            </p>
                          </div>
                        )}
                        {currentCard.sentence && (
                          <div className="mt-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                              From the book
                            </p>
                            <p className="mt-0.5 text-xs italic text-muted-foreground/60 border-l-2 border-muted-foreground/15 pl-2">
                              {currentCard.sentence}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <span>Reps: {currentCard.totalReviews || 0}</span>
                          <span>•</span>
                          <span>Interval: {currentCard.interval || 0}d</span>
                          {currentCard.nextReview && (
                            <>
                              <span>•</span>
                              <span>
                                Next: {new Date(currentCard.nextReview).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Rating buttons */}
                <AnimatePresence mode="wait">
                  {isFlipped ? (
                    <motion.div
                      key="ratings"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="grid grid-cols-2 gap-2"
                    >
                      {GRADE_LABELS.map((g) => (
                        <button
                          key={g.grade}
                          onClick={() => handleReview(g.grade)}
                          disabled={isSubmitting}
                          className={`rounded-xl px-2.5 py-2 text-xs font-semibold text-white shadow-lg transition-all active:scale-95 disabled:opacity-60 ${g.color}`}
                        >
                          <div>{g.label}</div>
                          <div className="mt-0.5 font-normal opacity-80">{g.description}</div>
                        </button>
                      ))}
                      <button
                        onClick={handleDeleteCard}
                        className="col-span-2 rounded-lg py-1.5 text-[10px] text-muted-foreground/50 hover:text-red-500 transition-colors"
                      >
                        Delete this card
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center text-[10px] text-muted-foreground/40"
                    >
                      Tap the card to reveal the answer
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : null
          ) : (
            sharedFlashcards.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">No session flashcards yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Flashcards created by group members will appear here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[...sharedFlashcards]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((fc) => {
                    const member = shareSession?.members.find((m) => m.username === fc.author)
                    const authorColor = member?.color || '#3B82F6'
                    const inPersonalDeck = flashcards.some((f) => f.word.toLowerCase() === fc.word.toLowerCase())
                    const isImporting = importingCardId === fc.flashcardId

                    return (
                      <div key={fc.flashcardId} className="rounded-xl border border-border/60 bg-muted/10 p-3.5 relative group">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-base font-bold text-foreground">{fc.word}</span>
                            {fc.pronunciation && (
                              <span className="ml-1.5 text-xs italic text-muted-foreground">
                                {fc.pronunciation}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: authorColor }} />
                              <span style={{ color: authorColor }} className="font-semibold">
                                {fc.author} {fc.author === user?.username && '(you)'}
                              </span>
                              <span className="text-muted-foreground/50">· Page {fc.pageNumber}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {inPersonalDeck ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                                <Check className="h-2.5 w-2.5" />
                                Deck
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 gap-1 px-2 text-[9px] font-bold"
                                onClick={() => handleImportCard(fc)}
                                disabled={isImporting}
                              >
                                {isImporting ? (
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                  <Plus className="h-2.5 w-2.5" />
                                )}
                                Import
                              </Button>
                            )}

                            {fc.author === user?.username && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteSharedCard(fc.flashcardId)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {fc.meaning}
                        </p>

                        {fc.translation && (
                          <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {fc.translation}
                          </p>
                        )}

                        {fc.sentence && (
                          <p className="mt-1.5 text-[10px] italic text-muted-foreground/75 border-l border-muted-foreground/20 pl-2">
                            "{fc.sentence}"
                          </p>
                        )}
                      </div>
                    )
                  })}
              </div>
            )
          )}
      </div>
    </ResponsivePanel>
  )
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center ${color}`}>
      <p className="text-xs font-bold">{count}</p>
      <p className="text-[9px] opacity-70">{label}</p>
    </div>
  )
}
