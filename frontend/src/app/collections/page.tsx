'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Library,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookText,
  Brain,
  X,
  ListChecks,
  BookMarked,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { CollectionStudy } from '@/components/collection-study'

interface CollectionWord {
  word: string
  meaning: string
  pronunciation: string
  translation: string | null
  partOfSpeech: string
  example: string
  order: number
  createdAt: string
}

interface Collection {
  _id: string
  name: string
  description: string
  wordCount: number
  words: CollectionWord[]
  createdAt: string
  updatedAt: string
}

export default function CollectionsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialId = searchParams.get('id')

  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const [selected, setSelected] = useState<Collection | null>(null)
  const [selectedLoading, setSelectedLoading] = useState(false)

  const [expanded, setExpanded] = useState<string | null>(null)

  const [studyMode, setStudyMode] = useState<'flashcard' | 'test' | null>(null)
  const [studyWord, setStudyWord] = useState<CollectionWord | null>(null)

  const [wordPage, setWordPage] = useState(1)
  const WORDS_PER_PAGE = 50

  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchCollections = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/collections')
      const data = await res.json()
      setCollections(data.collections || [])
    } catch {}
    setLoading(false)
  }, [])

  const fetchCollection = useCallback(async (id: string) => {
    setWordPage(1)
    setSelectedLoading(true)
    try {
      const res = await authFetch(`/api/collections/${id}`)
      const data = await res.json()
      if (data.collection) {
        setSelected(data.collection)
        setSelectedId(id)
      }
    } catch {}
    setSelectedLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    fetchCollections()
  }, [user, authLoading, router, fetchCollections])

  useEffect(() => {
    if (initialId) {
      fetchCollection(initialId)
    }
  }, [initialId, fetchCollection])

  const handleCreate = useCallback(async () => {
    if (!createName.trim() || creating) return
    setCreating(true)
    try {
      const res = await authFetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName }),
      })
      const data = await res.json()
      if (data.success && data.collection) {
        setCollections((prev) => [data.collection, ...prev])
        setCreateName('')
        setShowCreate(false)
      }
    } catch {}
    setCreating(false)
  }, [createName, creating])

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/collections/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCollections((prev) => prev.filter((c) => c._id !== id))
        if (selectedId === id) {
          setSelected(null)
          setSelectedId(null)
        }
      }
    } catch {}
  }, [selectedId])

  const handleDeleteWord = useCallback(async (word: string) => {
    if (!selectedId) return
    try {
      const res = await authFetch(`/api/collections/${selectedId}/words`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      if (res.ok) {
        setSelected((prev) => prev ? {
          ...prev,
          words: prev.words.filter((w) => w.word !== word),
          wordCount: prev.wordCount - 1,
        } : null)
      }
    } catch {}
  }, [selectedId])

  const goToList = useCallback(() => {
    setSelected(null)
    setSelectedId(null)
  }, [])

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-paper-border bg-canvas/85 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          {selectedId ? (
            <button
              onClick={goToList}
              aria-label="Back to collections"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/dashboard" aria-label="Back to dashboard" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-fg shadow-sm">
              <BookMarked className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-base font-bold tracking-tight text-ink">
                {selected ? selected.name : 'Collections'}
              </h1>
              {selected ? (
                <p className="font-mono text-[11px] text-muted-foreground tabular-nums">{selected.wordCount} words</p>
              ) : (
                <p className="font-mono text-[11px] text-muted-foreground tabular-nums">{collections.length} collections</p>
              )}
            </div>
          </div>
        </div>

        {!selectedId && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex h-7 items-center gap-1.5 rounded-lg bg-brand px-2.5 text-[11px] font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">New Collection</span>
          </button>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {selectedId ? (
          /* ── COLLECTION DETAIL ── */
          <div>
            {selectedLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : selected ? (
              <div>
                {/* Study desk toolbar */}
                {selected.words.length > 0 && (
                  <div className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-5 bg-canvas/90 backdrop-blur-md border-b border-paper-border/60">
                    <div className="flex items-center gap-3">
                      {/* Review tool card — primary */}
                      <button
                        onClick={() => setStudyMode('flashcard')}
                        className="group flex flex-1 items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 p-3 transition-all hover:border-brand/45 hover:bg-brand/15 active:scale-[0.98]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg shadow-sm">
                          <Brain className="h-4 w-4" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-semibold text-ink">Review</p>
                          <p className="text-[10px] text-muted-foreground">Flashcards</p>
                        </div>
                      </button>

                      {/* Quiz tool card — secondary */}
                      <button
                        onClick={() => setStudyMode('test')}
                        className="group flex flex-1 items-center gap-3 rounded-xl border border-paper-border bg-card p-3 transition-all hover:border-brand/35 hover:bg-brand/5 active:scale-[0.98]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-semibold text-ink">Quiz</p>
                          <p className="text-[10px] text-muted-foreground">AI-generated</p>
                        </div>
                      </button>

                      {/* Word count + delete */}
                      <div className="flex items-center gap-2 pl-2 border-l border-paper-border/70">
                        <span className="font-mono text-[10px] text-muted-foreground/50 whitespace-nowrap tabular-nums">
                          {selected.words.length}
                        </span>
                        <button
                          onClick={() => { if (confirm('Delete this collection?')) handleDelete(selected._id) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/20 transition-colors hover:bg-red-500/10 hover:text-red-500"
                          title="Delete collection"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {selected.words.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-20 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-paper-border bg-card shadow-sm">
                      <BookText className="h-6 w-6 text-brand/60" />
                    </div>
                    <div>
                      <p className="font-serif text-lg font-bold tracking-tight text-ink">No words yet</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/60">Import words from the vocabulary page</p>
                    </div>
                    <Link
                      href="/vocabulary"
                      className="mt-1 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
                    >
                      Go to Vocabulary
                    </Link>
                  </div>
                ) : (() => {
                  const total = selected.words.length
                  const start = (wordPage - 1) * WORDS_PER_PAGE
                  const end = Math.min(start + WORDS_PER_PAGE, total)
                  const totalPages = Math.ceil(total / WORDS_PER_PAGE)
                  const pageWords = selected.words.slice(start, end)
                  return (
                    <div>
                      {/* Word list — expandable accordion cards */}
                      <div className="relative border-l border-paper-border">
                        {pageWords.map((w, i) => {
                          const isExpanded = expanded === `${w.word}-${w.order}`
                          return (
                            <div
                              key={w.word + w.order}
                              className="relative border-b border-paper-border/50 last:border-0"
                            >
                              {/* Ruler dot */}
                              <span className={`absolute -left-[3px] top-[19px] h-1.5 w-1.5 rounded-full transition-colors ${isExpanded ? 'bg-brand' : 'bg-brand/40'}`} />

                              {/* Collapsed row */}
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setExpanded(isExpanded ? null : `${w.word}-${w.order}`)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setExpanded(isExpanded ? null : `${w.word}-${w.order}`)
                                  }
                                }}
                                className={`group flex w-full cursor-pointer items-center gap-3 py-3 pl-4 text-left transition-colors hover:bg-muted/40 rounded-md sm:pl-6 ${isExpanded ? 'bg-muted/30' : ''}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="font-serif text-lg font-bold tracking-tight text-ink">
                                      {w.word}
                                    </span>
                                    {w.partOfSpeech && (
                                      <span className="rounded-full border border-paper-border bg-muted/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {w.partOfSpeech}
                                      </span>
                                    )}
                                  </div>
                                  {w.meaning && (
                                    <p className="mt-0.5 truncate text-sm text-muted-foreground/70">{w.meaning}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {w.translation && !isExpanded && (
                                    <span className="hidden font-serif text-[11px] font-medium italic text-brand/70 sm:block">{w.translation}</span>
                                  )}
                                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteWord(w.word) }}
                                    className="rounded p-0.5 text-muted-foreground/10 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                                    title="Remove word"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Expanded details */}
                              {isExpanded && (
                                <div className="border-l-2 border-brand/30 pb-4 pl-3 ml-0.5">
                                  <div className="mb-3 flex items-center gap-2.5 flex-wrap">
                                    {w.partOfSpeech && (
                                      <span className="rounded-full border border-paper-border bg-muted/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {w.partOfSpeech}
                                      </span>
                                    )}
                                    {w.pronunciation && (
                                      <span className="font-mono text-[11px] tracking-wide text-muted-foreground/60">
                                        {w.pronunciation}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-sm leading-relaxed text-ink">
                                    {w.meaning || <span className="italic text-muted-foreground/40">No meaning</span>}
                                  </p>

                                  {w.translation && (
                                    <p className="mt-2 font-serif text-sm font-medium italic text-brand">
                                      {w.translation}
                                    </p>
                                  )}

                                  {w.example && (
                                    <div className="mt-2.5">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Example</p>
                                      <p className="mt-0.5 border-l-2 border-brand/30 pl-3 text-sm italic leading-relaxed text-ink/70">
                                        &ldquo;{w.example}&rdquo;
                                      </p>
                                    </div>
                                  )}

                                  <p className="mt-2 font-mono text-[10px] text-muted-foreground/40">
                                    Added {new Date(w.createdAt).toLocaleDateString()}
                                  </p>

                                  <div className="mt-2.5 pt-2 border-t border-paper-border/40">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setStudyWord(w) }}
                                      className="flex items-center gap-1.5 text-[11px] font-semibold text-brand/70 transition-colors hover:text-brand"
                                    >
                                      <Brain className="h-3 w-3" />
                                      Flashcard this word
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* ── Pagination ── */}
                      {totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-center gap-4 text-xs">
                          <button
                            onClick={() => setWordPage((p) => Math.max(1, p - 1))}
                            disabled={wordPage === 1}
                            aria-label="Previous page"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-brand-soft hover:text-brand disabled:pointer-events-none disabled:opacity-25"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <span className="font-mono text-[11px] text-muted-foreground/50 tabular-nums">
                            {start + 1}&ndash;{end} of {total}
                          </span>
                          <button
                            onClick={() => setWordPage((p) => Math.min(totalPages, p + 1))}
                            disabled={wordPage === totalPages}
                            aria-label="Next page"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-brand-soft hover:text-brand disabled:pointer-events-none disabled:opacity-25"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            )}
          </div>
        ) : (
          /* ── COLLECTIONS LIST ── */
          <div>
            {/* Create form */}
            {showCreate && (
              <div className="mb-6 rounded-xl border border-paper-border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                    placeholder="Collection name"
                    className="flex-1 h-9 rounded-lg border border-paper-border bg-muted/40 px-3 text-sm text-ink placeholder:text-muted-foreground/35 outline-none transition-all focus:border-brand/50 focus:ring-2 focus:ring-brand/15"
                    autoFocus
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!createName.trim() || creating}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
                  >
                    {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    aria-label="Cancel"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-paper-border bg-card shadow-sm">
                  <Library className="h-6 w-6 text-brand/60" />
                </div>
                <div>
                  <p className="font-serif text-lg font-bold tracking-tight text-ink">No collections yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">Create one and import words from vocabulary</p>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-1 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
                >
                  Create Collection
                </button>
              </div>
            ) : (
              /* Shelf of bound volumes */
              <div className="relative border-l border-paper-border">
                {collections.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { setSelectedId(c._id); fetchCollection(c._id) }}
                    className="group relative flex w-full items-center gap-4 border-b border-paper-border/50 py-3.5 pl-4 text-left transition-colors last:border-0 hover:bg-muted/30 sm:pl-6"
                  >
                    {/* Dot on the ruler line */}
                    <span className="absolute -left-[3px] top-[19px] h-1.5 w-1.5 rounded-full bg-brand/20 transition-colors group-hover:bg-brand/60" />

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card ring-1 ring-paper-border transition-all group-hover:ring-brand/40">
                      <BookMarked className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-base font-bold tracking-tight text-ink transition-colors group-hover:text-brand">
                        {c.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/60 tabular-nums">
                        {c.wordCount} word{c.wordCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 -rotate-180 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {studyMode && selected && (
        <CollectionStudy
          words={selected.words}
          collectionName={selected.name}
          initialMode={studyMode}
          onClose={() => setStudyMode(null)}
        />
      )}

      {studyWord && selected && (
        <CollectionStudy
          words={[studyWord]}
          collectionName={selected.name}
          initialMode="flashcard"
          onClose={() => setStudyWord(null)}
        />
      )}
    </div>
  )
}
