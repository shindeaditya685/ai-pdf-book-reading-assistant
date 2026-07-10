'use client'

import { useState } from 'react'
import { Loader2, Calendar, ListChecks, Play } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { CustomTestWord, QuestionType } from './types'

const QUESTION_TYPE_LABELS: Record<string, string> = {
  'multiple-choice': 'Multiple Choice',
  'fill-blank': 'Fill in the Blank',
  'reverse-recall': 'Reverse Recall',
  'mixed': 'Mixed (Random)',
}

const QUESTION_TYPE_DESCS: Record<string, string> = {
  'multiple-choice': 'Pick the correct meaning from 4 options',
  'fill-blank': 'Type the word that fits the sentence',
  'reverse-recall': 'Type the word that matches the definition',
  'mixed': 'Random type per word',
}

export function CustomTestSetup({
  onStartTest,
  onBack,
}: {
  onStartTest: (words: CustomTestWord[], questionType: QuestionType | 'mixed', questions: any[], dateFrom: string, dateTo: string) => void
  onBack: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(sevenDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [questionType, setQuestionType] = useState<QuestionType | 'mixed'>('multiple-choice')
  const [preview, setPreview] = useState<{ words: CustomTestWord[]; sessionCount: number; wordCount: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const handlePreview = async () => {
    if (!dateFrom || !dateTo) return
    setPreviewing(true)
    setError('')
    setPreview(null)
    try {
      const res = await authFetch('/api/word-lab/custom-test/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo }),
      })
      const data = await res.json()
      if (res.ok) {
        setPreview({ words: data.words, sessionCount: data.sessionCount, wordCount: data.wordCount })
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
    setGenerating(true)
    setError('')
    try {
      const res = await authFetch('/api/word-lab/custom-test/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: preview.words, questionType }),
      })
      const data = await res.json()
      if (res.ok && data.questions) {
        const shuffled = [...data.questions]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        for (const q of shuffled) {
          if (q.options && Array.isArray(q.options)) {
            for (let i = q.options.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1))
              ;[q.options[i], q.options[j]] = [q.options[j], q.options[i]]
            }
          }
        }
        onStartTest(preview.words, questionType, shuffled, dateFrom, dateTo)
      } else {
        setError(data.error || 'Failed to generate questions')
      }
    } catch {
      setError('Failed to generate questions')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
        <h2 className="font-serif text-lg font-bold tracking-tight text-stone-900 dark:text-white">
          Custom Test
        </h2>
        <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
          Pick a date range and question type — one question per word.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
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
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:focus:border-amber-500 dark:focus:ring-amber-800/30"
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
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:focus:border-amber-500 dark:focus:ring-amber-800/30"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
            <ListChecks className="h-3 w-3" />
            Question Type
          </label>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setQuestionType(key as any); setPreview(null) }}
                className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                  questionType === key
                    ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200 dark:border-amber-500 dark:bg-amber-900/20 dark:ring-amber-800/30'
                    : 'border-stone-200 bg-white hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600'
                }`}
              >
                <div className="text-xs font-bold text-stone-900 dark:text-white">{label}</div>
                <div className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">
                  {QUESTION_TYPE_DESCS[key]}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={!dateFrom || !dateTo || previewing}
            className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
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
              {preview.wordCount} word{preview.wordCount !== 1 ? 's' : ''} from {preview.sessionCount} session{preview.sessionCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400">
          {error}
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
          {preview.wordCount === 0 ? (
            <div className="py-6 text-center">
              <ListChecks className="mx-auto h-8 w-8 text-stone-300 dark:text-stone-600" />
              <p className="mt-2 text-sm text-stone-400 dark:text-stone-500">No completed tests found in this date range.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-stone-900 dark:text-white">{preview.wordCount}</span>
                  <span className="ml-1.5 text-sm text-stone-400 dark:text-stone-500">words found</span>
                </div>
                <button
                  onClick={handleStart}
                  disabled={generating}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {generating ? 'Generating...' : `Start Test (${preview.wordCount} questions)`}
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
            </>
          )}
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="mt-3 text-sm font-medium text-stone-500">Generating {questionType === 'mixed' ? '' : questionType.replace('-', ' ')} questions with AI...</p>
        </div>
      )}
    </div>
  )
}
