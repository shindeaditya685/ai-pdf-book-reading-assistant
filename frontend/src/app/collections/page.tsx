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
  BookOpen,
  ChevronLeft,
  BookText,
  Layers,
  Clock,
  Brain,
  ExternalLink,
  X,
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

  const [studyMode, setStudyMode] = useState<'flashcard' | 'test' | null>(null)

  // Create state
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
          router.replace('/collections')
        }
      }
    } catch {}
  }, [selectedId, router])

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

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-emerald-500/10 bg-background/60 px-4 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {selectedId ? (
            <button
              onClick={() => { setSelected(null); setSelectedId(null); router.replace('/collections') }}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-500/20">
            <Library className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">
            {selected ? selected.name : 'Collections'}
          </span>
          {!selected && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {collections.length}
            </span>
          )}
        </div>
        {!selectedId && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Collection</span>
          </button>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {selectedId ? (
          /* ── COLLECTION DETAIL ── */
          <div>
            {selectedLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : selected ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {selected.wordCount} word{selected.wordCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(selected.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.words.length > 0 && (
                      <>
                        <button
                          onClick={() => setStudyMode('flashcard')}
                          className="flex h-7 items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-600 transition-colors"
                        >
                          <Brain className="h-3 w-3" />
                          Review
                        </button>
                        <button
                          onClick={() => setStudyMode('test')}
                          className="flex h-7 items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 text-[11px] font-semibold text-white hover:bg-amber-600 transition-colors"
                        >
                          <BookText className="h-3 w-3" />
                          Quiz
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { if (confirm('Delete this collection?')) handleDelete(selected._id) }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Delete collection"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {selected.words.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-20 text-center">
                    <BookText className="h-10 w-10 text-muted-foreground/20" />
                    <p className="text-sm font-semibold text-muted-foreground/50">No words yet</p>
                    <p className="text-xs text-muted-foreground/40">Import words into this collection from the vocabulary page</p>
                    <Link href="/vocabulary" className="mt-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors">
                      Go to Vocabulary
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {selected.words.map((w) => (
                      <div key={w.word + w.order} className="group rounded-lg border border-border/40 bg-background/40 p-3 shadow-sm transition-all hover:border-border/70">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">{w.word}</span>
                              {w.pronunciation && (
                                <span className="text-[11px] italic text-muted-foreground/50">{w.pronunciation}</span>
                              )}
                              {w.partOfSpeech && (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                                  {w.partOfSpeech}
                                </span>
                              )}
                            </div>
                            {w.meaning && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{w.meaning}</p>
                            )}
                            {w.example && (
                              <p className="mt-1 text-[11px] italic text-muted-foreground/60 border-l-2 border-muted-foreground/15 pl-2">
                                {w.example}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {w.translation && (
                              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{w.translation}</span>
                            )}
                            <button
                              onClick={() => handleDeleteWord(w.word)}
                              className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground/20 transition-all hover:text-red-500"
                              title="Remove word"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground/40 pt-2">
                  <BookOpen className="h-3 w-3" />
                  <span>Words in this collection are also saved to your vocabulary</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <p className="text-sm text-muted-foreground">Loading collection...</p>
              </div>
            )}
          </div>
        ) : (
          /* ── COLLECTIONS LIST ── */
          <div className="space-y-6">
            {/* Create form */}
            {showCreate && (
              <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/10">
                <div className="flex items-center gap-3">
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                    placeholder="Collection name (e.g. The Great Gatsby)"
                    className="flex-1 h-9 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
                    autoFocus
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!createName.trim() || creating}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <Library className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm font-semibold text-muted-foreground/50">No collections yet</p>
                <p className="text-xs text-muted-foreground/40">
                  Create a collection and import words from the vocabulary page
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
                >
                  Create Collection
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {collections.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { setSelectedId(c._id); fetchCollection(c._id); router.push(`/collections?id=${c._id}`, { scroll: false }) }}
                    className="group rounded-xl border border-border/40 bg-background/60 p-4 text-left shadow-sm transition-all hover:border-emerald-200/50 hover:shadow-md hover:shadow-emerald-500/5 dark:hover:border-emerald-800/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Library className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {c.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                            {c.wordCount} word{c.wordCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground/40 pt-2">
              <BookOpen className="h-3 w-3" />
              <span>Import words into collections from the vocabulary page</span>
            </div>
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
    </div>
  )
}
