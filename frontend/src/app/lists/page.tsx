'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  List,
  Plus,
  Trash2,
  UserMinus,
  Globe,
  Lock,
  Loader2,
  BookOpen,
  Star,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Brain,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { usePDFStore, type WordList, type WordListWord } from '@/store/use-pdf-store'
import { CollectionStudy } from '@/components/collection-study'

export default function ListsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const defaultListId = usePDFStore((s) => s.defaultListId)
  const setDefaultListId = usePDFStore((s) => s.setDefaultListId)
  const setWordLists = usePDFStore((s) => s.setWordLists)
  const setSubscribedLists = usePDFStore((s) => s.setSubscribedLists)
  const setDiscoverLists = usePDFStore((s) => s.setDiscoverLists)
  const addFlashcard = usePDFStore((s) => s.addFlashcard)
  const setFlashcards = usePDFStore((s) => s.setFlashcards)
  const flashcards = usePDFStore((s) => s.flashcards)

  const [ownLists, setOwn] = useState<WordList[]>([])
  const [subscribed, setSubscribed] = useState<WordList[]>([])
  const [discover, setDiscover] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedList, setSelectedList] = useState<WordList | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [importing, setImporting] = useState<Set<string>>(new Set())
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createPublic, setCreatePublic] = useState(false)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'lists' | 'discover'>('lists')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [studyMode, setStudyMode] = useState<'flashcard' | 'test' | null>(null)
  const [studyWord, setStudyWord] = useState<WordListWord | null>(null)
  const [wordPage, setWordPage] = useState(1)
  const WORDS_PER_PAGE = 50

  const toCollectionWords = useCallback((words: WordListWord[]) =>
    words.map((w, i) => ({
      word: w.word,
      meaning: w.meaning || '',
      pronunciation: w.pronunciation || '',
      translation: w.translation || null,
      partOfSpeech: w.partOfSpeech || '',
      example: w.example || '',
      order: i,
      createdAt: w.addedAt,
    })), [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    fetchLists()
  }, [user, authLoading, router])

  useEffect(() => {
    setWordPage(1)
    setExpanded(null)
  }, [selectedList?._id])

  const fetchLists = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/word-lists')
      const data = await res.json()
      if (data.lists) { setOwn(data.lists); setWordLists(data.lists) }
      if (data.subscribed) { setSubscribed(data.subscribed); setSubscribedLists(data.subscribed) }
      if (data.discover) { setDiscover(data.discover); setDiscoverLists(data.discover) }
    } catch {}
    setLoading(false)
  }, [setWordLists, setSubscribedLists, setDiscoverLists])

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return
    setCreating(true)
    try {
      const res = await authFetch('/api/word-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName, description: createDesc, isPublic: createPublic }),
      })
      const data = await res.json()
      if (data.success && data.list) {
        setOwn([data.list, ...ownLists])
        setShowCreate(false)
        setCreateName('')
        setCreateDesc('')
        setCreatePublic(false)
      }
    } catch {}
    setCreating(false)
  }, [createName, createDesc, createPublic, ownLists])

  const handleDeleteList = useCallback(async (listId: string) => {
    await authFetch(`/api/word-lists/${listId}`, { method: 'DELETE' })
    setOwn(ownLists.filter((l) => l._id !== listId))
    setSelectedList(null)
  }, [ownLists])

  const handleRemoveWord = useCallback(async (word: string) => {
    if (!selectedList) return
    await authFetch(`/api/word-lists/${selectedList._id}/words?word=${encodeURIComponent(word)}`, { method: 'DELETE' })
    const updated = { ...selectedList, words: selectedList.words.filter((w) => w.word !== word) }
    setSelectedList(updated)
    setOwn(ownLists.map((l) => (l._id === updated._id ? updated : l)))
  }, [selectedList, ownLists])

  const handleSubscribe = useCallback(async (listId: string) => {
    try {
      await authFetch(`/api/word-lists/${listId}/subscribe`, { method: 'POST' })
      fetchLists()
    } catch {}
  }, [fetchLists])

  const handleImport = useCallback(async (listId: string, words: WordListWord[]) => {
    setImporting((prev) => new Set(prev).add(listId))
    let count = 0
    await Promise.all(words.map(async (w) => {
      const cardRes = await authFetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', word: w.word, meaning: w.meaning || '',
          pronunciation: w.pronunciation || '', translation: w.translation || '',
          sentence: w.example || '', pageNumber: 0,
          pdfFileName: `subscribed:${listId}`, partOfSpeech: w.partOfSpeech || '',
          example: w.example || '', subscribedFrom: listId,
        }),
      })
      if (cardRes.ok) {
        const data = await cardRes.json()
        if (data.success) {
          addFlashcard({
            id: data.id, _id: data.id, bookmarkId: '',
            word: w.word, meaning: w.meaning || '',
            pronunciation: w.pronunciation || '', translation: w.translation || '',
            sentence: w.example || '', pageNumber: 0,
            pdfFileName: `subscribed:${listId}`,
            partOfSpeech: w.partOfSpeech || '', example: w.example || '',
            ef: 2.5, interval: 0, repetitions: 0,
            stability: 0, difficulty: 0,
            nextReview: new Date().toISOString(), lastReview: null,
            totalReviews: 0, createdAt: new Date().toISOString(),
            subscribedFrom: listId,
          })
          count++
        }
      }
    }))
    setImporting((prev) => { const next = new Set(prev); next.delete(listId); return next })
    return count
  }, [addFlashcard])

  const handleUnsubscribe = useCallback(async (listId: string) => {
    await authFetch(`/api/flashcards?pdfFileName=${encodeURIComponent('subscribed:' + listId)}`, { method: 'DELETE' }).catch(() => {})
    setFlashcards(flashcards.filter((f) => f.pdfFileName !== `subscribed:${listId}`))
    await authFetch(`/api/word-lists/${listId}/subscribe`, { method: 'DELETE' })
    setSubscribed(subscribed.filter((l) => l._id !== listId))
  }, [subscribed, flashcards, setFlashcards])

  const renderWords = (words: WordListWord[], isOwn: boolean) => {
    if (words.length === 0) return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-paper-border bg-card shadow-sm">
          <BookOpen className="h-5 w-5 text-brand/60" />
        </div>
        <div>
          <p className="font-serif text-base font-bold tracking-tight text-ink">No words yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground/60">Select a word in the reader to add it here</p>
        </div>
      </div>
    )
    return (
      <div className="relative border-l border-paper-border">
        {words.map((w) => {
          const key = `${w.word}-${w.addedAt}`
          const isExpanded = expanded === key
          return (
            <div key={key} className="relative border-b border-paper-border/50 last:border-0">
              <span className={`absolute -left-[3px] top-[19px] h-1.5 w-1.5 rounded-full transition-colors ${isExpanded ? 'bg-brand' : 'bg-brand/40'}`} />
              {/* Collapsed row */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(isExpanded ? null : key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setExpanded(isExpanded ? null : key)
                  }
                }}
                className={`group flex w-full cursor-pointer items-center gap-3 py-3 pl-4 text-left transition-colors hover:bg-muted/40 sm:pl-6 ${isExpanded ? 'bg-muted/30' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-lg font-bold tracking-tight text-ink">{w.word}</span>
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
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  {isOwn && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveWord(w.word) }}
                      className="rounded p-0.5 text-muted-foreground/10 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                      title="Remove word"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="ml-0.5 space-y-2.5 border-l-2 border-brand/30 pb-4 pl-3">
                  {w.partOfSpeech && (
                    <span className="inline-flex rounded-full border border-paper-border bg-muted/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {w.partOfSpeech}
                    </span>
                  )}

                  <p className="text-sm leading-relaxed text-ink">
                    {w.meaning || <span className="italic text-muted-foreground/40">No meaning</span>}
                  </p>

                  {w.translation && (
                    <p className="font-serif text-sm font-medium italic text-brand">
                      {w.translation}
                    </p>
                  )}

                  {w.pronunciation && (
                    <p className="font-mono text-[11px] tracking-wide text-muted-foreground/50">
                      {w.pronunciation}
                    </p>
                  )}

                  {w.example && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Example</p>
                      <p className="mt-0.5 border-l-2 border-brand/30 pl-3 text-sm italic leading-relaxed text-ink/70">
                        &ldquo;{w.example}&rdquo;
                      </p>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground/30">
                    Added {new Date(w.addedAt).toLocaleDateString()}
                  </p>

                  <div className="border-t border-paper-border/40 pt-2">
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
    )
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    )
  }

  if (selectedList) {
    const isOwn = selectedList.username === user?.username
    const isDefault = defaultListId === selectedList._id
    const total = selectedList.words.length
    const start = (wordPage - 1) * WORDS_PER_PAGE
    const end = Math.min(start + WORDS_PER_PAGE, total)
    const totalPages = Math.ceil(total / WORDS_PER_PAGE)
    const pageWords = selectedList.words.slice(start, end)
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-paper-border bg-canvas/85 px-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2.5">
            <button onClick={() => setSelectedList(null)} aria-label="Back to word lists" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-fg shadow-sm">
              <List className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-base font-bold tracking-tight text-ink">{selectedList.name}</h1>
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{selectedList.words.length} words</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isOwn ? (
              <>
                <button
                  onClick={() => setDefaultListId(isDefault ? null : selectedList._id)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${isDefault ? 'text-brand' : 'text-muted-foreground hover:text-brand'}`}
                >
                  <Star className={`h-3 w-3 ${isDefault ? 'fill-brand' : ''}`} />
                  {isDefault ? 'Default' : 'Set default'}
                </button>
                <button
                  onClick={() => { if (confirm('Delete this list?')) handleDeleteList(selectedList._id) }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleImport(selectedList._id, selectedList.words)}
                  disabled={importing.has(selectedList._id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-brand disabled:opacity-50"
                >
                  {importing.has(selectedList._id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                  {importing.has(selectedList._id) ? 'Importing...' : 'Import'}
                </button>
                <button
                  onClick={() => handleUnsubscribe(selectedList._id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-red-500"
                >
                  <UserMinus className="h-3 w-3" />
                  Unsubscribe
                </button>
              </>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          {selectedList.description && (
            <p className="mb-4 font-serif text-sm italic leading-relaxed text-ink/70">{selectedList.description}</p>
          )}
          <div className="mb-4 flex items-center gap-3 font-mono text-[11px] tabular-nums text-muted-foreground/70">
            <span>{selectedList.words.length} word{selectedList.words.length !== 1 ? 's' : ''}</span>
            {selectedList.isPublic && <span className="flex items-center gap-1"><Globe className="h-3 w-3 text-brand" /> Public</span>}
            {isOwn && <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Private</span>}
            {!isOwn && <span>by {selectedList.username}</span>}
          </div>

          {/* Study desk toolbar */}
          {selectedList.words.length > 0 && (
            <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-paper-border/60 bg-canvas/85 px-4 py-3 backdrop-blur-xl sm:-mx-0 sm:px-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStudyMode('flashcard')}
                  className="group flex flex-1 items-center gap-3 rounded-xl border border-brand/25 bg-brand/5 p-3 transition-all hover:border-brand/40 hover:bg-brand/10 active:scale-[0.98]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 ring-1 ring-brand/30">
                    <Brain className="h-4 w-4 text-brand" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-semibold text-ink">Review</p>
                    <p className="text-[10px] text-muted-foreground">Flashcards</p>
                  </div>
                </button>

                <button
                  onClick={() => setStudyMode('test')}
                  className="group flex flex-1 items-center gap-3 rounded-xl border border-paper-border bg-card p-3 transition-all hover:border-ink/20 hover:bg-muted/40 active:scale-[0.98]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/5 ring-1 ring-brand/15">
                    <Sparkles className="h-4 w-4 text-brand" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-semibold text-ink">Quiz</p>
                    <p className="text-[10px] text-muted-foreground">AI-generated</p>
                  </div>
                </button>

                <div className="flex items-center gap-2 border-l border-paper-border/60 pl-2">
                  <span className="whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground/50">
                    {selectedList.words.length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {renderWords(pageWords, isOwn)}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-4 text-xs">
              <button
                onClick={() => setWordPage((p) => Math.max(1, p - 1))}
                disabled={wordPage === 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-colors hover:border-ink/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground/50">
                {start + 1}&ndash;{end} of {total}
              </span>
              <button
                onClick={() => setWordPage((p) => Math.min(totalPages, p + 1))}
                disabled={wordPage === totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-colors hover:border-ink/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </main>

        {studyMode && (
          <CollectionStudy
            words={toCollectionWords(selectedList.words)}
            collectionName={selectedList.name}
            initialMode={studyMode}
            onClose={() => setStudyMode(null)}
          />
        )}

        {studyWord && (
          <CollectionStudy
            words={toCollectionWords([studyWord])}
            collectionName={selectedList.name}
            initialMode="flashcard"
            onClose={() => setStudyWord(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-paper-border bg-canvas/85 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard" aria-label="Back to dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-fg shadow-sm">
            <List className="h-3.5 w-3.5" />
          </div>
          <span className="font-serif text-base font-bold tracking-tight text-ink">Word Lists</span>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
          <button onClick={() => setTab('lists')} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${tab === 'lists' ? 'bg-card text-ink shadow-sm' : 'text-muted-foreground hover:text-ink'}`}>
            My Lists
          </button>
          <button onClick={() => setTab('discover')} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${tab === 'discover' ? 'bg-card text-ink shadow-sm' : 'text-muted-foreground hover:text-ink'}`}>
            Discover
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : tab === 'lists' ? (
          <>
            {showCreate && (
              <div className="mb-6 rounded-xl border border-paper-border bg-card p-4 shadow-sm">
                <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">New List</h2>
                <div className="space-y-3">
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Name"
                    className="h-9 w-full rounded-lg border border-paper-border bg-muted/40 px-3 text-sm text-ink outline-none transition-all placeholder:text-muted-foreground/35 focus:border-brand/50 focus:ring-2 focus:ring-brand/15"
                  />
                  <input
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="h-9 w-full rounded-lg border border-paper-border bg-muted/40 px-3 text-sm text-ink outline-none transition-all placeholder:text-muted-foreground/35 focus:border-brand/50 focus:ring-2 focus:ring-brand/15"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={createPublic} onChange={(e) => setCreatePublic(e.target.checked)} className="h-3.5 w-3.5 rounded accent-brand" />
                    Make public
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={creating || !createName.trim()}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
                    >
                      {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Create
                    </button>
                    <button
                      onClick={() => setShowCreate(false)}
                      className="flex h-9 items-center justify-center rounded-lg border border-paper-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {ownLists.length === 0 && subscribed.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-paper-border bg-card shadow-sm">
                  <List className="h-6 w-6 text-brand/60" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold tracking-tight text-ink">No word lists yet</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first list to organize vocabulary</p>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
                >
                  <Plus className="h-4 w-4" /> New List
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {ownLists.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center gap-2.5">
                      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your Lists</h2>
                      <div className="h-px flex-1 bg-paper-border/70" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ownLists.map((list) => {
                        const isDefault = defaultListId === list._id
                        return (
                          <button key={list._id} onClick={() => setSelectedList(list)} className="group rounded-xl border border-paper-border bg-card p-4 text-left shadow-sm transition-all hover:border-brand/40 hover:shadow-md">
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isDefault && <Star className="h-3.5 w-3.5 shrink-0 fill-brand text-brand" />}
                                <h3 className="truncate font-serif text-sm font-bold tracking-tight text-ink">{list.name}</h3>
                              </div>
                              {list.isPublic ? <Globe className="h-3 w-3 shrink-0 text-brand" /> : <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            </div>
                            {list.description && <p className="mb-1.5 truncate text-xs text-muted-foreground">{list.description}</p>}
                            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{list.words.length} words</p>
                            {list.words.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {list.words.slice(0, 3).map((w) => (
                                  <span key={w.word} className="rounded-full bg-muted/30 px-2 py-0.5 font-serif text-[10px] font-medium text-ink/70">{w.word}</span>
                                ))}
                                {list.words.length > 3 && <span className="rounded-full bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">+{list.words.length - 3}</span>}
                              </div>
                            )}
                            <span
                              onClick={(e) => { e.stopPropagation(); setDefaultListId(isDefault ? null : list._id) }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDefaultListId(isDefault ? null : list._id) } }}
                              className={`mt-2 inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium transition-colors ${isDefault ? 'text-brand' : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-brand'}`}
                            >
                              <Star className={`h-2.5 w-2.5 ${isDefault ? 'fill-brand' : ''}`} />
                              {isDefault ? 'Default list' : 'Set as default'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}

                {subscribed.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center gap-2.5">
                      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Subscribed</h2>
                      <div className="h-px flex-1 bg-paper-border/70" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {subscribed.map((list) => (
                        <button key={list._id} onClick={() => setSelectedList(list)} className="rounded-xl border border-paper-border bg-card p-4 text-left shadow-sm transition-all hover:border-brand/40 hover:shadow-md">
                          <div className="mb-1 flex items-center justify-between">
                            <h3 className="truncate font-serif text-sm font-bold tracking-tight text-ink">{list.name}</h3>
                            <Globe className="h-3 w-3 shrink-0 text-brand" />
                          </div>
                          {list.description && <p className="mb-1.5 truncate text-xs text-muted-foreground">{list.description}</p>}
                          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{list.words.length} words · by {list.username}</p>
                          {list.words.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {list.words.slice(0, 3).map((w) => (
                                <span key={w.word} className="rounded-full bg-muted/30 px-2 py-0.5 font-serif text-[10px] font-medium text-ink/70">{w.word}</span>
                              ))}
                              {list.words.length > 3 && <span className="rounded-full bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">+{list.words.length - 3}</span>}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-paper-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
                >
                  <Plus className="h-4 w-4" /> New List
                </button>
              </div>
            )}
          </>
        ) : (
          /* Discover tab */
          <>
            {discover.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-paper-border bg-card shadow-sm">
                  <Globe className="h-6 w-6 text-brand/60" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold tracking-tight text-ink">No public lists yet</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Make your lists public so others can discover them</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {discover.filter((l) => !ownLists.some((o) => o._id === l._id) && !subscribed.some((s) => s._id === l._id)).map((list) => (
                  <div key={list._id} className="rounded-xl border border-paper-border bg-card p-4 shadow-sm transition-all hover:border-brand/40 hover:shadow-md">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="truncate font-serif text-sm font-bold tracking-tight text-ink">{list.name}</h3>
                      <Globe className="h-3 w-3 shrink-0 text-brand" />
                    </div>
                    {list.description && <p className="mb-1.5 truncate text-xs text-muted-foreground">{list.description}</p>}
                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{list.words.length} words · by {list.username} · {list.subscriberCount} subscriber{list.subscriberCount !== 1 ? 's' : ''}</p>
                    {list.words.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {list.words.slice(0, 3).map((w) => (
                          <span key={w.word} className="rounded-full bg-muted/30 px-2 py-0.5 font-serif text-[10px] font-medium text-ink/70">{w.word}</span>
                        ))}
                        {list.words.length > 3 && <span className="rounded-full bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">+{list.words.length - 3}</span>}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleSubscribe(list._id)}
                        className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-brand text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
                      >
                        <Plus className="h-3 w-3" /> Subscribe
                      </button>
                      <button
                        onClick={() => handleImport(list._id, list.words)}
                        disabled={importing.has(list._id)}
                        className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-paper-border text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {importing.has(list._id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                        {importing.has(list._id) ? 'Importing...' : 'Import'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )

}