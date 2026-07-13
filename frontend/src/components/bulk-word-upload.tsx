'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, ChevronDown, Loader2, CheckCircle2, XCircle, Brain, AlertCircle, Library, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/api'

interface BulkResult {
  word: string
  meaning: string
  translation?: string
}

interface CollectionInfo {
  _id: string
  name: string
  wordCount: number
}

export function BulkWordUpload({ onComplete }: { onComplete?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [createFlashcards, setCreateFlashcards] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState('')
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [result, setResult] = useState<{ added: number; flashcardCount: number; words: BulkResult[]; errors?: string[]; collection?: CollectionInfo } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const wordCount = input
    ? [...new Set(input.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean))].length
    : 0

  const handleSubmit = async () => {
    if (!input.trim() || status === 'processing') return

    setStatus('processing')
    setResult(null)
    setErrorMsg('')
    setProgress('Parsing words...')

    try {
      const rawWords = input
        .split(/[,]+/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
      const uniqueWords = [...new Set(rawWords)]
      const totalB = Math.ceil(uniqueWords.length / 20)
      setTotalBatches(totalB)
      setCurrentBatch(0)
      setProgress(`Processing 0 of ${totalB} batch${totalB > 1 ? 'es' : ''}...`)

      const res = await authFetch('/api/vocabulary/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: uniqueWords.join(','),
          createFlashcards,
          collectionName: collectionName.trim() || undefined,
        }),
      })

      const data = await res.json()
      setCurrentBatch(totalB)

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(data.error || 'Failed to process words')
        return
      }

      setResult(data)
      setStatus('done')
      setProgress('')
      onComplete?.()
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection and try again.')
      setProgress('')
    }
  }

  const reset = () => {
    setInput('')
    setCollectionName('')
    setCreateFlashcards(false)
    setStatus('idle')
    setResult(null)
    setErrorMsg('')
    setProgress('')
    setCurrentBatch(0)
    setTotalBatches(0)
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Upload className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Import Words</span>
            <span className="ml-2 text-[11px] text-muted-foreground/60">
              Bulk-add words to your dictionary
            </span>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste words separated by commas, e.g.: ephemeral, pragmatic, ubiquitous, sesquipedalian, serendipity"
                className="min-h-[100px] w-full resize-y rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                disabled={status === 'processing'}
              />

              {/* Collection name */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Library className="h-3 w-3" />
                  Collection (optional &mdash; groups these words together)
                </label>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="e.g. The Great Gatsby, IELTS Vocabulary, Chapter 5"
                  className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
                  disabled={status === 'processing'}
                />
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createFlashcards}
                      onChange={(e) => setCreateFlashcards(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border text-emerald-600 focus:ring-emerald-500"
                      disabled={status === 'processing'}
                    />
                    <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      <Brain className="h-3 w-3" />
                      Also create flashcards
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  {wordCount > 0 && (
                    <span className="text-[11px] font-medium text-muted-foreground/60 tabular-nums">
                      {wordCount} word{wordCount > 1 ? 's' : ''}
                      {wordCount > 100 && (
                        <span className="ml-1 text-amber-600">(max 100)</span>
                      )}
                    </span>
                  )}
                  <Button
                    size="sm"
                    disabled={!input.trim() || wordCount === 0 || wordCount > 100 || status === 'processing'}
                    onClick={handleSubmit}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {status === 'processing' ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3 w-3" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Progress indicator */}
              {status === 'processing' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                  <span>{progress || 'Processing...'}</span>
                </div>
              )}

              {/* Error display */}
              {status === 'error' && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-950/20">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">{errorMsg}</p>
                  </div>
                  <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground shrink-0">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Result display */}
              {status === 'done' && result && (
                <div className="space-y-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {result.added} word{result.added !== 1 ? 's' : ''} added
                      </span>
                      {result.flashcardCount > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          ({result.flashcardCount} flashcard{result.flashcardCount !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">
                      Clear
                    </button>
                  </div>

                  {result.collection && (
                    <Link
                      href={`/collections?id=${result.collection._id}`}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-100/50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      <Library className="h-3 w-3" />
                      View collection &ldquo;{result.collection.name}&rdquo;
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </Link>
                  )}

                  {result.errors && result.errors.length > 0 && (
                    <div className="space-y-1">
                      {result.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                          <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.words.length > 0 && (
                    <div className="max-h-24 overflow-y-auto space-y-0.5">
                      {result.words.map((w) => (
                        <div key={w.word} className="flex items-center gap-2 text-[11px]">
                          <span className="font-semibold text-foreground">{w.word}</span>
                          <span className="text-muted-foreground truncate">{w.meaning}</span>
                          {w.translation && (
                            <span className="shrink-0 text-emerald-600 dark:text-emerald-400">{w.translation}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
