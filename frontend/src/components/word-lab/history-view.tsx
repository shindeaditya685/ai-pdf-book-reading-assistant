'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { WordLabWord, TestResult } from './types'
import { ArrowLeft, CheckCircle2, XCircle, CalendarDays, Loader2, ChevronDown, ChevronRight, Volume2 } from 'lucide-react'

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
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function SessionCard({ session }: { session: PastSession }) {
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
    <div className="rounded-lg border border-stone-200 bg-white transition-all dark:border-stone-700/50 dark:bg-stone-900/60">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />}
        <CalendarDays className="h-4 w-4 text-amber-500" />
        <span className="flex-1 text-sm font-semibold text-stone-800 dark:text-stone-200">
          {formatDate(session.date)}
        </span>
        {completed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Done
          </span>
        ) : allStudied ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Studied
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-bold text-stone-400 dark:bg-stone-800 dark:text-stone-500">
            Incomplete
          </span>
        )}
        {completed && (
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
            {accuracy}%
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-4 pb-3 pt-2 dark:border-stone-800">
          {completed && totalQuestions > 0 && (
            <div className="mb-2 flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
              <span className="text-emerald-600 dark:text-emerald-400">{correct} correct</span>
              <span className="text-rose-600 dark:text-rose-400">{totalQuestions - correct} missed</span>
              <span className="text-stone-400">{accuracy}% accuracy</span>
            </div>
          )}

          {completed && missed.length > 0 && (
            <div className="mb-3 rounded-md bg-rose-50 p-2 dark:bg-rose-950/10">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-rose-500">Missed words</p>
              <div className="flex flex-wrap gap-1.5">
                {missed.map((r) => {
                  const w = session.words?.find((w) => w.id === r.wordId)
                  return (
                    <span key={r.wordId} className="inline-flex items-center gap-1 rounded-md bg-rose-100/50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
                      <XCircle className="h-2.5 w-2.5" />
                      {w?.word || r.word}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">Words</p>
            <div className="space-y-1.5">
              {session.words?.map((w) => {
                const result = session.testResults?.find((r) => r.wordId === w.id)
                const wasCorrect = result?.correct
                return (
                  <div
                    key={w.id}
                    className={`rounded-lg border px-3 py-2 ${
                      wasCorrect === true
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/10'
                        : wasCorrect === false
                          ? 'border-rose-200 bg-rose-50/50 dark:border-rose-800/30 dark:bg-rose-950/10'
                          : 'border-stone-200 bg-stone-50/50 dark:border-stone-700/30 dark:bg-stone-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-900 dark:text-white">{w.word}</span>
                      {w.pronunciation && (
                        <>
                          <span className="text-[10px] text-stone-400 dark:text-stone-500">{w.pronunciation}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const u = new SpeechSynthesisUtterance(w.word)
                              u.lang = 'en-US'
                              u.rate = 0.85
                              speechSynthesis.cancel()
                              speechSynthesis.speak(u)
                            }}
                            className="rounded-md p-0.5 text-stone-400 transition-colors hover:text-amber-500"
                            title="Listen"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                      {wasCorrect === true && <CheckCircle2 className="ml-auto h-3 w-3 text-emerald-500" />}
                      {wasCorrect === false && <XCircle className="ml-auto h-3 w-3 text-rose-500" />}
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">{w.meaning}</p>
                    {w.translation && (
                      <p className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">{w.translation}</p>
                    )}
                    {w.example && (
                      <p className="mt-1 text-[10px] italic text-stone-400 dark:text-stone-500">&ldquo;{w.example}&rdquo;</p>
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

export function HistoryView({ onBack }: HistoryViewProps) {
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
        <Loader2 className="h-5 w-5 animate-spin text-stone-300" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
        <CalendarDays className="mx-auto h-8 w-8 text-stone-300 dark:text-stone-600" />
        <h3 className="mt-3 font-serif text-lg font-bold text-stone-900 dark:text-white">No Sessions Yet</h3>
        <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">Complete your first Word Lab session to see history here.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-400 transition-all hover:border-stone-300 hover:text-stone-600 dark:border-stone-700 dark:hover:border-stone-600 dark:hover:text-stone-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <h2 className="font-serif text-base font-bold text-stone-900 dark:text-white">History</h2>
        <span className="text-[10px] text-stone-400 dark:text-stone-500">{sessions.length} sessions</span>
      </div>
      <div className="space-y-2">
        {sessions.toReversed().map((session) => (
          <SessionCard key={session.date} session={session} />
        ))}
      </div>
    </div>
  )
}
