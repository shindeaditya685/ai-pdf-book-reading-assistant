'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Search, ChevronDown, ChevronUp, Loader2, BookText, Calendar, Hash, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'

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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pdfFilter, setPdfFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadWords()
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
    if (!search) return words
    const q = search.toLowerCase()
    return words.filter((w) => w.word.toLowerCase().includes(q))
  }, [words, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / WORDS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * WORDS_PER_PAGE, page * WORDS_PER_PAGE)
  const groups = useMemo(() => groupByLetter(paginated), [paginated])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1)
      loadWords()
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-emerald-500/10 bg-background/60 px-4 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/20 ring-1 ring-violet-500/20">
            <BookText className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">Vocabulary</span>
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            {filtered.length} words
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── STATS BAR ── */}
        {filtered.length > 0 && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Total Words</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{filtered.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Books Read</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{pdfs.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Top Word</p>
              <p className="mt-1 text-2xl font-bold text-foreground truncate">
                {filtered.reduce((a, b) => (a.frequency > b.frequency ? a : b)).word}
              </p>
            </div>
          </div>
        )}

        {/* ── FILTERS ── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search words..."
              className="h-10 w-full rounded-lg border border-border/60 bg-background/80 pl-9 pr-3 text-base outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 sm:h-9 sm:text-sm"
            />
          </div>
          <select
            value={pdfFilter}
            onChange={(e) => setPdfFilter(e.target.value)}
            className="h-10 w-full rounded-lg border border-border/60 bg-background/80 px-2.5 text-base outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 sm:h-9 sm:w-44 sm:text-sm"
          >
            <option value="">All Books</option>
            {pdfs.map((p) => (
              <option key={p} value={p}>{p.split('/').pop() || p}</option>
            ))}
          </select>
        </div>

        {/* ── ALPHABET NAVIGATION ── */}
        {groups.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-1">
            {groups.map((g) => (
              <a
                key={g.letter}
                href={`#letter-${g.letter}`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold text-muted-foreground/60 transition-colors hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-900/30 dark:hover:text-violet-400"
              >
                {g.letter}
              </a>
            ))}
          </div>
        )}

        {/* ── WORD LIST ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <BookText className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-semibold text-muted-foreground/50">
              {search || pdfFilter ? 'No words match your filters' : 'No vocabulary yet'}
            </p>
            <p className="text-xs text-muted-foreground/40">Words you look up while reading will appear here</p>
            {!search && !pdfFilter && (
              <Link href="/dashboard" className="mt-2 rounded-lg bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-600 transition-colors">
                Start Reading
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.letter} id={`letter-${g.letter}`}>
                <div className="sticky top-16 z-40 -mx-4 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/20">
                      <span className="text-sm font-bold text-white">{g.letter}</span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-violet-200/50 to-transparent dark:from-violet-800/20" />
                    <span className="text-[10px] font-semibold text-muted-foreground/40 tabular-nums">{g.words.length} words</span>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {g.words.map((w) => {
                    const isExpanded = expanded === w.word
                    return (
                      <div
                        key={w.word}
                        className="rounded-lg border border-border/40 bg-background/40 shadow-sm transition-all hover:border-border/70"
                      >
                        <button
                          onClick={() => setExpanded(isExpanded ? null : w.word)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">{w.word}</span>
                              {w.pronunciation && (
                                <span className="hidden text-[11px] italic text-muted-foreground/50 sm:inline">{w.pronunciation}</span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2.5 text-[10px] text-muted-foreground/50">
                              <span className="flex items-center gap-0.5">
                                <Hash className="h-2.5 w-2.5" />
                                {w.frequency}x
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Calendar className="h-2.5 w-2.5" />
                                {new Date(w.lastSeen).toLocaleDateString()}
                              </span>
                              <span className="hidden items-center gap-0.5 sm:flex">
                                <BookOpen className="h-2.5 w-2.5" />
                                {w.pdfs.length} book{w.pdfs.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          {w.translation && (
                            <span className="hidden shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400 sm:block">{w.translation}</span>
                          )}
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          <span
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(w.word) }}
                            className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground/20 transition-colors hover:text-red-500"
                            title="Delete this word"
                          >
                            <Trash2 className="h-3 w-3" />
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border/30 px-3 py-2.5 space-y-2">
                            {w.meaning && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Meaning</p>
                                <p className="mt-0.5 text-sm text-foreground">{w.meaning}</p>
                              </div>
                            )}
                            {w.sentence && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Example Sentence</p>
                                <p className="mt-0.5 text-sm italic text-muted-foreground/80 border-l-2 border-muted-foreground/20 pl-2">"{w.sentence}"</p>
                              </div>
                            )}
                            {w.pdfs.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Found In</p>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {w.pdfs.map((p) => (
                                    <span key={p} className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                      <BookOpen className="h-2.5 w-2.5" />
                                      {p.split('/').pop() || p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
                              <span>First seen: {new Date(w.firstSeen).toLocaleDateString()}</span>
                              <span>Last seen: {new Date(w.lastSeen).toLocaleDateString()}</span>
                            </div>
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
          <div className="mt-8 flex items-center justify-between border-t border-border/40 pt-4">
            <p className="text-[11px] text-muted-foreground/60">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition-colors ${
                    p === page
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
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
          <div className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">Delete &ldquo;{deleteConfirm}&rdquo;?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This will remove all history entries for this word. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWord(deleteConfirm)}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
