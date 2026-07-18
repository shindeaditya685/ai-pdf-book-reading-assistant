'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, ChevronDown, Loader2, CheckCircle2, XCircle, Brain, AlertCircle, Library, ExternalLink, BookText, Plus, Check, Sparkles, ArrowRight, Volume2 } from 'lucide-react'
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

interface Book {
  name: string
  label: string
}

export function BulkWordUpload({ onComplete }: { onComplete?: () => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [input, setInput] = useState('')
  const [createFlashcards, setCreateFlashcards] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [booksLoading, setBooksLoading] = useState(false)
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [result, setResult] = useState<{ totalAdded: number; flashcardCount: number; words: BulkResult[]; errors?: string[]; collection?: CollectionInfo } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false)
  const [collectionDropdownOpen, setCollectionDropdownOpen] = useState(false)
  const bookRef = useRef<HTMLDivElement>(null)
  const collectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showAdvanced) return
    setBooksLoading(true)
    authFetch('/api/books')
      .then((r) => r.json())
      .then((data) => setBooks(data.books || []))
      .catch(() => {})
      .finally(() => setBooksLoading(false))
    authFetch('/api/collections')
      .then((r) => r.json())
      .then((data) => setCollections(data.collections || []))
      .catch(() => {})
  }, [showAdvanced])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bookRef.current && !bookRef.current.contains(e.target as Node)) {
        setBookDropdownOpen(false)
      }
      if (collectionRef.current && !collectionRef.current.contains(e.target as Node)) {
        setCollectionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }

  const wordCount = input
    ? [...new Set(input.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean))].length
    : 0

  const handleSubmit = async () => {
    if (!input.trim() || status === 'processing') return

    setStatus('processing')
    setResult(null)
    setErrorMsg('')

    try {
      const rawWords = input
        .split(/[,]+/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
      const uniqueWords = [...new Set(rawWords)]
      const totalB = Math.ceil(uniqueWords.length / 20)
      setTotalBatches(totalB)
      setCurrentBatch(0)

      const res = await authFetch('/api/vocabulary/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: uniqueWords.join(','),
          createFlashcards,
          collectionName: collectionName.trim() || undefined,
          pdfFileName: selectedBook?.name || undefined,
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
      onComplete?.()
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection and try again.')
    }
  }

  const reset = () => {
    setInput('')
    setCollectionName('')
    setShowNewCollectionInput(false)
    setSelectedBook(null)
    setCreateFlashcards(false)
    setStatus('idle')
    setResult(null)
    setErrorMsg('')
    setCurrentBatch(0)
    setTotalBatches(0)
  }

  return (
    <div className={`rounded-xl border shadow-sm transition-all ${
      status === 'done'
        ? 'border-emerald-400/30 bg-emerald-50/30 dark:bg-emerald-950/10'
        : 'border-border/50 bg-card'
    }`}>
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm shadow-amber-500/15">
            <Upload className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Import Words</span>
            <span className="ml-2 text-[11px] text-muted-foreground/50">
              Add words with AI-powered definitions
            </span>
          </div>
        </div>
        {status === 'idle' && !showAdvanced && (
          <button
            onClick={() => setShowAdvanced(true)}
            className="flex items-center gap-1 rounded-md bg-amber-50/50 px-2.5 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100/50 dark:bg-amber-900/15 dark:text-amber-400 dark:hover:bg-amber-900/25 transition-colors"
          >
            Options
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ── BODY ── */}
      <div className="border-t border-border/30 px-4 pb-4 pt-3 space-y-3">
        {/* Input area */}
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ephemeral, pragmatic, ubiquitous, sesquipedalian, serendipity"
            rows={3}
            className="min-h-[72px] w-full resize-y rounded-lg border border-border/50 bg-background/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/10 disabled:opacity-50"
            disabled={status === 'processing'}
          />
          {input && wordCount > 0 && (
            <div className="absolute bottom-2 right-2 rounded-md bg-amber-100/60 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 tabular-nums">
              {wordCount} word{wordCount !== 1 ? 's' : ''}
              {wordCount > 100 && (
                <span className="ml-1 text-red-500">(max 100)</span>
              )}
            </div>
          )}
        </div>

        {/* ── ADVANCED OPTIONS ── */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Book selector */}
              <div ref={bookRef} className="relative">
                <label className="block text-[10px] font-medium text-muted-foreground/60 mb-1 uppercase tracking-wider">
                  Link to book
                </label>
                <button
                  type="button"
                  onClick={() => setBookDropdownOpen(!bookDropdownOpen)}
                  className="flex h-9 w-full items-center justify-between rounded-lg border border-border/50 bg-background/60 px-3 text-sm text-foreground outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/10"
                  disabled={status === 'processing'}
                >
                  <span className={selectedBook ? '' : 'text-muted-foreground/40'}>
                    {selectedBook ? selectedBook.label : booksLoading ? 'Loading...' : 'None (words not linked to a book)'}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${bookDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {bookDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-background shadow-lg [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/15 [&::-webkit-scrollbar-track]:bg-transparent">
                    <button
                      type="button"
                      onClick={() => { setSelectedBook(null); setBookDropdownOpen(false) }}
                      className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${!selectedBook ? 'bg-amber-50/50 dark:bg-amber-900/10 font-semibold' : 'text-muted-foreground'}`}
                    >
                      None
                    </button>
                    {books.map((book) => (
                      <button
                        key={book.name}
                        type="button"
                        onClick={() => { setSelectedBook(book); setBookDropdownOpen(false) }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${selectedBook?.name === book.name ? 'bg-amber-50/50 dark:bg-amber-900/10 font-semibold text-foreground' : 'text-foreground'}`}
                      >
                        <BookText className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                        <span className="truncate">{book.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Collection selector */}
              <div ref={collectionRef} className="relative">
                <label className="block text-[10px] font-medium text-muted-foreground/60 mb-1 uppercase tracking-wider">
                  Add to collection
                </label>
                {showNewCollectionInput ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      placeholder="New collection name..."
                      className="h-9 flex-1 rounded-lg border border-border/50 bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/10"
                      disabled={status === 'processing'}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setCollectionName(''); setShowNewCollectionInput(false) }}
                      className="h-9 rounded-lg border border-border/50 px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setCollectionDropdownOpen(!collectionDropdownOpen)}
                      className="flex h-9 w-full items-center justify-between rounded-lg border border-border/50 bg-background/60 px-3 text-sm text-foreground outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/10"
                      disabled={status === 'processing'}
                    >
                      <span className={collectionName ? '' : 'text-muted-foreground/40'}>
                        {collectionName || 'None'}
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${collectionDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {collectionDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-background shadow-lg [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/15 [&::-webkit-scrollbar-track]:bg-transparent">
                        <button
                          type="button"
                          onClick={() => { setCollectionName(''); setCollectionDropdownOpen(false) }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${!collectionName ? 'bg-amber-50/50 dark:bg-amber-900/10 font-semibold text-foreground' : 'text-muted-foreground'}`}
                        >
                          <Check className={`h-3 w-3 ${!collectionName ? 'opacity-100' : 'opacity-0'}`} />
                          None
                        </button>
                        {collections.map((c) => (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => { setCollectionName(c.name); setCollectionDropdownOpen(false) }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${collectionName === c.name ? 'bg-amber-50/50 dark:bg-amber-900/10 font-semibold text-foreground' : 'text-foreground'}`}
                          >
                            <Check className={`h-3 w-3 ${collectionName === c.name ? 'opacity-100' : 'opacity-0'}`} />
                            <Library className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                            <span className="truncate">{c.name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground/40">{c.wordCount || 0}</span>
                          </button>
                        ))}
                        <div className="border-t border-border/30" />
                        <button
                          type="button"
                          onClick={() => { setShowNewCollectionInput(true); setCollectionDropdownOpen(false) }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-amber-600 hover:bg-amber-50/50 dark:text-amber-400 dark:hover:bg-amber-900/10 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Create new collection...
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Flashcards toggle */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={createFlashcards}
                      onChange={(e) => setCreateFlashcards(e.target.checked)}
                      className="peer sr-only"
                      disabled={status === 'processing'}
                    />
                    <div className={`h-5 w-9 rounded-full transition-colors ${
                      createFlashcards ? 'bg-amber-400' : 'bg-border'
                    }`} />
                    <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      createFlashcards ? 'translate-x-4' : ''
                    }`} />
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Brain className="h-3 w-3" />
                    Auto-create flashcards
                  </span>
                </label>
                {showAdvanced && (
                  <button
                    onClick={() => setShowAdvanced(false)}
                    className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                  >
                    Hide options
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ACTION ROW ── */}
        {!showAdvanced && status === 'idle' && (
          <div className="flex items-center justify-end gap-2 pt-1">
            {wordCount > 0 && (
              <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                {wordCount} word{wordCount !== 1 ? 's' : ''}
                {wordCount > 100 && <span className="ml-1 text-red-400">(max 100)</span>}
              </span>
            )}
            <Button
              size="sm"
              disabled={!input.trim() || wordCount === 0 || wordCount > 100}
              onClick={handleSubmit}
              className="h-8 gap-1.5 bg-amber-500 text-xs font-semibold text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-40"
            >
              <>
                <Sparkles className="h-3 w-3" />
                Import Words
              </>
            </Button>
          </div>
        )}

        {/* ── ACTION ROW (advanced visible) ── */}
        {showAdvanced && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {wordCount > 0 && (
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                  {wordCount} word{wordCount !== 1 ? 's' : ''}
                  {wordCount > 100 && <span className="ml-1 text-red-400">(max 100)</span>}
                </span>
              )}
            </div>
            <Button
              size="sm"
              disabled={!input.trim() || wordCount === 0 || wordCount > 100 || status === 'processing'}
              onClick={handleSubmit}
              className="h-8 gap-1.5 bg-amber-500 text-xs font-semibold text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-40"
            >
              {status === 'processing' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <ArrowRight className="h-3 w-3" />
                  Import {wordCount > 0 ? `${wordCount} Word${wordCount !== 1 ? 's' : ''}` : 'Words'}
                </>
              )}
            </Button>
          </div>
        )}

        {/* ── PROGRESS ── */}
        {status === 'processing' && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50/50 px-3 py-2 dark:bg-amber-900/10">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
            <div className="flex-1 min-w-0">
              <div className="h-1.5 rounded-full bg-amber-200/50 dark:bg-amber-800/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
                  style={{ width: totalBatches > 0 ? `${(currentBatch / totalBatches) * 100}%` : '0%' }}
                />
              </div>
            </div>
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 tabular-nums">
              {currentBatch}/{totalBatches}
            </span>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/15">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">{errorMsg}</p>
            </div>
            <button onClick={reset} className="shrink-0 text-xs text-muted-foreground/50 hover:text-foreground transition-colors">Dismiss</button>
          </div>
        )}

        {/* ── RESULT ── */}
        {status === 'done' && result && (
          <div className="space-y-2.5 rounded-lg bg-emerald-50/70 px-3 py-3 dark:bg-emerald-950/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {result.totalAdded} word{result.totalAdded !== 1 ? 's' : ''} added
                </span>
                {result.flashcardCount > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    ({result.flashcardCount} flashcard{result.flashcardCount !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <button onClick={reset} className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors">
                Clear
              </button>
            </div>

            {result.collection && (
              <Link
                href={`/collections?id=${result.collection._id}`}
                className="flex items-center gap-1.5 rounded-md bg-emerald-100/50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/15 dark:text-emerald-400 dark:hover:bg-emerald-900/25 transition-colors"
              >
                <Library className="h-3 w-3" />
                View collection &ldquo;{result.collection.name}&rdquo;
                <ExternalLink className="h-3 w-3 ml-auto" />
              </Link>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="space-y-0.5">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {result.words.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-0.5 rounded-md bg-white/50 dark:bg-black/20 p-2">
                {result.words.map((w) => (
                  <div key={w.word} className="flex items-center gap-2 text-[11px]">
                    <button
                      onClick={() => speak(w.word)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground/20 transition-colors hover:text-amber-500 hover:bg-amber-500/10"
                      title="Listen"
                      aria-label={`Pronounce ${w.word}`}
                    >
                      <Volume2 className="h-3 w-3" />
                    </button>
                    <span className="font-semibold text-foreground">{w.word}</span>
                    <span className="text-muted-foreground/70 truncate">{w.meaning}</span>
                    {w.translation && (
                      <span className="shrink-0 text-emerald-600/70 dark:text-emerald-400/70">{w.translation}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
