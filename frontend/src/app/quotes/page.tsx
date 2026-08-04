'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Search, ChevronDown, ChevronUp, Loader2, Quote as QuoteIcon, Calendar, Hash, Trash2, MessageSquarePlus, Edit3, Save, X, Sparkles, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { QUOTE_LIMITS } from '@/lib/quotes'
import type { Quote } from '@/lib/quotes'
import { QuoteCardModal } from '@/components/quote-card-modal'

const QUOTES_PER_PAGE = 30

export default function QuotesPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [pdfs, setPdfs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pdfFilter, setPdfFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [creating, setCreating] = useState(false)
  const [cardQuote, setCardQuote] = useState<Quote | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    loadQuotes()
  }, [user, authLoading, router])

  const loadQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (pdfFilter) params.set('pdfFileName', pdfFilter)
      if (search) params.set('search', search)
      const res = await authFetch(`/api/db/quotes?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setQuotes(Array.isArray(data) ? data : [])
        const uniquePdfs = Array.from(new Set((Array.isArray(data) ? data : []).map((q: Quote) => q.pdfFileName).filter(Boolean)))
        setPdfs(uniquePdfs)
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [pdfFilter, search])

  useEffect(() => {
    setPage(1)
    loadQuotes()
  }, [pdfFilter, loadQuotes])

  useEffect(() => {
    setPage(1)
  }, [search])

  const handleDelete = async (id: string) => {
    setQuotes((prev) => prev.filter((q) => q.id !== id))
    setDeleteConfirm(null)
    try {
      await authFetch(`/api/db/quotes/${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch {
      loadQuotes()
    }
  }

  const handleStartEdit = (q: Quote) => {
    setEditingId(q.id)
    setEditingNote(q.noteText || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingNote('')
  }

  const handleSaveNote = async (id: string) => {
    setSavingNote(true)
    try {
      const res = await authFetch(`/api/db/quotes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText: editingNote }),
      })
      if (res.ok) {
        setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, noteText: editingNote } : q)))
        setEditingId(null)
        setEditingNote('')
      }
    } catch {
      /* ignore */
    } finally {
      setSavingNote(false)
    }
  }

  const handleStartChat = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) return
    setCreating(true)
    try {
      const res = await authFetch('/api/quote-chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New quote chat', quoteIds: selectedIds }),
      })
      const data = await res.json()
      if (data.success && data.conversation?.id) {
        router.push(`/quotes/chat/${data.conversation.id}`)
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return quotes
    const q = search.toLowerCase()
    return quotes.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        (item.context || '').toLowerCase().includes(q) ||
        (item.noteText || '').toLowerCase().includes(q)
    )
  }, [quotes, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / QUOTES_PER_PAGE))
  const paginated = filtered.slice((page - 1) * QUOTES_PER_PAGE, page * QUOTES_PER_PAGE)
  const paginatedIds = paginated.map((q) => q.id)

  const bookTitle = (fileName: string) => fileName.split('/').pop() || fileName

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-paper-border bg-canvas/85 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard" aria-label="Back to dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-paper-border text-muted-foreground transition-all hover:border-ink/20 hover:bg-muted/40 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-fg shadow-sm">
            <QuoteIcon className="h-3.5 w-3.5" />
          </div>
          <span className="font-serif text-base font-bold tracking-tight text-ink">Passages</span>
          <span className="rounded-md bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground tabular-nums">
            {filtered.length} passage{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/quotes/chat"
            className="hidden h-7 items-center gap-1.5 rounded-md border border-paper-border bg-card px-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-ink sm:inline-flex"
          >
            <MessageSquarePlus className="h-3 w-3" />
            Chats
          </Link>
          <button
            onClick={() => handleStartChat(paginatedIds)}
            disabled={creating || paginated.length === 0}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-brand px-2 text-[10px] font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Chat with page
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── FILTERS ── */}
        <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search passages, context, or notes..."
              className="h-9 w-full rounded-lg border border-paper-border bg-muted/40 pl-9 pr-3 text-sm text-ink outline-none transition-all placeholder:text-muted-foreground/35 focus:border-brand/50 focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <select
            value={pdfFilter}
            onChange={(e) => setPdfFilter(e.target.value)}
            className="h-9 rounded-lg border border-paper-border bg-muted/40 px-2.5 text-sm text-ink outline-none transition-all focus:border-brand/50 focus:ring-2 focus:ring-brand/15 sm:w-52"
          >
            <option value="">All Books</option>
            {pdfs.map((p) => (
              <option key={p} value={p}>{bookTitle(p)}</option>
            ))}
          </select>
        </div>

        {/* ── QUOTE LIST ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <span className="text-xs text-muted-foreground/50">Loading your passages...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-paper-border bg-card shadow-sm">
              <QuoteIcon className="h-6 w-6 text-brand/60" />
            </div>
            <div>
              <p className="font-serif text-lg font-bold tracking-tight text-ink">
                {search || pdfFilter ? 'No passages match your filters' : 'No passages saved yet'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/50">
                {search || pdfFilter
                  ? 'Try adjusting your search or book filter above'
                  : 'Select text while reading, then tap the quote icon to save it'}
              </p>
            </div>
            {!search && !pdfFilter && (
              <Link href="/dashboard" className="mt-1 flex h-9 items-center rounded-lg bg-brand px-4 text-xs font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97]">
                Start Reading
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {paginated.map((q) => {
              const isExpanded = expanded === q.id
              const isEditing = editingId === q.id
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border shadow-sm transition-all ${
                    isExpanded
                      ? 'border-brand/40 bg-card shadow-brand/5'
                      : 'border-paper-border bg-card hover:border-brand/40 hover:shadow-md'
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(isExpanded ? null : q.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpanded(isExpanded ? null : q.id)
                      }
                    }}
                    className="flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left"
                  >
                    <div
                      className="mt-1 h-10 w-1 shrink-0 rounded-full"
                      style={{ background: q.color || 'rgba(16, 185, 129, 0.5)' }}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif text-2xl leading-none text-brand/40 select-none" aria-hidden>&ldquo;</span>
                        <p className="-ml-1 font-serif text-sm leading-relaxed text-ink line-clamp-2">
                          {q.text}
                        </p>
                      </div>
                      {q.noteText && !isExpanded && (
                        <p className="mt-1.5 line-clamp-1 text-xs italic text-ink/60">
                          — {q.noteText}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/50">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-2.5 w-2.5" />
                          {bookTitle(q.pdfFileName)}
                        </span>
                        <span>p. {q.pageNumber || '?'}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(q.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={`mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/25 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(q.id) }}
                      className="shrink-0 rounded p-0.5 text-muted-foreground/15 transition-colors hover:text-red-500 hover:bg-red-500/5"
                      title="Delete passage"
                      aria-label="Delete passage"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-paper-border/50 px-3.5 py-3">
                      {q.context && q.context !== q.text && (
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">Context</p>
                          <p className="mt-0.5 border-l-2 border-brand/30 pl-3 text-xs italic leading-relaxed text-muted-foreground/70">
                            {q.context}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">Your Note</p>
                        {isEditing ? (
                          <div className="mt-1.5 space-y-2">
                            <textarea
                              value={editingNote}
                              onChange={(e) => setEditingNote(e.target.value.slice(0, QUOTE_LIMITS.NOTE_MAX))}
                              placeholder="Why does this passage matter to you?"
                              rows={3}
                              className="w-full rounded-lg border border-paper-border bg-muted/40 px-3 py-2 text-sm text-ink outline-none transition-all placeholder:text-muted-foreground/30 focus:border-brand/50 focus:ring-2 focus:ring-brand/10"
                            />
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-muted-foreground/40 tabular-nums">
                                {editingNote.length}/{QUOTE_LIMITS.NOTE_MAX}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleCancelEdit}
                                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-ink"
                                >
                                  <X className="h-3 w-3" />
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveNote(q.id)}
                                  disabled={savingNote}
                                  className="inline-flex h-7 items-center gap-1 rounded-md bg-brand px-2.5 text-[10px] font-semibold text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                                >
                                  {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-start gap-2">
                            <p className="flex-1 text-sm text-ink">
                              {q.noteText || <span className="text-xs italic text-muted-foreground/40">Add a note about this passage</span>}
                            </p>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartEdit(q) }}
                              className="shrink-0 rounded p-0.5 text-muted-foreground/20 transition-colors hover:text-brand hover:bg-brand/10"
                              title="Edit note"
                              aria-label="Edit note"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartChat([q.id]) }}
                            disabled={creating}
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-brand/10 px-2 text-[10px] font-semibold text-brand transition-colors hover:bg-brand/15 disabled:opacity-50"
                          >
                            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Chat
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCardQuote(q) }}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-paper-border px-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-ink"
                          >
                            <ImageIcon className="h-3 w-3" />
                            Card
                          </button>
                        </div>
                        <Hash className="h-2.5 w-2.5 text-muted-foreground/20" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── PAGINATION ── */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-paper-border/40 pt-4">
            <p className="font-mono text-[11px] text-muted-foreground/50 tabular-nums">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted/40 hover:text-ink disabled:pointer-events-none disabled:opacity-25"
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
                          ? 'bg-brand text-brand-fg shadow-sm'
                          : 'text-muted-foreground/60 hover:bg-muted/40 hover:text-ink'
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
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted/40 hover:text-ink disabled:pointer-events-none disabled:opacity-25"
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
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h3 className="font-serif text-sm font-bold tracking-tight text-ink">Delete this passage?</h3>
                <p className="text-xs text-muted-foreground/60">This will remove it from any quote chats that reference it. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-paper-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote card modal */}
      {cardQuote && (
        <QuoteCardModal
          text={cardQuote.text}
          context={cardQuote.context}
          noteText={cardQuote.noteText}
          bookTitle={cardQuote.pdfFileName}
          pageNumber={cardQuote.pageNumber}
          timestamp={cardQuote.timestamp}
          color={cardQuote.color}
          onClose={() => setCardQuote(null)}
        />
      )}
    </div>
  )
}