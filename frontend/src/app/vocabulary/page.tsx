'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Search, ChevronDown, Loader2, BookText, Hash, Trash2, ChevronLeft, ChevronRight, List, Quote, Languages, X, Volume2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { BulkWordUpload } from '@/components/bulk-word-upload'

const WORDS_PER_PAGE = 50

interface VocabWord {
  word: string
  frequency: number
  meaning: string
  pronunciation: string
  translation: string
  sentence: string
  firstSeen: string
  lastSeen: string
  pdfs: string[]
}

interface WordList {
  _id: string
  name: string
  words: { word: string }[]
}

interface LetterGroup {
  letter: string
  words: VocabWord[]
}

function groupByLetter(words: VocabWord[]): LetterGroup[] {
  const groups: Record<string, VocabWord[]> = {}
  for (const w of words) {
    const letter = w.word.charAt(0).toUpperCase()
    if (!/[A-Z]/.test(letter)) continue
    if (!groups[letter]) groups[letter] = []
    groups[letter].push(w)
  }
  return Object.keys(groups).sort().map((letter) => ({ letter, words: groups[letter] }))
}

export default function VocabularyPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [words, setWords] = useState<VocabWord[]>([])
  const [pdfs, setPdfs] = useState<string[]>([])
  const [wordLists, setWordLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pdfFilter, setPdfFilter] = useState('')
  const [listFilter, setListFilter] = useState('')
  const [letterFilter, setLetterFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadWords()
    authFetch('/api/word-lists').then(r => r.json()).then(data => {
      setWordLists(data.lists || [])
    }).catch(() => {})
  }, [user, authLoading, router])

  const loadWords = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort: 'alpha', order: 'asc' })
      if (pdfFilter) params.set('pdfFileName', pdfFilter)
      if (search) params.set('search', search)
      const res = await authFetch(`/api/vocabulary?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWords(data.words || [])
        setPdfs(data.pdfs || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    setPage(1)
    loadWords()
  }, [pdfFilter])

  useEffect(() => {
    setPage(1)
  }, [search])

  const handleDeleteWord = async (word: string) => {
    const res = await authFetch(`/api/vocabulary?word=${encodeURIComponent(word)}`, { method: 'DELETE' })
    if (res.ok) {
      setWords((prev) => prev.filter((w) => w.word !== word))
    }
    setDeleteConfirm(null)
  }

  const filtered = useMemo(() => {
    let result = words
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((w) => w.word.toLowerCase().includes(q))
    }
    if (listFilter) {
      const list = wordLists.find(l => l._id === listFilter)
      if (list) {
        const listWords = new Set(list.words.map(w => w.word.toLowerCase()))
        result = result.filter(w => listWords.has(w.word.toLowerCase()))
      }
    }
    if (letterFilter) {
      result = result.filter(w => w.word.charAt(0).toLowerCase() === letterFilter.toLowerCase())
    }
    return result
  }, [words, search, listFilter, wordLists, letterFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / WORDS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * WORDS_PER_PAGE, page * WORDS_PER_PAGE)
  const groups = useMemo(() => groupByLetter(paginated), [paginated])
  const availableLetters = useMemo(() => {
    const s = new Set<string>()
    for (const w of filtered) {
      const l = w.word.charAt(0).toUpperCase()
      if (/[A-Z]/.test(l)) s.add(l)
    }
    return s
  }, [filtered])

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    const voices = window.speechSynthesis.getVoices()
    const english = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
    if (english) utterance.voice = english
    window.speechSynthesis.speak(utterance)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1)
      loadWords()
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  const activeFilters = [search, pdfFilter, listFilter, letterFilter].some(Boolean)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-amber-500/10 bg-background/70 px-4 shadow-[0_1px_0_0_rgba(212,163,115,0.06)] backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/40 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm shadow-amber-500/15">
            <BookText className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">Lexicon</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 tabular-nums">
            {filtered.length} word{filtered.length !== 1 ? 's' : ''}
          </span>
          {pdfs.length > 0 && (
            <span className="hidden rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60 sm:inline-block tabular-nums">
              {pdfs.length} book{pdfs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── FILTERS ── */}
        <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search your lexicon..."
              className="h-9 w-full rounded-lg border border-border/50 bg-background/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/35 outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/12"
            />
          </div>
          <select
            value={pdfFilter}
            onChange={(e) => { setPdfFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-lg border border-border/50 bg-background/60 px-2.5 text-sm text-foreground outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/12 sm:w-40"
          >
            <option value="">All Books</option>
            {pdfs.filter(p => p !== 'bulk-import').map((p) => (
              <option key={p} value={p}>{p.split('/').pop() || p}</option>
            ))}
            {pdfs.includes('bulk-import') && (
              <option value="bulk-import">Imported Words</option>
            )}
          </select>
          <select
            value={listFilter}
            onChange={(e) => { setListFilter(e.target.value); setPage(1) }}
            className="h-9 rounded-lg border border-border/50 bg-background/60 px-2.5 text-sm text-foreground outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/12 sm:w-36"
          >
            <option value="">All Lists</option>
            {wordLists.map((l) => (
              <option key={l._id} value={l._id}>{l.name} ({l.words.length})</option>
            ))}
          </select>
        </div>

        {/* ── BULK WORD IMPORT ── */}
        <div className="mb-5">
          <BulkWordUpload onComplete={loadWords} />
        </div>

        {/* ── ALPHABET NAVIGATION ── */}
        {filtered.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-1">
            <button
              onClick={() => { setLetterFilter(''); setPage(1) }}
              className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition-all ${
                !letterFilter
                  ? 'bg-amber-100/80 text-amber-800 shadow-sm dark:bg-amber-900/25 dark:text-amber-300'
                  : 'text-muted-foreground/50 hover:bg-amber-50/50 hover:text-amber-700 dark:hover:bg-amber-900/15 dark:hover:text-amber-400'
              }`}
            >
              All
            </button>
            <div className="h-4 w-px bg-border/40 mx-0.5" />
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
              const hasWords = availableLetters.has(letter)
              return (
                <button
                  key={letter}
                  disabled={!hasWords}
                  onClick={() => hasWords && (setLetterFilter(letter), setPage(1))}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold transition-all ${
                    letterFilter === letter
                      ? 'bg-amber-100/80 text-amber-800 shadow-sm dark:bg-amber-900/25 dark:text-amber-300'
                      : hasWords
                        ? 'text-muted-foreground/60 hover:bg-amber-50/50 hover:text-amber-700 dark:hover:bg-amber-900/15 dark:hover:text-amber-400'
                        : 'text-muted-foreground/15 cursor-default'
                  }`}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        )}

        {/* ── WORD LIST ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              <span className="text-xs text-muted-foreground/50">Loading your lexicon...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/50 dark:bg-amber-900/15">
              <BookText className="h-6 w-6 text-amber-500/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {activeFilters ? 'No words match your filters' : 'Your lexicon is empty'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/50">
                {activeFilters
                  ? 'Try adjusting your search or filters above'
                  : 'Bookmark words while reading or import a list to get started'}
              </p>
            </div>
            {!activeFilters && (
              <Link href="/dashboard" className="mt-1 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 transition-colors">
                Start Reading
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.letter}>
                <div className="sticky top-14 z-40 -mx-4 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm shadow-amber-500/15">
                      <span className="text-xs font-bold text-white">{g.letter}</span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-amber-200/40 to-transparent dark:from-amber-800/15" />
                    <span className="text-[10px] font-medium text-muted-foreground/40 tabular-nums">{g.words.length} word{g.words.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  {g.words.map((w) => {
                    const isExpanded = expanded === w.word
                    return (
                      <div
                        key={w.word}
                        className={`rounded-xl border bg-background/50 shadow-sm transition-all ${
                          isExpanded
                            ? 'border-amber-400/30 shadow-amber-500/5'
                            : 'border-border/40 hover:border-border/70 hover:shadow-md'
                        }`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpanded(isExpanded ? null : w.word)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setExpanded(isExpanded ? null : w.word)
                            }
                          }}
                          className="flex w-full items-center gap-3 px-3.5 py-3 text-left cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2.5">
                              <span className="text-base font-bold tracking-tight text-foreground">{w.word}</span>
                              {w.pronunciation && (
                                <span className="hidden items-center gap-1 sm:inline-flex">
                                  <span className="text-[11px] font-medium text-muted-foreground/40">{w.pronunciation}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); speak(w.word) }}
                                    className="rounded p-0.5 text-muted-foreground/20 transition-colors hover:text-amber-500 hover:bg-amber-500/10"
                                    title="Listen to pronunciation"
                                    aria-label={`Pronounce ${w.word}`}
                                  >
                                    <Volume2 className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground/50">
                              <span className="flex items-center gap-0.5 tabular-nums">
                                <Hash className="h-2.5 w-2.5" />
                                {w.frequency}x
                              </span>
                              <span className="hidden items-center gap-0.5 sm:flex">
                                <BookOpen className="h-2.5 w-2.5" />
                                {w.pdfs.length} book{w.pdfs.length !== 1 ? 's' : ''}
                              </span>
                              {w.translation && (
                                <span className="hidden items-center gap-0.5 font-medium text-amber-600/70 dark:text-amber-400/70 sm:flex">
                                  <Languages className="h-2.5 w-2.5" />
                                  {w.translation}
                                </span>
                              )}
                            </div>
                          </div>
                          {w.meaning && !isExpanded && (
                            <span className="hidden max-w-[240px] truncate text-xs text-muted-foreground/60 lg:block">
                              {w.meaning}
                            </span>
                          )}
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/25 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(w.word) }}
                            className="shrink-0 rounded p-0.5 text-muted-foreground/15 transition-colors hover:text-red-500 hover:bg-red-500/5"
                            title="Delete this word"
                            aria-label={`Delete ${w.word}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-amber-400/15 px-3.5 py-3 space-y-3">
                            {w.meaning && (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-600/60 dark:text-amber-400/60">Meaning</p>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); speak(w.word) }}
                                    className="rounded p-0.5 text-muted-foreground/20 transition-colors hover:text-amber-500 hover:bg-amber-500/10"
                                    title="Listen to pronunciation"
                                    aria-label={`Pronounce ${w.word}`}
                                  >
                                    <Volume2 className="h-3 w-3" />
                                  </button>
                                </div>
                                <p className="mt-0.5 text-sm leading-relaxed text-foreground">{w.meaning}</p>
                              </div>
                            )}
                            {w.translation && (
                              <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50/50 px-2.5 py-1.5 dark:bg-amber-900/10">
                                <Languages className="h-3 w-3 text-amber-500/60" />
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{w.translation}</span>
                              </div>
                            )}
                            {w.sentence && (
                              <div className="relative border-l-2 border-amber-300/40 pl-3 dark:border-amber-600/30">
                                <Quote className="absolute -left-[7px] -top-1 h-3 w-3 text-amber-400/50 dark:text-amber-500/40" />
                                <p className="text-xs italic leading-relaxed text-muted-foreground/70">{w.sentence}</p>
                              </div>
                            )}
                            {w.pdfs.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <BookOpen className="h-2.5 w-2.5 text-muted-foreground/40" />
                                {w.pdfs.map((p) => (
                                  <span key={p} className="inline-flex items-center rounded-md bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60">
                                    {p.split('/').pop() || p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PAGINATION ── */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-border/30 pt-4">
            <p className="text-[11px] text-muted-foreground/50 tabular-nums">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-amber-50/50 hover:text-amber-700 dark:hover:bg-amber-900/15 dark:hover:text-amber-400 disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {(() => {
                const pages: (number | string)[] = []
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i)
                } else {
                  pages.push(1)
                  if (page > 3) pages.push('...')
                  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
                  if (page < totalPages - 2) pages.push('...')
                  pages.push(totalPages)
                }
                return pages.map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="flex h-7 w-5 items-center justify-center text-[10px] text-muted-foreground/25">···</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition-all ${
                        p === page
                          ? 'bg-amber-100/80 text-amber-800 shadow-sm dark:bg-amber-900/25 dark:text-amber-300'
                          : 'text-muted-foreground/60 hover:bg-amber-50/50 hover:text-amber-700 dark:hover:bg-amber-900/15 dark:hover:text-amber-400'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )
              })()}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-amber-50/50 hover:text-amber-700 dark:hover:bg-amber-900/15 dark:hover:text-amber-400 disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── DELETE CONFIRMATION ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border/60 bg-background p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <Trash2 className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Remove &ldquo;{deleteConfirm}&rdquo;?</h3>
                <p className="text-xs text-muted-foreground/60">This removes all bookmarks and history for this word.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-border/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWord(deleteConfirm)}
                className="rounded-lg bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-red-500/20 hover:bg-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
