'use client'

import { useState, useRef, useEffect } from 'react'
import { CheckCircle2, XCircle, Lightbulb, ArrowLeft, ArrowRight } from 'lucide-react'
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
}: {
  questions: TestQuestion[]
  onComplete: (results: TestResult[]) => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [showResult, setShowResult] = useState<Record<number, boolean>>({})
  const [revealedHint, setRevealedHint] = useState<Record<number, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const q = questions[index]

  useEffect(() => {
    if (q.type === 'fill-blank' || q.type === 'reverse-recall') {
      inputRef.current?.focus()
    }
  }, [index, q.type])

  const handleAnswer = (answer: string) => {
    setAnswers((prev) => ({ ...prev, [index]: answer }))
  }

  const checkAnswer = () => {
    const userAnswer = (answers[index] || '').trim().toLowerCase()
    const correct = q.correctAnswer.trim().toLowerCase()
    setShowResult((prev) => ({ ...prev, [index]: true }))
    if (userAnswer === correct) {
      setTimeout(() => {
        if (index < questions.length - 1) {
          setIndex((i) => i + 1)
        } else {
          finishTest()
        }
      }, 600)
    }
  }

  const finishTest = () => {
    const results: TestResult[] = questions.map((q, i) => ({
      wordId: q.wordId,
      word: q.word,
      questionType: q.type,
      userAnswer: answers[i] || '',
      correctAnswer: q.correctAnswer,
      correct: (answers[i] || '').trim().toLowerCase() === q.correctAnswer.trim().toLowerCase(),
      sentence: q.sentence,
    }))
    onComplete(results)
  }

  const skipToEnd = () => {
    for (let i = index; i < questions.length; i++) {
      if (!answers[i]) setAnswers((prev) => ({ ...prev, [i]: '' }))
    }
    finishTest()
  }

  const progress = Object.keys(showResult).length
  const isCorrect = showResult[index] &&
    (answers[index] || '').trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
          <span className="font-semibold text-stone-600 dark:text-stone-300">
            Question {index + 1}
          </span>
          <span>of {questions.length}</span>
        </div>
        <button
          onClick={skipToEnd}
          className="text-xs font-medium text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
        >
          Skip to results
        </button>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-500"
          style={{ width: `${(progress / questions.length) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          {q.type === 'fill-blank' && 'Fill in the Blank'}
          {q.type === 'multiple-choice' && 'Multiple Choice'}
          {q.type === 'reverse-recall' && 'Reverse Recall'}
        </div>

        {q.type === 'fill-blank' && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">{q.prompt}</p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={answers[index] || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !showResult[index]) checkAnswer()
                }}
                placeholder="Type the missing word..."
                disabled={showResult[index]}
                className="h-10 flex-1 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/15 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
              />
            </div>
            {!showResult[index] && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRevealedHint((prev) => ({ ...prev, [index]: true }))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-stone-400 transition-colors hover:text-amber-500"
                >
                  <Lightbulb className="h-3 w-3" />
                  {revealedHint[index] ? `First letter: ${q.correctAnswer[0]}` : 'Show hint'}
                </button>
              </div>
            )}
          </div>
        )}

        {q.type === 'multiple-choice' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{q.prompt}</p>
            <div className="space-y-1.5">
              {(q.options || []).map((opt) => {
                const selected = answers[index] === opt
                const isOptCorrect = opt === q.correctAnswer
                let style = 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50'
                if (showResult[index]) {
                  if (isOptCorrect) {
                    style = 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold dark:border-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400'
                  } else if (selected) {
                    style = 'border-rose-500 bg-rose-50 text-rose-600 font-semibold dark:border-rose-500 dark:bg-rose-950/20 dark:text-rose-400'
                  } else {
                    style = 'border-stone-100 opacity-50 dark:border-stone-700/30'
                  }
                } else if (selected) {
                  style = 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950/20 dark:text-amber-400'
                }
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      if (!showResult[index]) {
                        handleAnswer(opt)
                        setTimeout(() => {
                          setShowResult((prev) => ({ ...prev, [index]: true }))
                          if (opt === q.correctAnswer) {
                            setTimeout(() => {
                              if (index < questions.length - 1) setIndex((i) => i + 1)
                              else finishTest()
                            }, 500)
                          }
                        }, 200)
                      }
                    }}
                    disabled={showResult[index]}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${style}`}
                  >
                    {showResult[index] && isOptCorrect && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                    {showResult[index] && selected && !isOptCorrect && <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {q.type === 'reverse-recall' && (
          <div className="space-y-4">
            <p className="text-sm italic leading-relaxed text-stone-600 dark:text-stone-400">{q.prompt}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Type the word</p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={answers[index] || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !showResult[index]) checkAnswer()
                }}
                placeholder="Type the word..."
                disabled={showResult[index]}
                className="h-10 flex-1 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/15 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
              />
            </div>
            {!showResult[index] && (
              <button
                onClick={() => setRevealedHint((prev) => ({ ...prev, [index]: true }))}
                className="inline-flex items-center gap-1 text-xs font-medium text-stone-400 transition-colors hover:text-amber-500"
              >
                <Lightbulb className="h-3 w-3" />
                {revealedHint[index] ? `First letter: ${q.correctAnswer[0]}` : 'Show hint'}
              </button>
            )}
          </div>
        )}

        {showResult[index] && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border bg-stone-50 p-3 dark:bg-stone-800/50">
            {isCorrect ? (
              <>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Correct!</p>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div>
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Correct answer: <span className="font-bold">{q.correctAnswer}</span>
                  </p>
                  {q.sentence && (
                    <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">&ldquo;{q.sentence}&rdquo;</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {q.type !== 'multiple-choice' && !showResult[index] && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (index > 0) {
                setIndex((i) => i - 1)
                setShowResult((prev) => ({ ...prev, [index - 1]: false }))
              }
            }}
            disabled={index === 0}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 transition-all hover:text-stone-700 disabled:opacity-30 dark:text-stone-400 dark:hover:text-stone-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <button
            onClick={checkAnswer}
            disabled={!answers[index]?.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-600 active:scale-[0.97] disabled:opacity-40"
          >
            Check
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {showResult[index] && index < questions.length - 1 && (
        <div className="text-center">
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            Next Question
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {showResult[index] && index >= questions.length - 1 && (
        <div className="text-center">
          <button
            onClick={finishTest}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-8 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            See Results
          </button>
        </div>
      )}
    </div>
  )
}
