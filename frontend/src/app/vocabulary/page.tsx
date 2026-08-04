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
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  const activeFilters = [search, pdfFilter, listFilter, letterFilter].some(Boolean)

  const filterControl =
    'h-9 rounded-lg border border-paper-border bg-card px-2.5 text-sm text-ink outline-none transition-all focus:border-brand/50 focus:ring-2 focus:ring-brand/15'

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-paper-border bg-canvas/85 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard" aria-label="Back to dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-fg shadow-sm">
            <BookText className="h-3.5 w-3.5" />
          </div>
          <span className="font-serif text-base font-bold tracking-tight text-ink">Lexicon</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-brand tabular-nums">
            {filtered.length} word{filtered.length !== 1 ? 's' : ''}
          </span>
          {pdfs.length > 0 && (
            <span className="hidden rounded-md border border-paper-border bg-card px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground/60 sm:inline-block tabular-nums">
              {pdfs.length} book{pdfs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        {/* ── FILTERS ── */}
        <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              role="searchbox"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search your lexicon..."
              className="h-9 w-full rounded-lg border border-paper-border bg-card pl-9 pr-3 text-sm text-ink placeholder:text-muted-foreground/35 outline-none transition-all focus:border-brand/50 focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <select
            value={pdfFilter}
            onChange={(e) => { setPdfFilter(e.target.value); setPage(1) }}
            aria-label="Filter by book"
            className={`${filterControl} sm:w-40`}
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
            aria-label="Filter by list"
            className={`${filterControl} sm:w-36`}
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

        {/* ── A–Z THUMB INDEX ──
            The dictionary device: each letter is a live gauge — letters holding
            words sit in ink, the active letter is brand-filled, empties dim. */}
        {filtered.length > 0 && (
          <nav
            aria-label="Letter index"
            className="panel-scrollbar sticky top-14 z-40 -mx-4 mb-5 flex items-center gap-1 overflow-x-auto border-b border-paper-border/60 bg-canvas/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          >
            <button
              onClick={() => { setLetterFilter(''); setPage(1) }}
              className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-semibold transition-all ${
                !letterFilter
                  ? 'bg-brand text-brand-fg shadow-sm'
                  : 'text-muted-foreground/60 hover:bg-brand-soft hover:text-brand'
              }`}
            >
              All
            </button>
            <div className="mx-0.5 h-4 w-px shrink-0 bg-paper-border" />
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
              const hasWords = availableLetters.has(letter)
              return (
                <button
                  key={letter}
                  disabled={!hasWords}
                  aria-pressed={letterFilter === letter}
                  aria-label={`Words starting with ${letter}`}
                  onClick={() => hasWords && (setLetterFilter(letter), setPage(1))}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold transition-all ${
                    letterFilter === letter
                      ? 'bg-brand text-brand-fg shadow-sm'
                      : hasWords
                        ? 'text-ink hover:bg-brand-soft hover:text-brand'
                        : 'text-ink/15 cursor-default'
                  }`}
                >
                  {letter}
                </button>
              )
            })}
          </nav>
        )}

        {/* ── WORD LIST ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <span className="font-mono text-xs text-muted-foreground/50">Loading your lexicon...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-paper-border bg-card shadow-sm">
              <BookText className="h-6 w-6 text-brand/60" />
            </div>
            <div>
              <p className="font-serif text-lg font-bold tracking-tight text-ink">
                {activeFilters ? 'Nothing on this shelf' : 'Your lexicon is empty'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">
                {activeFilters
                  ? 'Try a different search or clear a filter above'
                  : 'Bookmark words while reading, or import a list to get started'}
              </p>
            </div>
            {!activeFilters && (
              <Link href="/dashboard" className="mt-1 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]">
                Start Reading
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.letter}>
                <div className="flex items-center gap-2.5 py-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md border border-paper-border bg-card">
                    <span className="font-mono text-xs font-bold text-brand">{g.letter}</span>
                  </div>
                  <div className="h-px flex-1 bg-paper-border/70" />
                  <span className="font-mono text-[10px] text-muted-foreground/50 tabular-nums">{g.words.length} word{g.words.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {g.words.map((w) => {
                    const isExpanded = expanded === w.word
                    return (
                      <div
                        key={w.word}
                        className={`rounded-xl border bg-card shadow-sm transition-all ${
                          isExpanded
                            ? 'border-brand/30 shadow-brand/5'
                            : 'border-paper-border hover:border-ink/20 hover:shadow-md'
                        }`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
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
                              <span className="font-serif text-lg font-bold tracking-tight text-ink">{w.word}</span>
                              {w.pronunciation && (
                                <span className="hidden items-center gap-1 sm:inline-flex">
                                  <span className="font-mono text-[11px] text-muted-foreground/45">/{w.pronunciation}/</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); speak(w.word) }}
                                    className="rounded p-0.5 text-muted-foreground/20 transition-colors hover:bg-brand-soft hover:text-brand"
                                    title="Listen to pronunciation"
                                    aria-label={`Pronounce ${w.word}`}
                                  >
                                    <Volume2 className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted-foreground/50">
                              <span className="flex items-center gap-0.5 tabular-nums">
                                <Hash className="h-2.5 w-2.5" />
                                {w.frequency}x
                              </span>
                              <span className="hidden items-center gap-0.5 tabular-nums sm:flex">
                                <BookOpen className="h-2.5 w-2.5" />
                                {w.pdfs.length} book{w.pdfs.length !== 1 ? 's' : ''}
                              </span>
                              {w.translation && (
                                <span className="hidden items-center gap-0.5 font-serif italic text-brand/80 sm:flex">
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
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
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
                          <div className="space-y-3 border-t border-brand/15 px-3.5 py-3">
                            {w.meaning && (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Meaning</p>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); speak(w.word) }}
                                    className="rounded p-0.5 text-muted-foreground/20 transition-colors hover:bg-brand-soft hover:text-brand"
                                    title="Listen to pronunciation"
                                    aria-label={`Pronounce ${w.word}`}
                                  >
                                    <Volume2 className="h-3 w-3" />
                                  </button>
                                </div>
                                <p className="mt-0.5 text-sm leading-relaxed text-ink/85">{w.meaning}</p>
                              </div>
                            )}
                            {w.translation && (
                              <div className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5">
                                <Languages className="h-3 w-3 text-brand" />
                                <span className="font-serif text-xs font-medium italic text-brand">{w.translation}</span>
                              </div>
                            )}
                            {w.sentence && (
                              <div className="relative border-l-2 border-brand/30 pl-3">
                                <Quote className="absolute -left-[7px] -top-1 h-3 w-3 text-brand/50" />
                                <p className="font-serif text-xs italic leading-relaxed text-ink/70">&ldquo;{w.sentence}&rdquo;</p>
                              </div>
                            )}
                            {w.pdfs.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <BookOpen className="h-2.5 w-2.5 text-muted-foreground/40" />
                                {w.pdfs.map((p) => (
                                  <span key={p} className="inline-flex items-center rounded-md border border-paper-border bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground/60">
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
          <div className="mt-8 flex items-center justify-between border-t border-paper-border/60 pt-4">
            <p className="font-mono text-[11px] text-muted-foreground/50 tabular-nums">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-brand-soft hover:text-brand disabled:pointer-events-none disabled:opacity-25"
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
                    <span key={`ellipsis-${i}`} className="flex h-7 w-5 items-center justify-center font-mono text-[10px] text-muted-foreground/25">···</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      aria-current={p === page ? 'page' : undefined}
                      className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-semibold transition-all ${
                        p === page
                          ? 'bg-brand text-brand-fg shadow-sm'
                          : 'text-muted-foreground/60 hover:bg-brand-soft hover:text-brand'
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
                aria-label="Next page"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-brand-soft hover:text-brand disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── DELETE CONFIRMATION ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-paper-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/25 dark:text-red-400">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-serif text-sm font-bold tracking-tight text-ink">Remove &ldquo;{deleteConfirm}&rdquo;?</h3>
                <p className="mt-0.5 text-xs text-muted-foreground/60">This removes all bookmarks and history for this word.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-paper-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWord(deleteConfirm)}
                className="rounded-lg bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-red-600 active:scale-[0.97]"
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
