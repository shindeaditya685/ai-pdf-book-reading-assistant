'use client'

import { useState } from 'react'
import { Loader2, Calendar, ListChecks, Play, Brain, HelpCircle, Type, Shuffle, Sparkles, BookOpen } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { CustomTestWord, QuestionType } from './types'

const QUESTION_TYPE_DETAILS: Record<string, { label: string; desc: string; icon: any; color: string }> = {
  'multiple-choice': {
    label: 'Multiple Choice',
    desc: 'Pick the correct meaning from 4 options',
    icon: HelpCircle,
    color: 'border-violet-200 dark:border-violet-800/40 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/10',
  },
  'fill-blank': {
    label: 'Fill in the Blank',
    desc: 'Type the word that fits the sentence',
    icon: Type,
    color: 'border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10',
  },
  'reverse-recall': {
    label: 'Reverse Recall',
    desc: 'Type the word that matches the definition',
    icon: Brain,
    color: 'border-amber-200 dark:border-amber-800/40 text-amber-605 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/10',
  },
  'mixed': {
    label: 'Mixed (Random)',
    desc: 'Random type per word',
    icon: Shuffle,
    color: 'border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/10',
  },
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
  const [generatingStatus, setGeneratingStatus] = useState('')
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
    setGeneratingStatus('Preparing question generation...')
    setError('')
    try {
      const BATCH_SIZE = 30
      const allWords = preview.words
      const batches: CustomTestWord[][] = []
      for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
        batches.push(allWords.slice(i, i + BATCH_SIZE))
      }

      const allQuestions: any[] = []

      for (let b = 0; b < batches.length; b++) {
        setGeneratingStatus(`Generating batch ${b + 1} of ${batches.length} (${Math.round((b / batches.length) * 100)}%)...`)
        const res = await authFetch('/api/word-lab/custom-test/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            words: batches[b],
            questionType,
            offset: b * BATCH_SIZE,
          }),
        })
        const data = await res.json()
        if (res.ok && data.questions) {
          allQuestions.push(...data.questions)
        } else {
          throw new Error(data.error || `Failed to generate questions for batch ${b + 1}`)
        }
      }

      const shuffled = [...allQuestions]
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
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions')
    } finally {
      setGenerating(false)
      setGeneratingStatus('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent p-6 shadow-md backdrop-blur-md dark:border-stone-800/40 dark:bg-stone-900/40">
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
        <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-2xl" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/20">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-black tracking-tight text-stone-900 dark:text-white">
              Custom Test Studio
            </h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Select a custom date range and let AI construct a tailored vocabulary test for you.
            </p>
          </div>
        </div>
      </div>

      {!generating && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-md dark:border-stone-850 dark:bg-stone-900/60">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 transition-colors group-focus-within:text-violet-555 dark:text-stone-400">
                <Calendar className="h-3.5 w-3.5" />
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPreview(null) }}
                max={dateTo}
                className="mt-1.5 w-full rounded-xl border border-stone-200/80 bg-white px-3.5 py-2.5 text-sm text-stone-900 transition-all hover:border-stone-300 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-stone-800 dark:bg-stone-800/80 dark:text-white dark:hover:border-stone-700 dark:focus:border-violet-500 dark:focus:ring-violet-500/20"
              />
            </div>
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 transition-colors group-focus-within:text-violet-555 dark:text-stone-400">
                <Calendar className="h-3.5 w-3.5" />
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPreview(null) }}
                min={dateFrom}
                max={today}
                className="mt-1.5 w-full rounded-xl border border-stone-200/80 bg-white px-3.5 py-2.5 text-sm text-stone-900 transition-all hover:border-stone-300 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-stone-800 dark:bg-stone-800/80 dark:text-white dark:hover:border-stone-700 dark:focus:border-violet-500 dark:focus:ring-violet-500/20"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
              <ListChecks className="h-3.5 w-3.5" />
              Question Type
            </label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {Object.entries(QUESTION_TYPE_DETAILS).map(([key, item]) => {
                const Icon = item.icon
                const isSelected = questionType === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setQuestionType(key as any); setPreview(null) }}
                    className={`relative flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                      isSelected
                        ? `${item.color} border-violet-500 ring-2 ring-violet-500/20 shadow-md`
                        : 'border-stone-200/85 bg-white hover:border-stone-300 hover:shadow-sm dark:border-stone-800 dark:bg-stone-800/40 dark:hover:border-stone-700'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      isSelected
                        ? 'bg-white shadow-sm dark:bg-stone-900'
                        : 'bg-stone-50 dark:bg-stone-800'
                    }`}>
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-stone-400'}`} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-900 dark:text-white">{item.label}</div>
                      <div className="mt-0.5 text-[10px] leading-normal text-stone-500 dark:text-stone-400">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 dark:border-stone-800/60">
            <button
              onClick={handlePreview}
              disabled={!dateFrom || !dateTo || previewing}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-stone-900 to-stone-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:from-white dark:to-stone-100 dark:text-stone-900"
            >
              {previewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {previewing ? 'Scanning sessions...' : 'Fetch Date Range'}
            </button>
            {preview && preview.wordCount > 0 && (
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                Found <strong className="text-stone-950 dark:text-white">{preview.wordCount}</strong> word{preview.wordCount !== 1 ? 's' : ''} in <strong className="text-stone-950 dark:text-white">{preview.sessionCount}</strong> session{preview.sessionCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-600 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400">
          {error}
        </div>
      )}

      {!generating && preview && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-md dark:border-stone-805 dark:bg-stone-900/60 animate-fade-in-up">
          {preview.wordCount === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-50 dark:bg-stone-800">
                <ListChecks className="h-6 w-6 text-stone-400 dark:text-stone-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-stone-500 dark:text-stone-400">No studied words found in this date range.</p>
              <p className="mt-1 text-xs text-stone-400">Try selecting a different date range or complete some daily sessions first.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-stone-100 pb-4 dark:border-stone-800/60">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-stone-950 dark:text-white">{preview.wordCount}</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">words ready</span>
                </div>
                <button
                  onClick={handleStart}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.03] hover:shadow-violet-500/30 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Launch Test ({preview.wordCount} Qs)
                </button>
              </div>
              <div className="mt-5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">Word List Preview</label>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/50 p-4 dark:border-stone-800/40 dark:bg-stone-950/40">
                  <div className="flex flex-wrap gap-2">
                    {preview.words.map((w) => (
                      <span
                        key={w.id}
                        className="inline-flex items-center rounded-lg border border-stone-200/60 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 shadow-sm transition-all hover:border-violet-300 hover:text-violet-600 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-violet-850 dark:hover:text-violet-400"
                      >
                        {w.word}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {generating && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-8 shadow-md dark:border-stone-850 dark:bg-stone-900/60">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-16 w-16 animate-ping rounded-full bg-violet-500/10" />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-55 text-violet-500 dark:bg-violet-950/30 dark:text-violet-400">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
            </div>
            <h4 className="mt-4 text-sm font-bold text-stone-900 dark:text-white">AI Question Generation</h4>
            <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400 max-w-xs leading-relaxed">
              We are grouping words in batches and prompting the AI model to generate contextual vocabulary questions.
            </p>
            <div className="mt-6 w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                  style={{
                    width: (() => {
                      if (generatingStatus.includes('%')) {
                        const pct = generatingStatus.match(/\d+/)?.[0] || '0'
                        return `${pct}%`
                      }
                      return '15%'
                    })()
                  }}
                />
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400 animate-pulse">
                {generatingStatus}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
