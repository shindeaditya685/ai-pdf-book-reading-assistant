'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Shuffle, X, Loader2, Brain, RotateCcw, Sparkles, ListChecks } from 'lucide-react'
import { TestPhase, TestQuestion } from '@/components/word-lab/test-phase'
import { TestResult } from '@/components/word-lab/types'
import { authFetch } from '@/lib/api'

interface CollectionWord {
  word: string
  meaning: string
  pronunciation: string
  translation: string | null
  partOfSpeech: string
  example: string
  order: number
  createdAt: string
}

type Mode = 'flashcard' | 'test' | 'setup'
type QuestionType = 'multiple-choice' | 'fill-blank' | 'reverse-recall' | 'mixed'

export function CollectionStudy({
  words,
  collectionName,
  onClose,
  initialMode,
}: {
  words: CollectionWord[]
  collectionName: string
  onClose: () => void
  initialMode?: Mode
}) {
  const [mode, setMode] = useState<Mode>(() => {
    if (initialMode === 'test') return 'setup'
    return initialMode || 'setup'
  })
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [shuffled, setShuffled] = useState<CollectionWord[]>(() =>
    initialMode === 'flashcard' ? [...words].sort(() => Math.random() - 0.5) : []
  )
  const [questionType, setQuestionType] = useState<QuestionType>('mixed')
  const [generatedQuestions, setGeneratedQuestions] = useState<TestQuestion[] | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [testResults, setTestResults] = useState<TestResult[] | null>(null)

  const startFlashcards = useCallback(() => {
    setShuffled([...words].sort(() => Math.random() - 0.5))
    setCardIndex(0)
    setFlipped(false)
    setMode('flashcard')
  }, [words])

  const startTest = useCallback(async () => {
    setGenerating(true)
    setGenError('')
    setGeneratedQuestions(null)

    const wordsForApi = words.map((w) => ({
      word: w.word,
      meaning: w.meaning,
      example: w.example,
    }))

    try {
      const res = await authFetch('/api/collections/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: wordsForApi,
          questionType,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error || 'Failed to generate questions')
        setGenerating(false)
        return
      }
      setGeneratedQuestions(data.questions || [])
      setGenerating(false)
      setMode('test')
    } catch {
      setGenError('Network error. Please try again.')
      setGenerating(false)
    }
  }, [words, questionType])

  const handleTestComplete = useCallback(
    (results: TestResult[]) => {
      setTestResults(results)
      setMode('setup')
    },
    []
  )

  const handleBackToSetup = useCallback(() => {
    setGeneratedQuestions(null)
    setGenError('')
    setTestResults(null)
    setMode('setup')
  }, [])

  const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
    { value: 'mixed', label: 'Mixed', description: 'All question types combined' },
    { value: 'multiple-choice', label: 'Multiple Choice', description: 'Pick the correct meaning' },
    { value: 'fill-blank', label: 'Fill in the Blank', description: 'Type the missing word' },
    { value: 'reverse-recall', label: 'Reverse Recall', description: 'Recall the word from its meaning' },
  ]

  // Test mode — full-screen takeover
  if (mode === 'test' && generatedQuestions) {
    return (
      <TestPhase
        questions={generatedQuestions}
        onComplete={handleTestComplete}
        onClose={onClose}
      />
    )
  }

  const currentCard = shuffled[cardIndex]

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas text-ink">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-paper-border bg-canvas/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-serif text-base font-bold tracking-tight text-ink">{collectionName}</h2>
            <p className="font-mono text-[11px] text-muted-foreground tabular-nums">{words.length} words</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startFlashcards}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
              mode === 'flashcard'
                ? 'bg-brand-soft text-brand'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-ink'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            Review
          </button>
          <button
            onClick={() => setMode('setup')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
              mode === 'setup'
                ? 'bg-brand-soft text-brand'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-ink'
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Quiz
          </button>
        </div>
      </header>

      {/* ── SETUP MODE ── */}
      {mode === 'setup' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:py-10">
          <div className="mx-auto w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-paper-border bg-card p-5 shadow-lg shadow-black/5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold tracking-tight text-ink">
                    How do you want to study?
                  </h2>
                  <p className="text-xs text-muted-foreground">Choose the question format for your quiz</p>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {QUESTION_TYPES.map((qt) => (
                  <button
                    key={qt.value}
                    onClick={() => setQuestionType(qt.value)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                      questionType === qt.value
                        ? 'border-brand/40 bg-brand/10 ring-1 ring-brand/20'
                        : 'border-paper-border bg-muted/30 hover:border-brand/40 hover:bg-brand/5'
                    }`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                      questionType === qt.value
                        ? 'bg-brand text-brand-fg'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {qt.value === 'mixed' ? 'A' : qt.value === 'multiple-choice' ? 'M' : qt.value === 'fill-blank' ? 'B' : 'R'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">{qt.label}</div>
                      <div className="text-[11px] text-muted-foreground">{qt.description}</div>
                    </div>
                    {questionType === qt.value && (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-brand shadow-sm shadow-brand/50" />
                    )}
                  </button>
                ))}
              </div>

              {genError && (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-center text-xs font-medium text-red-500">
                  {genError}
                </div>
              )}

              {testResults && (
                <div className="mt-3 rounded-xl border border-brand/20 bg-brand/10 px-3.5 py-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-brand">Previous result</span>
                    <span className="font-medium text-brand/80 tabular-nums">
                      {testResults.filter((r) => r.correct).length}/{testResults.length} correct
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${(testResults.filter((r) => r.correct).length / testResults.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={startTest}
                disabled={generating}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-brand-fg shadow-lg shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {testResults ? 'Retake Quiz' : `Begin Quiz (${words.length} questions)`}
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-paper-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-ink/20 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── FLASHCARD MODE ── */}
      {mode === 'flashcard' && currentCard && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6">
          <div className="mb-4 flex items-center gap-3 text-xs">
            <span className="font-semibold text-muted-foreground tabular-nums">
              <span className="text-brand">{cardIndex + 1}</span>
              <span className="text-muted-foreground/50"> / {shuffled.length}</span>
            </span>
            <span className="text-paper-border">|</span>
            <button
              onClick={() => {
                setShuffled([...words].sort(() => Math.random() - 0.5))
                setCardIndex(0)
                setFlipped(false)
              }}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-ink"
            >
              <Shuffle className="h-3 w-3" />
              Reshuffle
            </button>
          </div>

          <div className="mb-6 h-1 w-full max-w-md rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${((cardIndex + 1) / shuffled.length) * 100}%` }}
            />
          </div>

          <div
            className="w-full max-w-lg cursor-pointer"
            onClick={() => setFlipped(!flipped)}
            style={{ perspective: '1200px' }}
          >
            <AnimatePresence mode="wait">
              {!flipped ? (
                <motion.div
                  key={`front-${cardIndex}`}
                  initial={{ rotateY: 180, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -180, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="relative overflow-hidden rounded-2xl border border-paper-border bg-card p-10 shadow-lg shadow-black/5"
                >
                  <div className="relative flex flex-col items-center gap-4 text-center">
                    {currentCard.partOfSpeech && (
                      <span className="rounded-full border border-paper-border bg-muted/60 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {currentCard.partOfSpeech}
                      </span>
                    )}
                    <h3 className="font-serif text-3xl font-bold tracking-tight text-ink">
                      {currentCard.word}
                    </h3>
                    {currentCard.pronunciation && (
                      <p className="font-mono text-sm tracking-wide text-muted-foreground/60">
                        {currentCard.pronunciation}
                      </p>
                    )}
                    <div className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
                      <RotateCcw className="h-3 w-3" />
                      Tap to reveal
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`back-${cardIndex}`}
                  initial={{ rotateY: 180, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -180, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="relative overflow-hidden rounded-2xl border border-brand/30 bg-brand/5 p-8 shadow-lg shadow-black/5"
                >
                  <div className="space-y-5 text-center">
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-brand">{currentCard.word}</h3>
                      {currentCard.pronunciation && (
                        <p className="mt-1 font-mono text-sm text-muted-foreground/60">{currentCard.pronunciation}</p>
                      )}
                    </div>

                    <div className="border-t border-brand/20 pt-5">
                      <p className="text-lg font-medium leading-relaxed text-ink">{currentCard.meaning}</p>
                      {currentCard.translation && (
                        <p className="mt-2 font-serif text-sm italic text-brand/80">{currentCard.translation}</p>
                      )}
                    </div>

                    {currentCard.example && (
                      <div className="rounded-xl bg-muted/40 px-5 py-3.5 text-left">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Example</p>
                        <p className="text-sm italic leading-relaxed text-ink/70">
                          &ldquo;{currentCard.example}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={() => { setCardIndex((i) => Math.max(0, i - 1)); setFlipped(false) }}
              disabled={cardIndex === 0}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-paper-border bg-card text-muted-foreground transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFlipped(!flipped)}
              className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-5 py-2.5 text-sm font-semibold text-brand transition-all hover:bg-brand/15"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {flipped ? 'Show word' : 'Show meaning'}
            </button>
            <button
              onClick={() => { setCardIndex((i) => Math.min(shuffled.length - 1, i + 1)); setFlipped(false) }}
              disabled={cardIndex === shuffled.length - 1}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-paper-border bg-card text-muted-foreground transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="ml-2 border-l border-paper-border/70 pl-3">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
