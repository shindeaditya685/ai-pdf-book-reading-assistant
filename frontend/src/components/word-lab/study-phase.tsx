'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Volume2, CheckCircle2, Circle } from 'lucide-react'
import { WordLabWord } from './types'

export function StudyPhase({
  words,
  studiedIds,
  onMarkStudied,
  onStartTest,
}: {
  words: WordLabWord[]
  studiedIds: string[]
  onMarkStudied: (id: string) => void
  onStartTest: () => void
}) {
  const [index, setIndex] = useState(0)
  const current = words[index]
  const allStudied = studiedIds.length >= words.length

  const goNext = () => {
    if (!studiedIds.includes(current.id)) onMarkStudied(current.id)
    if (index < words.length - 1) setIndex((i) => i + 1)
  }

  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {words.map((w, i) => {
          const studied = studiedIds.includes(w.id)
          const active = i === index
          return (
            <button
              key={w.id}
              onClick={() => setIndex(i)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                active
                  ? 'bg-amber-500 text-white shadow-sm'
                  : studied
                    ? 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
                    : 'bg-white text-stone-400 ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-500 dark:ring-stone-700'
              }`}
            >
              {studied ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {w.word}
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            {current.word}
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-sm text-stone-400 dark:text-stone-500">
            <span>{current.pronunciation}</span>
            <button
              onClick={() => {
                const u = new SpeechSynthesisUtterance(current.word)
                u.lang = 'en-US'
                u.rate = 0.85
                speechSynthesis.cancel()
                speechSynthesis.speak(u)
              }}
              className="rounded-md p-1 text-stone-400 transition-colors hover:text-amber-500"
              title="Listen"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              Meaning
            </p>
            <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">{current.meaning}</p>
          </div>

          {current.translation && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                Translation
              </p>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{current.translation}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              Example
            </p>
            <p className="mt-1 text-sm italic leading-relaxed text-stone-600 dark:text-stone-400">
              &ldquo;{current.example}&rdquo;
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 transition-all hover:text-stone-700 disabled:opacity-30 dark:text-stone-400 dark:hover:text-stone-300"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>

        <div className="text-xs text-stone-400 dark:text-stone-500">
          {index + 1} / {words.length}
        </div>

        {index < words.length - 1 ? (
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-600 active:scale-[0.97]"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-600 active:scale-[0.97]"
          >
            Done Studying
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {allStudied && (
        <div className="text-center">
          <button
            onClick={onStartTest}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-8 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            Start Daily Test
          </button>
        </div>
      )}
    </div>
  )
}
