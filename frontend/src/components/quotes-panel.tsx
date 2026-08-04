'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Quote as QuoteIcon, Trash2, Loader2, MessageSquarePlus, Search, X, Check, Sparkles, Plus, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { CountBadge, EmptyState, PillTabs, MemberAvatar } from '@/components/panel-primitives'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/auth-context'
import type { Quote } from '@/lib/quotes'
import { QuoteCardModal } from '@/components/quote-card-modal'

export function QuotesPanel() {
  const {
    quotes,
    showQuotes,
    setShowQuotes,
    pdfFileName,
    removeQuote,
    addQuote,
    addQuoteConversation,
    shareSession,
    sharedQuotes,
    removeSharedQuote,
  } = usePDFStore()

  const { user } = useAuth()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dbQuotes, setDbQuotes] = useState<Quote[]>([])
  const [subTab, setSubTab] = useState<'personal' | 'shared'>('personal')
  const [importingQuoteId, setImportingQuoteId] = useState<string | null>(null)
  const [cardQuote, setCardQuote] = useState<Quote | null>(null)

  const visibleQuotes = useMemo(() => {
    const all = [...quotes, ...dbQuotes.filter((q) => !quotes.some((q2) => q2.id === q.id))]
    const forBook = pdfFileName ? all.filter((q) => q.pdfFileName === pdfFileName) : all
    const q = search.trim().toLowerCase()
    const filtered = q
      ? forBook.filter((item) =>
          item.text.toLowerCase().includes(q) ||
          (item.context || '').toLowerCase().includes(q) ||
          (item.noteText || '').toLowerCase().includes(q)
        )
      : forBook
    return filtered.sort((a, b) => b.timestamp - a.timestamp)
  }, [quotes, dbQuotes, pdfFileName, search])

  useEffect(() => {
    if (!showQuotes) setSelected(new Set())
  }, [showQuotes, pdfFileName])

  useEffect(() => {
    if (!showQuotes) return
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (pdfFileName) params.set('pdfFileName', pdfFileName)
        const res = await authFetch(`/api/db/quotes?${params.toString()}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (Array.isArray(data)) setDbQuotes(data)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showQuotes, pdfFileName])

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      const prev = quotes.find((q) => q.id === id)
      removeQuote(id)
      setDbQuotes((arr) => arr.filter((q) => q.id !== id))
      try {
        await authFetch(`/api/db/quotes/${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (shareSession) {
          await authFetch(`/api/share/quotes?id=${encodeURIComponent(id)}&sessionId=${encodeURIComponent(shareSession._id)}`, { method: 'DELETE' })
          removeSharedQuote(id)
        }
      } catch {
        if (prev) addQuote(prev)
      } finally {
        setDeletingId(null)
      }
    },
    [quotes, removeQuote, addQuote, shareSession, removeSharedQuote]
  )

  const handleDeleteSharedQuote = useCallback(async (quoteId: string) => {
    if (!shareSession) return
    try {
      await authFetch(`/api/share/quotes?id=${encodeURIComponent(quoteId)}&sessionId=${encodeURIComponent(shareSession._id)}`, { method: 'DELETE' })
      removeSharedQuote(quoteId)
    } catch (err) {
      console.error('Failed to delete shared quote:', err)
    }
  }, [shareSession, removeSharedQuote])

  const handleImportQuote = useCallback(async (sq: any) => {
    if (!pdfFileName) return
    setImportingQuoteId(sq.quoteId)
    try {
      const res = await authFetch('/api/db/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sq.text,
          context: sq.context || '',
          noteText: sq.noteText || '',
          pageNumber: sq.pageNumber || 0,
          pdfFileName,
          rects: sq.rects || [],
          color: sq.color || 'rgba(253, 224, 71, 0.65)',
        }),
      })
      const data = await res.json()
      if (data.success) {
        addQuote(data.quote)
      }
    } catch (err) {
      console.error('Failed to import quote:', err)
    } finally {
      setImportingQuoteId(null)
    }
  }, [pdfFileName, addQuote])

  const handleCreateChat = useCallback(async () => {
    if (selected.size === 0) return
    setCreating(true)
    try {
      const quoteIds = Array.from(selected)
      const res = await authFetch('/api/quote-chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New quote chat',
          quoteIds,
        }),
      })
      const data = await res.json()
      if (data.success && data.conversation?.id) {
        addQuoteConversation(data.conversation)
        setSelected(new Set())
        setShowQuotes(false)
        router.push(`/quotes/chat/${data.conversation.id}`)
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false)
    }
  }, [selected, addQuoteConversation, setShowQuotes, router])

  const selectedCount = selected.size

  return (
    <ResponsivePanel
      open={showQuotes}
      onClose={() => setShowQuotes(false)}
      ariaLabel="Saved quotes"
      header={
        <PanelHeader
          icon={QuoteIcon}
          eyebrow="From the page"
          title="Saved Quotes"
          badge={
            <CountBadge
              count={shareSession ? visibleQuotes.length + sharedQuotes.filter((q) => !pdfFileName || q.pdfFileName === pdfFileName).length : visibleQuotes.length}
            />
          }
          onClose={() => setShowQuotes(false)}
        />
      }
      footer={
        <AnimatePresence>
          {selectedCount > 0 && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="border-t bg-background/95 px-4 py-3 backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-fg">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-semibold text-foreground">
                    {selectedCount} quote{selectedCount === 1 ? '' : 's'} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => setSelected(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 bg-brand text-xs font-semibold text-brand-fg hover:opacity-90"
                    onClick={handleCreateChat}
                    disabled={creating}
                  >
                    {creating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Chat with AI
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotes, notes, or context"
              className="h-9 w-full rounded-lg border border-border/50 bg-muted/40 pl-8 pr-8 text-sm placeholder:text-muted-foreground/60 focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {pdfFileName ? `In "${pdfFileName}"` : 'Across all books'}
            </span>
            {selectedCount > 0 && (
              <span className="font-semibold text-brand">
                {selectedCount} selected
              </span>
            )}
          </div>
        </div>

        {shareSession && (
          <div className="px-4 pt-3">
            <PillTabs
              value={subTab}
              onChange={(v) => setSubTab(v as 'personal' | 'shared')}
              tabs={[
                { value: 'personal', label: 'Mine', count: visibleQuotes.length },
                { value: 'shared', label: 'Circle', count: sharedQuotes.filter((q) => !pdfFileName || q.pdfFileName === pdfFileName).length },
              ]}
            />
          </div>
        )}

        {(!shareSession || subTab === 'personal') ? (
          visibleQuotes.length === 0 ? (
            <div className="flex-1 p-4">
              <EmptyState
                icon={QuoteIcon}
                title={search ? 'No quotes match your search' : 'No quotes saved yet'}
                hint="Select a passage in the reader and save it as a quote."
              />
            </div>
          ) : (
            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {visibleQuotes.map((q) => {
                const isSelected = selected.has(q.id)
                return (
                  <div
                    key={q.id}
                    className={`group relative cursor-pointer rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? 'border-brand/40 bg-brand-soft/40'
                        : 'border-border/60 bg-card/60 hover:border-brand/25 hover:bg-card'
                    }`}
                    onClick={() => toggleSelected(q.id)}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelected(q.id)
                        }}
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          isSelected
                            ? 'border-brand bg-brand text-brand-fg'
                            : 'border-border/60 bg-background/50 text-transparent group-hover:border-brand/50'
                        }`}
                        aria-pressed={isSelected}
                        aria-label={isSelected ? 'Deselect quote' : 'Select quote'}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-[15px] leading-snug text-foreground line-clamp-4">
                          &ldquo;{q.text}&rdquo;
                        </p>
                        {q.noteText && (
                          <p className="mt-1.5 text-xs italic text-muted-foreground line-clamp-2">
                            {q.noteText}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                          <span className="max-w-[180px] truncate font-sans text-muted-foreground/80">
                            {q.pdfFileName}
                          </span>
                          <span>·</span>
                          <span>p.{q.pageNumber || '?'}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-brand"
                          onClick={(e) => { e.stopPropagation(); setCardQuote(q) }}
                          aria-label="Generate quote card"
                        >
                          <ImageIcon className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(q.id)
                          }}
                          disabled={deletingId === q.id}
                          aria-label="Delete quote"
                        >
                          {deletingId === q.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          sharedQuotes.filter((q) => !pdfFileName || q.pdfFileName === pdfFileName).length === 0 ? (
            <div className="flex-1 p-4">
              <EmptyState
                icon={QuoteIcon}
                title="Nothing from the circle yet"
                hint="Quotes your group saves will appear here with their reader's ink."
              />
            </div>
          ) : (
            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {[...sharedQuotes]
                .filter((q) => !pdfFileName || q.pdfFileName === pdfFileName)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((q) => {
                  const member = shareSession?.members.find((m) => m.username === q.author)
                  const authorColor = member?.color || '#888'
                  const inPersonal = quotes.some((pq) => pq.text.toLowerCase() === q.text.toLowerCase() && pq.pageNumber === q.pageNumber && pq.pdfFileName === q.pdfFileName)
                  const isImporting = importingQuoteId === q.quoteId

                  return (
                    <div
                      key={q.quoteId}
                      className="group relative rounded-xl border border-border/60 bg-card/60 p-3"
                      style={{ borderLeft: `3px solid ${authorColor}` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex items-center gap-2">
                            <MemberAvatar name={q.author} color={authorColor} size={16} />
                            <span className="text-xs font-semibold" style={{ color: authorColor }}>
                              {q.author} {q.author === user?.username && '(you)'}
                            </span>
                            <span className="ml-auto font-mono text-[10px] text-muted-foreground/50 tabular-nums">
                              p.{q.pageNumber}
                            </span>
                          </div>
                          <p className="font-serif text-[15px] leading-snug text-foreground line-clamp-4">
                            &ldquo;{q.text}&rdquo;
                          </p>
                          {q.noteText && (
                            <p className="mt-1 text-xs italic text-muted-foreground line-clamp-2">{q.noteText}</p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {inPersonal ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                              <Check className="h-2.5 w-2.5" />
                              Saved
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 gap-1 px-2 text-[9px] font-bold"
                              onClick={() => handleImportQuote(q)}
                              disabled={isImporting}
                            >
                              {isImporting ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <Plus className="h-2.5 w-2.5" />
                              )}
                              Import
                            </Button>
                          )}

                          {q.author === user?.username && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                              onClick={() => handleDeleteSharedQuote(q.quoteId)}
                              aria-label="Delete shared quote"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )
        )}

        <div className="border-t px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 text-xs"
            onClick={() => {
              setShowQuotes(false)
              router.push('/quotes')
            }}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Open Quotes library
          </Button>
        </div>
      </div>

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
    </ResponsivePanel>
  )
}
