'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Search, ChevronDown, ChevronUp, Loader2, Quote as QuoteIcon, Calendar, Hash, Trash2, MessageSquarePlus, Edit3, Save, X, Sparkles, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'
import { QUOTE_LIMITS, truncate } from '@/lib/quotes'
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

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-yellow-500/10 bg-background/60 px-4 shadow-[0_1px_0_0_rgba(234,179,8,0.05)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all hover:border-muted-foreground/20 hover:bg-muted/50 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-md shadow-yellow-500/20 ring-1 ring-yellow-500/20">
            <QuoteIcon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">Saved Quotes</span>
          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
            {filtered.length} quote{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/quotes/chat"
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 text-xs font-semibold text-yellow-700 transition-colors hover:bg-yellow-500/20 dark:text-yellow-300 sm:inline-flex"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Chats
          </Link>
          <button
            onClick={() => handleStartChat(paginatedIds)}
            disabled={creating || paginated.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-yellow-500 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-yellow-600 disabled:opacity-50"
            title="Start a new AI chat with the quotes on this page"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Chat with this page
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── STATS BAR ── */}
        {filtered.length > 0 && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Total Quotes</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{filtered.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Books Quoted</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{pdfs.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Latest</p>
              <p className="mt-1 text-sm font-medium text-foreground truncate">
                {filtered[0]?.text ? `&ldquo;${truncate(filtered[0].text, 40)}&rdquo;` : '—'}
              </p>
              {filtered[0] && (
                <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                  {new Date(filtered[0].timestamp).toLocaleDateString()} · {filtered[0].pdfFileName.split('/').pop()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── FILTERS ── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotes, context, or notes..."
              className="h-10 w-full rounded-lg border border-border/60 bg-background/80 pl-9 pr-3 text-base outline-none transition-all focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/15 sm:h-9 sm:text-sm"
            />
          </div>
          <select
            value={pdfFilter}
            onChange={(e) => setPdfFilter(e.target.value)}
            className="h-10 w-full rounded-lg border border-border/60 bg-background/80 px-2.5 text-base outline-none transition-all focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/15 sm:h-9 sm:w-56 sm:text-sm"
          >
            <option value="">All Books</option>
            {pdfs.map((p) => (
              <option key={p} value={p}>{p.split('/').pop() || p}</option>
            ))}
          </select>
        </div>

        {/* ── QUOTE LIST ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <QuoteIcon className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-semibold text-muted-foreground/50">
              {search || pdfFilter ? 'No quotes match your filters' : 'No quotes saved yet'}
            </p>
            <p className="text-xs text-muted-foreground/40">
              Open a quote in the word popup and tap the quote icon to save it
            </p>
            {!search && !pdfFilter && (
              <Link href="/dashboard" className="mt-2 rounded-lg bg-yellow-500 px-4 py-2 text-xs font-semibold text-white hover:bg-yellow-600 transition-colors">
                Start Reading
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {paginated.map((q) => {
              const isExpanded = expanded === q.id
              const isEditing = editingId === q.id
              return (
                <div
                  key={q.id}
                  className="group rounded-xl border border-border/40 bg-background/60 shadow-sm transition-all hover:border-border/70 hover:shadow-md"
                >
                  {/* UI fix (U3): previously a <button> wrapping a <button> (the
                      trash icon) — invalid HTML that breaks screen readers and
                      can produce weird click behavior. Now a div[role=button]. */}
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
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left cursor-pointer"
                  >
                    <div
                      className="mt-1 h-8 w-1 shrink-0 rounded-full"
                      style={{ background: q.color || 'rgba(253, 224, 71, 0.65)' }}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed text-foreground line-clamp-3">
                        &ldquo;{q.text}&rdquo;
                      </p>
                      {q.noteText && !isExpanded && (
                        <p className="mt-1.5 text-xs italic text-yellow-700 dark:text-yellow-400 line-clamp-1">
                          — {q.noteText}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/60">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {q.pdfFileName.split('/').pop() || q.pdfFileName}
                        </span>
                        <span>Page {q.pageNumber || '?'}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(q.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                    ) : (
                      <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm(q.id)
                      }}
                      className="shrink-0 rounded p-1 text-muted-foreground/20 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Delete quote"
                      aria-label="Delete quote"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-border/30 px-4 py-3">
                      {q.context && q.context !== q.text && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Surrounding Context</p>
                          <p className="mt-0.5 text-sm italic text-muted-foreground/80 border-l-2 border-muted-foreground/20 pl-2">
                            {q.context}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">Your Note</p>
                        {isEditing ? (
                          <div className="mt-1.5 space-y-2">
                            <textarea
                              value={editingNote}
                              onChange={(e) => setEditingNote(e.target.value.slice(0, QUOTE_LIMITS.NOTE_MAX))}
                              placeholder="Why does this quote matter to you?"
                              rows={3}
                              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/15"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                                {editingNote.length}/{QUOTE_LIMITS.NOTE_MAX}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button2 onClick={handleCancelEdit} variant="ghost" icon={X}>
                                  Cancel
                                </Button2>
                                <Button2
                                  onClick={() => handleSaveNote(q.id)}
                                  variant="primary"
                                  icon={savingNote ? Loader2 : Save}
                                  loading={savingNote}
                                >
                                  Save
                                </Button2>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-start gap-2">
                            <p className="flex-1 text-sm text-foreground">
                              {q.noteText || <span className="italic text-muted-foreground/40">No note yet — click the pencil to add one</span>}
                            </p>
                            <button
                              onClick={() => handleStartEdit(q)}
                              className="shrink-0 rounded p-1 text-muted-foreground/30 transition-colors hover:bg-muted hover:text-foreground"
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
                            onClick={() => handleStartChat([q.id])}
                            disabled={creating}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 text-xs font-semibold text-yellow-700 transition-colors hover:bg-yellow-500/20 disabled:opacity-50 dark:text-yellow-300"
                          >
                            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            Chat
                          </button>
                          <button
                            onClick={() => setCardQuote(q)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors hover:opacity-80"
                            style={{ borderColor: 'var(--paper-border)', color: 'var(--ink)' }}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            Card
                          </button>
                        </div>
                        <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                          <Hash className="inline h-2.5 w-2.5" /> {q.id.slice(-6)}
                        </span>
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
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-all hover:bg-muted/50 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronUp className="h-4 w-4 rotate-90" />
            </button>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-all hover:bg-muted/50 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
          </div>
        )}
      </main>

      {/* ── DELETE CONFIRMATION ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">Delete this quote?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This will remove the quote and detach it from any quote chats that reference it. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
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

// Small inline button helper used in the note editor — kept local to avoid
// pulling in a heavier shared Button (with all its variants) for two buttons.
function Button2({
  onClick,
  variant,
  icon: Icon,
  children,
  loading,
}: {
  onClick: () => void
  variant: 'primary' | 'ghost'
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={
        variant === 'primary'
          ? 'inline-flex h-7 items-center gap-1.5 rounded-md bg-yellow-500 px-2.5 text-[11px] font-semibold text-white hover:bg-yellow-600 disabled:opacity-50'
          : 'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      }
    >
      <Icon className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      {children}
    </button>
  )
}
