'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Search, StickyNote, Trash2, Edit3, Save, X, Loader2,
  ChevronDown, ChevronUp, BookOpen
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface PageNote {
  _id: string
  pageNumber: number
  content: string
  pdfFileName: string
  timestamp: string
  updatedAt: string
}

export default function NotesPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [notes, setNotes] = useState<PageNote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedBook, setExpandedBook] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadNotes()
  }, [user, authLoading, router])

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/db/page-notes')
      if (res.ok) {
        const data = await res.json()
        setNotes(Array.isArray(data) ? data : [])
      }
    } catch {}
    setLoading(false)
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n._id !== id))
    try {
      await authFetch(`/api/db/page-notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch {}
  }, [])

  const handleUpdate = useCallback(async (id: string) => {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      await authFetch('/api/db/page-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent.trim() }),
      })
      setNotes((prev) => prev.map((n) => n._id === id ? { ...n, content: editContent.trim(), updatedAt: new Date().toISOString() } : n))
      setEditingId(null)
      setEditContent('')
    } catch {}
    setSaving(false)
  }, [editContent])

  const grouped = useMemo(() => {
    const map = new Map<string, PageNote[]>()
    const sorted = [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    for (const note of sorted) {
      if (!note.pdfFileName) continue
      const searchLower = search.toLowerCase()
      if (search && !note.content.toLowerCase().includes(searchLower) && !note.pdfFileName.toLowerCase().includes(searchLower)) continue
      const arr = map.get(note.pdfFileName) || []
      arr.push(note)
      map.set(note.pdfFileName, arr)
    }
    return Array.from(map.entries())
  }, [notes, search])

  const totalNotes = useMemo(() => {
    const searchLower = search.toLowerCase()
    return notes.filter((n) => {
      if (!search) return true
      return n.content.toLowerCase().includes(searchLower) || n.pdfFileName.toLowerCase().includes(searchLower)
    }).length
  }, [notes, search])

  const formatDate = (s: string) => {
    const d = new Date(s)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-brand" />
            <h1 className="font-serif text-lg font-bold tracking-tight">My Notes</h1>
          </div>
          <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
            {totalNotes}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes or books..."
            className="w-full rounded-xl border border-border/60 bg-card/60 py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground/50 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </div>

        {grouped.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
              <StickyNote className="h-7 w-7 text-brand" />
            </div>
            <h2 className="font-serif text-xl font-bold">No notes yet</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Open a book and start writing notes. They will appear here, grouped by book.
            </p>
            <Button asChild className="mt-5 gap-2">
              <Link href="/dashboard">
                <BookOpen className="h-4 w-4" />
                Open Dashboard
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([bookName, bookNotes]) => {
              const isExpanded = expandedBook === bookName || (expandedBook === null && grouped.length === 1)

              return (
                <div key={bookName} className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
                  {/* Book header */}
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                    onClick={() => setExpandedBook(isExpanded ? null : bookName)}
                  >
                    <BookOpen className="h-4 w-4 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{bookName}</span>
                    <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
                      {bookNotes.length} note{bookNotes.length !== 1 ? 's' : ''}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {/* Notes list */}
                  {isExpanded && (
                    <div className="space-y-2 border-t border-border/40 px-4 py-3">
                      {bookNotes.map((note) => {
                        const isEditing = editingId === note._id
                        return (
                          <div
                            key={note._id}
                            className="group rounded-lg border border-border/40 bg-background/50 p-3 transition-colors hover:border-brand/20"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/dashboard?open=${encodeURIComponent(note.pdfFileName)}&page=${note.pageNumber}`}
                                className="font-mono text-[10px] font-medium tabular-nums text-brand hover:underline"
                              >
                                Page {note.pageNumber}
                              </Link>
                              <div className="flex shrink-0 items-center gap-1">
                                <span className="text-[10px] text-muted-foreground/60">{formatDate(note.updatedAt)}</span>
                                {!isEditing && (
                                  <>
                                    <button
                                      className="ml-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                                      onClick={() => { setEditingId(note._id); setEditContent(note.content) }}
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                    <button
                                      className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                      onClick={() => handleDelete(note._id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="mt-2">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  rows={3}
                                  className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
                                  autoFocus
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditContent('') }}>
                                    <X className="mr-1 h-3 w-3" /> Cancel
                                  </Button>
                                  <Button size="sm" onClick={() => handleUpdate(note._id)} disabled={!editContent.trim() || saving}>
                                    {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                                {note.content}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
