'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { WordLabWord, TestResult } from './types'
import { ArrowLeft, CheckCircle2, XCircle, CalendarDays, Loader2, ChevronDown, ChevronRight, Volume2, RotateCcw } from 'lucide-react'

interface PastSession {
  date: string
  words: WordLabWord[]
  studiedIds: string[]
  testResults: TestResult[]
  score: number | null
  completedAt: string | null
}

interface HistoryViewProps {
  onBack: () => void
  onRetest?: (words: WordLabWord[]) => void
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function SessionCard({ session, onRetest }: { session: PastSession; onRetest?: (words: WordLabWord[]) => void }) {
  const [expanded, setExpanded] = useState(false)
  const completed = !!session.completedAt
  const totalQuestions = session.testResults?.length || 0
  const correct = session.testResults?.filter((r) => r.correct).length || 0
  const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0
  const missed = session.testResults?.filter((r) => !r.correct) || []
  const studiedCount = session.studiedIds?.length || 0
  const wordCount = session.words?.length || 0
  const allStudied = studiedCount >= wordCount

  return (
    <div className="rounded-lg border border-paper-border bg-card transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
        <CalendarDays className="h-4 w-4 text-brand" />
        <span className="flex-1 text-sm font-semibold text-ink">
          {formatDate(session.date)}
        </span>
        {completed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Done
          </span>
        ) : allStudied ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[9px] font-bold text-brand ring-1 ring-brand/20">
            Studied
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[9px] font-bold text-muted-foreground/60">
            Incomplete
          </span>
        )}
        {completed && (
          <span className="text-xs font-bold text-muted-foreground">
            {accuracy}%
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-paper-border/60 px-4 pb-3 pt-2">
          {completed && totalQuestions > 0 && (
            <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">{correct} correct</span>
              <span className="text-rose-600 dark:text-rose-400">{totalQuestions - correct} missed</span>
              <span className="text-muted-foreground/70">{accuracy}% accuracy</span>
            </div>
          )}

          {completed && missed.length > 0 && (
            <div className="mb-3 rounded-md bg-rose-500/5 p-2 ring-1 ring-rose-500/10">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-rose-500">Missed words</p>
              <div className="flex flex-wrap gap-1.5">
                {missed.map((r) => {
                  const w = session.words?.find((w) => w.id === r.wordId)
                  return (
                    <span key={`${r.wordId}-${r.questionType}`} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                      <XCircle className="h-2.5 w-2.5" />
                      {w?.word || r.word}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {completed && onRetest && session.words && session.words.length > 0 && (
            <div className="mb-3 text-center">
              <button
                onClick={() => onRetest(session.words)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[11px] font-bold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retest ({session.words.length} words)
              </button>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Words</p>
            <div className="space-y-1.5">
              {session.words?.map((w) => {
                const result = session.testResults?.find((r) => r.wordId === w.id)
                const wasCorrect = result?.correct
                return (
                  <div
                    key={w.id}
                    className={`rounded-lg border px-3 py-2 ${
                      wasCorrect === true
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : wasCorrect === false
                          ? 'border-rose-500/20 bg-rose-500/5'
                          : 'border-paper-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink">{w.word}</span>
                      {w.pronunciation && (
                        <>
                          <span
                            className="text-[10px] text-muted-foreground/70"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {w.pronunciation}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const u = new SpeechSynthesisUtterance(w.word)
                              u.lang = 'en-US'
                              u.rate = 0.85
                              speechSynthesis.cancel()
                              speechSynthesis.speak(u)
                            }}
                            className="rounded-md p-0.5 text-muted-foreground/50 transition-colors hover:text-brand"
                            title="Listen"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                      {wasCorrect === true && <CheckCircle2 className="ml-auto h-3 w-3 text-emerald-500" />}
                      {wasCorrect === false && <XCircle className="ml-auto h-3 w-3 text-rose-500" />}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{w.meaning}</p>
                    {w.translation && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">{w.translation}</p>
                    )}
                    {w.example && (
                      <p className="mt-1 text-[10px] italic text-muted-foreground/70">&ldquo;{w.example}&rdquo;</p>
                    )}
                    {result && !result.correct && (
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <span className="text-rose-500">Your answer: {result.userAnswer}</span>
                        <span className="text-emerald-500">Correct: {result.correctAnswer}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function HistoryView({ onBack, onRetest }: HistoryViewProps) {
  const [sessions, setSessions] = useState<PastSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await authFetch('/api/word-lab/stats')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setSessions(data.dailyLogs || [])
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-paper-border bg-card p-8 text-center shadow-sm">
        <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/30" />
        <h3 className="mt-3 font-serif text-lg font-bold text-ink">No Sessions Yet</h3>
        <p className="mt-1 text-xs text-muted-foreground">Complete your first Word Lab session to see history here.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground/60 transition-all hover:border-muted-foreground/30 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <h2 className="font-serif text-base font-bold text-ink">History</h2>
        <span className="text-[10px] text-muted-foreground/60">{sessions.length} sessions</span>
      </div>
      <div className="space-y-2">
        {sessions.toReversed().map((session) => (
          <SessionCard key={session.date} session={session} onRetest={onRetest} />
        ))}
      </div>
    </div>
  )
}
