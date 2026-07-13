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
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePDFStore, type WordList, type WordListWord } from '@/store/use-pdf-store'

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

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    fetchLists()
  }, [user, authLoading, router])

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
      <div className="flex flex-col items-center py-12 text-center text-sm text-muted-foreground">
        <BookOpen className="mb-2 h-10 w-10 opacity-30" />
        <p>No words yet</p>
        <p className="mt-1 text-xs">Select a word in the reader to add it here</p>
      </div>
    )
    return (
      <div className="divide-y">
        {words.map((w) => (
          <div key={w.word} className="flex items-start justify-between py-3 group">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-serif text-sm font-bold text-foreground">{w.word}</span>
                {w.partOfSpeech && (
                  <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-500">{w.partOfSpeech}</span>
                )}
              </div>
              {w.meaning && <p className="mt-0.5 text-xs text-muted-foreground">{w.meaning}</p>}
              {w.translation && <p className="mt-0.5 text-xs text-muted-foreground/60">{w.translation}</p>}
            </div>
            {isOwn && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveWord(w.word)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (selectedList) {
    const isOwn = selectedList.username === user?.username
    const isDefault = defaultListId === selectedList._id
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
            <button onClick={() => setSelectedList(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <List className="h-3.5 w-3.5" />
            </div>
            <h1 className="flex-1 truncate font-serif text-sm font-bold text-foreground">{selectedList.name}</h1>
            {isOwn && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDefaultListId(isDefault ? null : selectedList._id)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${isDefault ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
                >
                  <Star className={`h-3 w-3 ${isDefault ? 'fill-amber-500' : ''}`} />
                  {isDefault ? 'Default' : 'Set default'}
                </button>
                <button
                  onClick={() => { if (confirm('Delete this list?')) handleDeleteList(selectedList._id) }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            )}
            {!isOwn && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleImport(selectedList._id, selectedList.words)}
                  disabled={importing.has(selectedList._id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-emerald-600 disabled:opacity-50"
                >
                  {importing.has(selectedList._id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                  {importing.has(selectedList._id) ? 'Importing...' : 'Import'}
                </button>
                <button
                  onClick={() => handleUnsubscribe(selectedList._id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <UserMinus className="h-3 w-3" />
                  Unsubscribe
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-6">
          {selectedList.description && (
            <p className="mb-4 text-sm text-muted-foreground">{selectedList.description}</p>
          )}
          <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{selectedList.words.length} word{selectedList.words.length !== 1 ? 's' : ''}</span>
            {selectedList.isPublic && <span className="flex items-center gap-1"><Globe className="h-3 w-3 text-orange-500" /> Public</span>}
            {isOwn && <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Private</span>}
            {!isOwn && <span>by {selectedList.username}</span>}
          </div>
          <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
            {renderWords(selectedList.words, isOwn)}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Link href="/dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <List className="h-3.5 w-3.5" />
          </div>
          <h1 className="flex-1 text-sm font-bold text-foreground">Word Lists</h1>
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
            <button onClick={() => setTab('lists')} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${tab === 'lists' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              My Lists
            </button>
            <button onClick={() => setTab('discover')} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${tab === 'discover' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Discover
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        ) : tab === 'lists' ? (
          <>
            {showCreate && (
              <div className="mb-6 rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">New List</h2>
                <div className="space-y-3">
                  <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Name" className="h-9 text-sm" />
                  <Input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="Description (optional)" className="h-9 text-sm" />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={createPublic} onChange={(e) => setCreatePublic(e.target.checked)} className="rounded" />
                    Make public
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreate} disabled={creating || !createName.trim()}>
                      {creating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                      Create
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            )}

            {ownLists.length === 0 && subscribed.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <List className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <h2 className="text-lg font-semibold text-foreground">No word lists yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">Create your first list to organize vocabulary</p>
                <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="mr-1 h-4 w-4" /> New List
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {ownLists.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Lists</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ownLists.map((list) => {
                        const isDefault = defaultListId === list._id
                        return (
                          <button key={list._id} onClick={() => setSelectedList(list)} className="group rounded-xl border bg-background/60 p-4 text-left shadow-sm backdrop-blur-sm transition-all hover:bg-accent/30 hover:shadow-md">
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isDefault && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />}
                                <h3 className="truncate font-serif text-sm font-bold text-foreground">{list.name}</h3>
                              </div>
                              {list.isPublic ? <Globe className="h-3 w-3 shrink-0 text-orange-500" /> : <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            </div>
                            {list.description && <p className="mb-1.5 truncate text-xs text-muted-foreground">{list.description}</p>}
                            <p className="text-[11px] text-muted-foreground">{list.words.length} words</p>
                            {list.words.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {list.words.slice(0, 3).map((w) => (
                                  <span key={w.word} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{w.word}</span>
                                ))}
                                {list.words.length > 3 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{list.words.length - 3}</span>}
                              </div>
                            )}
                            <span
                              onClick={(e) => { e.stopPropagation(); setDefaultListId(isDefault ? null : list._id) }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDefaultListId(isDefault ? null : list._id) } }}
                              className={`mt-2 inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium transition-colors ${isDefault ? 'text-amber-500' : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-amber-500'}`}
                            >
                              <Star className={`h-2.5 w-2.5 ${isDefault ? 'fill-amber-500' : ''}`} />
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
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Subscribed</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {subscribed.map((list) => (
                        <button key={list._id} onClick={() => setSelectedList(list)} className="rounded-xl border bg-background/60 p-4 text-left shadow-sm backdrop-blur-sm transition-all hover:bg-accent/30 hover:shadow-md">
                          <div className="mb-1 flex items-center justify-between">
                            <h3 className="truncate font-serif text-sm font-bold text-foreground">{list.name}</h3>
                            <Globe className="h-3 w-3 shrink-0 text-orange-500" />
                          </div>
                          {list.description && <p className="mb-1.5 truncate text-xs text-muted-foreground">{list.description}</p>}
                          <p className="text-[11px] text-muted-foreground">{list.words.length} words · by {list.username}</p>
                          {list.words.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {list.words.slice(0, 3).map((w) => (
                                <span key={w.word} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{w.word}</span>
                              ))}
                              {list.words.length > 3 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{list.words.length - 3}</span>}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <Button className="w-full" size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                  <Plus className="mr-1 h-4 w-4" /> New List
                </Button>
              </div>
            )}
          </>
        ) : (
          /* Discover tab */
          <>
            {discover.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <Globe className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <h2 className="text-lg font-semibold text-foreground">No public lists yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">Make your lists public so others can discover them</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {discover.filter((l) => !ownLists.some((o) => o._id === l._id) && !subscribed.some((s) => s._id === l._id)).map((list) => (
                  <div key={list._id} className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="truncate font-serif text-sm font-bold text-foreground">{list.name}</h3>
                      <Globe className="h-3 w-3 shrink-0 text-orange-500" />
                    </div>
                    {list.description && <p className="mb-1.5 truncate text-xs text-muted-foreground">{list.description}</p>}
                    <p className="text-[11px] text-muted-foreground">{list.words.length} words · by {list.username} · {list.subscriberCount} subscriber{list.subscriberCount !== 1 ? 's' : ''}</p>
                    {list.words.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {list.words.slice(0, 3).map((w) => (
                          <span key={w.word} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{w.word}</span>
                        ))}
                        {list.words.length > 3 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{list.words.length - 3}</span>}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={() => handleSubscribe(list._id)}>
                        <Plus className="mr-1 h-3 w-3" /> Subscribe
                      </Button>
                      <Button size="sm" variant="secondary" className="h-8 flex-1 text-xs" onClick={() => handleImport(list._id, list.words)} disabled={importing.has(list._id)}>
                        {importing.has(list._id) ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <BookOpen className="mr-1 h-3 w-3" />}
                        {importing.has(list._id) ? 'Importing...' : 'Import'}
                      </Button>
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
