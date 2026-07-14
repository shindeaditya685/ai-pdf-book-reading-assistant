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
      <div className="flex h-screen items-center justify-center bg-[#1C1917]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1C1917]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#3F3A35] bg-[#1C1917]/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          {selectedId ? (
            <button
              onClick={goToList}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#3F3A35] bg-[#26221E] text-[#A09890] transition-colors hover:border-[#5A5245] hover:text-[#FBF9F6]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/dashboard" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#3F3A35] bg-[#26221E] text-[#A09890] transition-colors hover:border-[#5A5245] hover:text-[#FBF9F6]">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/20 ring-1 ring-[#10B981]/30">
              <BookMarked className="h-3.5 w-3.5 text-[#10B981]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-sm font-bold text-[#FBF9F6]">
                {selected ? selected.name : 'Collections'}
              </h1>
              {selected ? (
                <p className="text-[11px] text-[#7C6F5E]">{selected.wordCount} words</p>
              ) : (
                <p className="text-[11px] text-[#7C6F5E]">{collections.length} collections</p>
              )}
            </div>
          </div>
        </div>

        {!selectedId && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex h-7 items-center gap-1.5 rounded-lg bg-[#10B981] px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#059669]"
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
                <Loader2 className="h-6 w-6 animate-spin text-[#10B981]" />
              </div>
            ) : selected ? (
              <div>
                {/* Study desk toolbar */}
                {selected.words.length > 0 && (
                  <div className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-5 bg-[#1C1917]/90 backdrop-blur-md border-b border-[#3F3A35]/30">
                    <div className="flex items-center gap-3">
                      {/* Review tool card */}
                      <button
                        onClick={() => setStudyMode('flashcard')}
                        className="group flex flex-1 items-center gap-3 rounded-xl border border-[#10B981]/20 bg-gradient-to-br from-[#10B981]/8 to-transparent p-3 transition-all hover:border-[#10B981]/35 hover:from-[#10B981]/15 active:scale-[0.98]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/15 ring-1 ring-[#10B981]/25">
                          <Brain className="h-4 w-4 text-[#10B981]" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-semibold text-[#FBF9F6]">Review</p>
                          <p className="text-[10px] text-[#7C6F5E]">Flashcards</p>
                        </div>
                      </button>

                      {/* Quiz tool card */}
                      <button
                        onClick={() => setStudyMode('test')}
                        className="group flex flex-1 items-center gap-3 rounded-xl border border-[#D4A373]/20 bg-gradient-to-br from-[#D4A373]/8 to-transparent p-3 transition-all hover:border-[#D4A373]/35 hover:from-[#D4A373]/15 active:scale-[0.98]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D4A373]/15 ring-1 ring-[#D4A373]/25">
                          <Sparkles className="h-4 w-4 text-[#D4A373]" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-semibold text-[#FBF9F6]">Quiz</p>
                          <p className="text-[10px] text-[#7C6F5E]">AI-generated</p>
                        </div>
                      </button>

                      {/* Word count + delete */}
                      <div className="flex items-center gap-2 pl-2 border-l border-[#3F3A35]/50">
                        <span className="font-mono text-[10px] text-[#7C6F5E]/50 whitespace-nowrap">
                          {selected.words.length}
                        </span>
                        <button
                          onClick={() => { if (confirm('Delete this collection?')) handleDelete(selected._id) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7C6F5E]/20 transition-colors hover:bg-[#B33A3A]/10 hover:text-[#B33A3A]"
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
                    <BookText className="h-10 w-10 text-[#7C6F5E]/30" />
                    <div>
                      <p className="font-serif text-base font-semibold text-[#7C6F5E]">No words yet</p>
                      <p className="mt-1 text-xs text-[#7C6F5E]/50">Import words from the vocabulary page</p>
                    </div>
                    <Link
                      href="/vocabulary"
                      className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#059669]"
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
                      <div className="border-l border-[#3F3A35] pl-4 sm:pl-6">
                        {pageWords.map((w, i) => {
                          const isExpanded = expanded === `${w.word}-${w.order}`
                          return (
                            <div
                              key={w.word + w.order}
                              className="border-b border-[#3F3A35]/40 last:border-0"
                            >
                              {/* Ruler dot */}
                              <div className={`absolute -left-[19px] h-1.5 w-1.5 rounded-full transition-colors sm:-left-[25px] ${isExpanded ? 'bg-[#D4A373]' : 'bg-[#10B981]/40'}`}
                                style={{ marginTop: '18px' }}
                              />

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
                                className={`group flex w-full cursor-pointer items-center gap-3 py-3 text-left transition-colors hover:bg-[#26221E]/30 ${isExpanded ? 'bg-[#26221E]/20' : ''}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="font-serif text-base font-bold tracking-tight text-[#FBF9F6]">
                                      {w.word}
                                    </span>
                                    {w.partOfSpeech && (
                                      <span className="rounded-full border border-[#D4A373]/20 bg-[#D4A373]/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#D4A373]">
                                        {w.partOfSpeech}
                                      </span>
                                    )}
                                  </div>
                                  {w.meaning && (
                                    <p className="mt-0.5 truncate text-sm text-[#A09890]/70">{w.meaning}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {w.translation && !isExpanded && (
                                    <span className="hidden text-[11px] font-medium text-[#10B981]/60 sm:block">{w.translation}</span>
                                  )}
                                  <ChevronDown className={`h-3.5 w-3.5 text-[#7C6F5E]/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteWord(w.word) }}
                                    className="rounded p-0.5 text-[#7C6F5E]/10 opacity-0 transition-all hover:text-[#B33A3A] group-hover:opacity-100"
                                    title="Remove word"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Expanded details */}
                              {isExpanded && (
                                <div className="border-l-2 border-[#D4A373]/30 pb-4 pl-3 ml-0.5">
                                  <div className="mb-3 flex items-center gap-2.5 flex-wrap">
                                    {w.partOfSpeech && (
                                      <span className="rounded-full border border-[#D4A373]/25 bg-[#D4A373]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4A373]">
                                        {w.partOfSpeech}
                                      </span>
                                    )}
                                    {w.pronunciation && (
                                      <span className="font-mono text-[11px] tracking-wide text-[#7C6F5E]/60">
                                        {w.pronunciation}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-sm leading-relaxed text-[#FBF9F6]">
                                    {w.meaning || <span className="italic text-[#7C6F5E]/40">No meaning</span>}
                                  </p>

                                  {w.translation && (
                                    <p className="mt-2 text-sm font-medium text-[#10B981]/80">
                                      {w.translation}
                                    </p>
                                  )}

                                  {w.example && (
                                    <div className="mt-2.5">
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#7C6F5E]/60">Example</p>
                                      <p className="mt-0.5 border-l-2 border-[#3F3A35] pl-3 text-sm italic leading-relaxed text-[#A09890]">
                                        &ldquo;{w.example}&rdquo;
                                      </p>
                                    </div>
                                  )}

                                  <p className="mt-2 text-[10px] text-[#7C6F5E]/30">
                                    Added {new Date(w.createdAt).toLocaleDateString()}
                                  </p>

                                  <div className="mt-2.5 pt-2 border-t border-[#3F3A35]/30">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setStudyWord(w) }}
                                      className="flex items-center gap-1.5 text-[11px] font-semibold text-[#10B981]/50 transition-colors hover:text-[#10B981]"
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
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#3F3A35] text-[#7C6F5E] transition-colors hover:border-[#5A5245] hover:text-[#FBF9F6] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <span className="font-mono text-[11px] text-[#7C6F5E]/50">
                            {start + 1}&ndash;{end} of {total}
                          </span>
                          <button
                            onClick={() => setWordPage((p) => Math.min(totalPages, p + 1))}
                            disabled={wordPage === totalPages}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#3F3A35] text-[#7C6F5E] transition-colors hover:border-[#5A5245] hover:text-[#FBF9F6] disabled:cursor-not-allowed disabled:opacity-30"
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
                <Loader2 className="h-6 w-6 animate-spin text-[#10B981]" />
              </div>
            )}
          </div>
        ) : (
          /* ── COLLECTIONS LIST ── */
          <div>
            {/* Create form */}
            {showCreate && (
              <div className="mb-6 rounded-xl border border-[#10B981]/20 bg-[#10B981]/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                    placeholder="Collection name"
                    className="flex-1 h-9 rounded-lg border border-[#3F3A35] bg-[#26221E] px-3 text-sm text-[#FBF9F6] placeholder:text-[#7C6F5E]/40 outline-none transition-all focus:border-[#10B981]/50 focus:ring-2 focus:ring-[#10B981]/15"
                    autoFocus
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!createName.trim() || creating}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[#10B981] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#059669] disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[#7C6F5E] transition-colors hover:bg-[#26221E] hover:text-[#FBF9F6]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-[#10B981]" />
              </div>
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <Library className="h-10 w-10 text-[#7C6F5E]/30" />
                <div>
                  <p className="font-serif text-base font-semibold text-[#7C6F5E]">No collections yet</p>
                  <p className="mt-1 text-xs text-[#7C6F5E]/50">Create one and import words from vocabulary</p>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#059669]"
                >
                  Create Collection
                </button>
              </div>
            ) : (
              /* Ledger-style list */
              <div className="border-l border-[#3F3A35] pl-4 sm:pl-6">
                {collections.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { setSelectedId(c._id); fetchCollection(c._id) }}
                    className="group relative flex w-full items-center gap-4 border-b border-[#3F3A35]/50 py-3.5 text-left transition-all hover:border-[#3F3A35] last:border-0"
                  >
                    {/* Dot on the ruler line */}
                    <div className="absolute -left-[19px] top-[19px] h-1.5 w-1.5 rounded-full bg-[#10B981]/20 transition-colors group-hover:bg-[#10B981]/60 sm:-left-[25px]" />

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#26221E] ring-1 ring-[#3F3A35] transition-all group-hover:ring-[#10B981]/30">
                      <BookMarked className="h-4 w-4 text-[#7C6F5E] transition-colors group-hover:text-[#10B981]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-sm font-bold text-[#FBF9F6] transition-colors group-hover:text-[#10B981]">
                        {c.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#7C6F5E]/60">
                        {c.wordCount} word{c.wordCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 -rotate-180 text-[#7C6F5E]/30 transition-colors group-hover:text-[#7C6F5E]/60" />
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
