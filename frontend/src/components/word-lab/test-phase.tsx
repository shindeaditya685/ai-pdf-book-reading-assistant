'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  CheckCircle2, XCircle, Lightbulb, ArrowLeft, ArrowRight,
  AlertTriangle, Eye, EyeOff, X, SkipForward,
} from 'lucide-react'
import { TestResult } from './types'

export interface TestQuestion {
  wordId: string
  word: string
  type: 'fill-blank' | 'multiple-choice' | 'reverse-recall'
  prompt: string
  correctAnswer: string
  options?: string[]
  sentence?: string
}

export function TestPhase({
  questions,
  onComplete,
  onClose,
}: {
  questions: TestQuestion[]
  onComplete: (results: TestResult[]) => void
  onClose?: () => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [showResult, setShowResult] = useState<Record<number, boolean>>({})
  const MAX_HINTS = 10
  const [revealedHint, setRevealedHint] = useState<Record<number, boolean>>({})
  const [hintsRemaining, setHintsRemaining] = useState(MAX_HINTS)
  const [tabWarnings, setTabWarnings] = useState(0)
  const [showCheatWarning, setShowCheatWarning] = useState(false)
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([0]))
  const [showNav, setShowNav] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const answersRef = useRef<Record<number, string>>({})
  answersRef.current = answers
  const q = questions[index]

  const normalizeType = (raw: string): 'fill-blank' | 'multiple-choice' | 'reverse-recall' => {
    const t = raw?.toLowerCase().replace(/[\s_-]+/g, ' ') || ''
    if (t.includes('fill') && t.includes('blank')) return 'fill-blank'
    if (t.includes('multiple') || t.includes('choice') || t === 'mcq') return 'multiple-choice'
    if (t.includes('reverse') || t.includes('recall')) return 'reverse-recall'
    return 'multiple-choice'
  }

  const safeType = q ? normalizeType(q.type) : 'multiple-choice'
  const MAX_TAB_WARNINGS = 3

  const finishTest = useCallback(() => {
    const currentAnswers = answersRef.current
    const results: TestResult[] = questions.map((q, i) => ({
      wordId: q.wordId,
      word: q.word,
      questionType: normalizeType(q.type),
      userAnswer: currentAnswers[i] || '',
      correctAnswer: q.correctAnswer,
      correct: (currentAnswers[i] || '').trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase(),
      sentence: q.sentence,
    }))
    onComplete(results)
  }, [questions, onComplete])

  const goTo = (i: number) => {
    if (i < 0 || i >= questions.length) return
    setIndex(i)
    setVisitedQuestions((prev) => new Set(prev).add(i))
  }

  const nextQuestion = () => {
    if (index < questions.length - 1) goTo(index + 1)
    else finishTest()
  }

  const skipQuestion = () => {
    if (index < questions.length - 1) goTo(index + 1)
    else finishTest()
  }

  const progress = Object.keys(showResult).length

  useEffect(() => {
    if (safeType === 'fill-blank' || safeType === 'reverse-recall') {
      inputRef.current?.focus()
    }
  }, [index, safeType])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabWarnings((prev) => {
          const next = prev + 1
          setShowCheatWarning(true)
          setTimeout(() => setShowCheatWarning(false), 3000)
          if (next >= MAX_TAB_WARNINGS) {
            setTimeout(() => finishTest(), 500)
          }
          return next
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [finishTest])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C'))) {
        e.preventDefault()
        setTabWarnings((prev) => {
          const next = prev + 1
          if (next >= MAX_TAB_WARNINGS) {
            setTimeout(() => finishTest(), 500)
          }
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [finishTest])

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => e.preventDefault()
    document.addEventListener('copy', handleCopy)
    return () => document.removeEventListener('copy', handleCopy)
  }, [])

  const handleAnswer = (answer: string) => {
    setAnswers((prev) => ({ ...prev, [index]: answer }))
  }

  const checkAnswer = () => {
    const userAnswer = (answers[index] || '').trim().toLowerCase()
    const correct = (q.correctAnswer || '').trim().toLowerCase()
    setShowResult((prev) => ({ ...prev, [index]: true }))
    if (userAnswer === correct) {
      setTimeout(() => nextQuestion(), 600)
    }
  }

  const skipToEnd = () => {
    for (let i = 0; i < questions.length; i++) {
      if (!answers[i]) setAnswers((prev) => ({ ...prev, [i]: '' }))
    }
    finishTest()
  }

  const isCorrect = showResult[index] && !!q &&
    (answers[index] || '').trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase()

  const navColumns = 4

  if (!q) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-950">
        <p className="text-sm text-stone-400">No questions available.</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950 select-none" style={{ userSelect: 'none' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 text-sm text-stone-400">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-stone-300 shadow-sm transition-colors hover:border-stone-600 hover:bg-stone-800 hover:text-stone-100"
            >
              <X className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <span className="font-bold text-amber-500">{index + 1}</span>
          <span className="text-stone-600">/ {questions.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <Lightbulb className={`h-3 w-3 ${hintsRemaining > 0 ? '' : 'opacity-40'}`} />
            {hintsRemaining}/{MAX_HINTS}
          </div>
          {tabWarnings > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400">
              <AlertTriangle className="h-3 w-3" />
              {tabWarnings}/{MAX_TAB_WARNINGS}
            </div>
          )}
          <button
            onClick={() => setShowNav((v) => !v)}
            className="text-xs font-medium text-stone-500 transition-colors hover:text-stone-300 sm:hidden"
          >
            {showNav ? 'Hide nav' : 'Show nav'}
          </button>
          <button
            onClick={skipToEnd}
            className="text-xs font-medium text-stone-500 transition-colors hover:text-stone-300"
          >
            End test
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1 w-full bg-stone-800">
        <div
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${(progress / questions.length) * 100}%` }}
        />
      </div>

      {/* ── Cheat warning flash ── */}
      {showCheatWarning && (
        <div className="absolute left-1/2 top-20 z-50 -translate-x-1/2 animate-pulse rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          <EyeOff className="mr-1.5 inline h-4 w-4" />
          Tab switch! ({MAX_TAB_WARNINGS - tabWarnings} remaining)
        </div>
      )}

      {/* ── Main area: content (left) + nav (right) ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Question content ── */}
        <div className="test-scrollbar flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto w-full max-w-2xl flex-1 flex flex-col justify-center">
            {/* Question type badge */}
            <div className="mb-5 text-center">
              <span className="inline-block rounded-full border border-stone-700 bg-stone-900 px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                {safeType === 'fill-blank' && 'Fill in the Blank'}
                {safeType === 'multiple-choice' && 'Multiple Choice'}
                {safeType === 'reverse-recall' && 'Reverse Recall'}
              </span>
            </div>

            {/* Question card */}
            <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
              {safeType === 'fill-blank' && (
                <div className="space-y-6">
                  <p className="text-center text-lg leading-relaxed text-stone-100">
                    {q.prompt.split('__________').map((part, i, arr) => (
                      <span key={i}>
                        {part}
                        {i < arr.length - 1 && (
                          <span className="mx-2 inline-block min-w-[120px] border-b-2 border-dashed border-amber-500 px-2 pb-0.5 text-amber-400">
                            {showResult[index] ? (q.correctAnswer || '') : ' '.repeat(Math.max(4, (q.correctAnswer || '').length))}
                          </span>
                        )}
                      </span>
                    ))}
                  </p>
                  {!showResult[index] && (
                    <>
                      <div className="flex justify-center">
                        <input
                          ref={inputRef}
                          type="text"
                          value={answers[index] || ''}
                          onChange={(e) => handleAnswer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') checkAnswer()
                          }}
                          placeholder="Type the missing word..."
                          className="h-12 w-full max-w-md rounded-xl border border-stone-700 bg-stone-800/50 px-4 text-center text-lg text-stone-100 outline-none transition-all placeholder:text-stone-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                      <div className="flex justify-center">
                        <button
                          onClick={() => {
                            if (!revealedHint[index] && hintsRemaining > 0) {
                              setHintsRemaining((h) => h - 1)
                            }
                            setRevealedHint((prev) => ({ ...prev, [index]: true }))
                          }}
                          disabled={hintsRemaining === 0 && !revealedHint[index]}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Lightbulb className={`h-4 w-4 ${revealedHint[index] ? 'fill-amber-400 text-amber-400' : ''}`} />
                          {revealedHint[index]
                            ? `First letter: ${(q.correctAnswer || '?')[0].toUpperCase()}`
                            : hintsRemaining > 0
                              ? `Show hint (${hintsRemaining})`
                              : 'No hints left'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {safeType === 'multiple-choice' && (
                <div className="space-y-5">
                  <p className="text-center text-lg font-medium text-stone-100">{q.prompt}</p>
                  <div className="space-y-2.5">
                    {(q.options || []).map((opt, i) => {
                      const selected = answers[index] === opt
                      const isOptCorrect = opt === q.correctAnswer
                      const letter = String.fromCharCode(65 + i)
                      let style = 'border-stone-700 bg-stone-800/50 text-stone-300 hover:border-stone-500 hover:bg-stone-800'
                      if (showResult[index]) {
                        if (isOptCorrect) {
                          style = 'border-emerald-500 bg-emerald-950/20 text-emerald-400 ring-1 ring-emerald-500/30'
                        } else if (selected) {
                          style = 'border-rose-500 bg-rose-950/20 text-rose-400 ring-1 ring-rose-500/30'
                        } else {
                          style = 'border-stone-800 bg-stone-900 text-stone-600'
                        }
                      } else if (selected) {
                        style = 'border-amber-500 bg-amber-950/20 text-amber-300 ring-1 ring-amber-500/30'
                      }
                      return (
                        <button
                          key={`${letter}-${opt}`}
                          onClick={() => {
                            if (!showResult[index]) {
                              handleAnswer(opt)
                              setTimeout(() => {
                                setShowResult((prev) => ({ ...prev, [index]: true }))
                                if (opt === q.correctAnswer) {
                                  setTimeout(() => nextQuestion(), 500)
                                }
                              }, 200)
                            }
                          }}
                          disabled={showResult[index]}
                          className={`flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left text-base transition-all ${style}`}
                        >
                          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                            showResult[index] && isOptCorrect
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : showResult[index] && selected && !isOptCorrect
                              ? 'bg-rose-500/20 text-rose-400'
                              : selected
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-stone-800 text-stone-400'
                          }`}>
                            {letter}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {showResult[index] && isOptCorrect && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
                          {showResult[index] && selected && !isOptCorrect && <XCircle className="h-5 w-5 shrink-0 text-rose-500" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {safeType === 'reverse-recall' && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-stone-700/50 bg-stone-800/30 p-6 text-center">
                    <p className="text-base italic leading-relaxed text-stone-300">{q.prompt}</p>
                  </div>
                  {!showResult[index] && (
                    <>
                      <div className="flex justify-center">
                        <input
                          ref={inputRef}
                          type="text"
                          value={answers[index] || ''}
                          onChange={(e) => handleAnswer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') checkAnswer()
                          }}
                          placeholder="Type the word..."
                          className="h-12 w-full max-w-md rounded-xl border border-stone-700 bg-stone-800/50 px-4 text-center text-lg text-stone-100 outline-none transition-all placeholder:text-stone-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                      <div className="flex justify-center">
                        <button
                          onClick={() => {
                            if (!revealedHint[index] && hintsRemaining > 0) {
                              setHintsRemaining((h) => h - 1)
                            }
                            setRevealedHint((prev) => ({ ...prev, [index]: true }))
                          }}
                          disabled={hintsRemaining === 0 && !revealedHint[index]}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Lightbulb className={`h-4 w-4 ${revealedHint[index] ? 'fill-amber-400 text-amber-400' : ''}`} />
                          {revealedHint[index]
                            ? `First letter: ${(q.correctAnswer || '?')[0].toUpperCase()}`
                            : hintsRemaining > 0
                              ? `Show hint (${hintsRemaining})`
                              : 'No hints left'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Result feedback */}
              {showResult[index] && (
                <div className={`mt-6 flex items-start gap-3 rounded-xl border p-4 ${
                  isCorrect
                    ? 'border-emerald-500/30 bg-emerald-950/10'
                    : 'border-rose-500/30 bg-rose-950/10'
                }`}>
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      <div>
                        <p className="text-sm font-bold text-emerald-400">Correct!</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                      <div>
                        <p className="text-sm font-bold text-rose-400">
                          Correct answer: <span className="font-black">{q.correctAnswer || ''}</span>
                        </p>
                        {q.sentence && (
                          <p className="mt-1 text-sm text-stone-500">&ldquo;{q.sentence}&rdquo;</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="mt-5 flex items-center justify-between">
              <div>
                {index > 0 && (
                  <button
                    onClick={() => {
                      goTo(index - 1)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-700 px-4 py-2 text-sm font-semibold text-stone-400 transition-all hover:border-stone-500 hover:text-stone-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {safeType === 'multiple-choice' && !showResult[index] && (
                  <button
                    onClick={skipQuestion}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 px-4 py-2 text-sm font-medium text-stone-500 transition-all hover:border-stone-500 hover:text-stone-300"
                  >
                    <SkipForward className="h-4 w-4" />
                    Skip
                  </button>
                )}
                {safeType !== 'multiple-choice' && !showResult[index] && (
                  <>
                    <button
                      onClick={skipQuestion}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 px-4 py-2 text-sm font-medium text-stone-500 transition-all hover:border-stone-500 hover:text-stone-300"
                    >
                      <SkipForward className="h-4 w-4" />
                      Skip
                    </button>
                    <button
                      onClick={checkAnswer}
                      disabled={!answers[index]?.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-amber-600/20 transition-all hover:bg-amber-500 active:scale-[0.97] disabled:opacity-40"
                    >
                      Check Answer
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                {showResult[index] && index < questions.length - 1 && (
                  <button
                    onClick={() => goTo(index + 1)}
                    className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-6 py-2 text-sm font-bold text-stone-900 shadow-lg transition-all hover:bg-stone-200 active:scale-[0.97]"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                {showResult[index] && index >= questions.length - 1 && (
                  <button
                    onClick={finishTest}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-2 text-base font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.97]"
                  >
                    See Results
                    <ArrowRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Question navigation panel ── */}
        <div className={`${
          showNav ? 'flex' : 'hidden'
        } w-48 shrink-0 flex-col border-l border-stone-800 bg-stone-900/50 sm:flex`}>
          <div className="border-b border-stone-800 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              Questions
            </p>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-stone-500">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-amber-500" />
                Done
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded border border-stone-600 bg-stone-900" />
                Skip
              </span>
            </div>
          </div>
          <div className="test-scrollbar flex-1 overflow-y-auto p-3">
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${navColumns}, 1fr)` }}
            >
              {Array.from({ length: questions.length }, (_, i) => {
                const isCurrent = i === index
                const isAnswered = !!answers[i]?.trim()
                const isVisited = visitedQuestions.has(i)
                const isReached = isVisited || isCurrent || i < Math.max(...visitedQuestions)
                let cellStyle = 'border-stone-800 text-stone-600 bg-stone-950/50'
                if (isCurrent && isAnswered) {
                  cellStyle = 'border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                } else if (isCurrent && !isAnswered) {
                  cellStyle = 'border-amber-500 bg-stone-900 text-amber-400 ring-1 ring-amber-500/30'
                } else if (isAnswered) {
                  cellStyle = 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
                } else if (isVisited) {
                  cellStyle = 'border-stone-700 bg-stone-900/50 text-stone-500'
                }
                return (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`flex h-9 w-full items-center justify-center rounded-lg border text-xs font-bold tabular-nums transition-all hover:border-amber-500/50 hover:text-amber-400 ${cellStyle}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="border-t border-stone-800 px-4 py-3">
            <p className="text-xs text-stone-500">
              <span className="font-bold text-amber-400">{Object.keys(answers).filter((k) => answers[Number(k)]?.trim()).length}</span>
              <span className="text-stone-600"> / {questions.length} done</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Secure mode footer ── */}
      <div className="flex items-center justify-center border-t border-stone-800 px-6 py-2 text-[10px] text-stone-600">
        {tabWarnings >= MAX_TAB_WARNINGS ? (
          <span className="text-rose-500">Test auto-submitted</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Eye className="h-3 w-3" />
            Secure test mode
          </span>
        )}
      </div>
    </div>
  )
}
