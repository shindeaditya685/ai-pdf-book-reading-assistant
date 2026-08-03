'use client'

import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Volume2, Check, Sparkles } from 'lucide-react'
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
  const [animDir, setAnimDir] = useState<'left' | 'right'>('right')
  const current = words[index]
  const allStudied = studiedIds.length >= words.length
  const isStudied = studiedIds.includes(current?.id)
  const cardRef = useRef<HTMLDivElement>(null)

  const goNext = () => {
    if (!studiedIds.includes(current.id)) onMarkStudied(current.id)
    if (index < words.length - 1) { setAnimDir('right'); setIndex((i) => i + 1) }
  }

  const goPrev = () => {
    if (index > 0) { setAnimDir('left'); setIndex((i) => i - 1) }
  }

  if (!current) return null

  return (
    <div className="space-y-6">
      {/* ── Progress meter ── */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {words.map((w, i) => {
          const s = studiedIds.includes(w.id)
          const active = i === index
          return (
            <button
              key={w.id}
              onClick={() => { if (i !== index) { setAnimDir(i > index ? 'right' : 'left'); setIndex(i) } }}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold leading-none transition-all duration-300 ${
                active
                  ? 'bg-brand text-brand-fg shadow-sm scale-110'
                  : s
                    ? 'bg-brand/10 text-brand ring-1 ring-brand/25'
                    : 'bg-transparent text-muted-foreground/30 ring-1 ring-border hover:ring-muted-foreground/30'
              }`}
            >
              {s && !active ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
              <span className="sr-only">{w.word}</span>
            </button>
          )
        })}
      </div>

      {/* ── Specimen card ── */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl border border-paper-border bg-card shadow-sm transition-shadow hover:shadow-md"
      >
        {/* Studied badge */}
        {isStudied && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold text-brand ring-1 ring-brand/20 z-10">
            <Check className="h-3 w-3" strokeWidth={2.5} />
            Studied
          </div>
        )}

        <div
          key={current.id}
          className="px-6 py-8 sm:px-8 sm:py-10 animate-in fade-in duration-300"
        >
          {/* ── Word section ── */}
          <div className="text-center">
            <p
              className="text-4xl font-bold italic leading-none tracking-tight text-ink sm:text-5xl"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {current.word}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2.5">
              {current.pronunciation && (
                <span
                  className="text-xs tracking-wide text-muted-foreground/70"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {current.pronunciation}
                </span>
              )}
              <button
                onClick={() => {
                  const u = new SpeechSynthesisUtterance(current.word)
                  u.lang = 'en-US'
                  u.rate = 0.8
                  speechSynthesis.cancel()
                  speechSynthesis.speak(u)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:text-brand"
                title="Listen"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Hairline divider ── */}
          <div className="my-6 border-t border-paper-border/60" />

          {/* ── Definition ── */}
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                Definition
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/85">
                {current.meaning}
              </p>
            </div>

            {current.translation && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                  Translation
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground/80">
                  {current.translation}
                </p>
              </div>
            )}
          </div>

          {/* ── Hairline divider ── */}
          <div className="my-6 border-t border-paper-border/60" />

          {/* ── Example ── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
              Example
            </p>
            <p className="mt-1.5 text-sm italic leading-relaxed text-muted-foreground/80">
              &ldquo;{current.example}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground/70 transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-20"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>

        <span className="text-[11px] tabular-nums text-muted-foreground/50 font-medium">
          {index + 1} / {words.length}
        </span>

        {index < words.length - 1 ? (
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Done
          </button>
        )}
      </div>

      {/* ── Start test ── */}
      {allStudied && (
        <div className="text-center pt-2">
          <button
            onClick={onStartTest}
            className="group inline-flex items-center gap-2 rounded-xl bg-ink px-8 py-3 text-sm font-bold text-canvas shadow-sm transition-all hover:brightness-125 active:scale-[0.97] dark:bg-canvas dark:text-ink dark:ring-1 dark:ring-border"
          >
            <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
            Start Daily Test
          </button>
        </div>
      )}
    </div>
  )
}
