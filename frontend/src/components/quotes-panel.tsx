'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Quote as QuoteIcon, Trash2, BookOpen, Loader2, MessageSquarePlus, Search, X, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import type { Quote } from '@/lib/quotes'

export function QuotesPanel() {
  const {
    quotes,
    showQuotes,
    setShowQuotes,
    pdfFileName,
    removeQuote,
    addQuote,
    addQuoteConversation,
  } = usePDFStore()

  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dbQuotes, setDbQuotes] = useState<Quote[]>([])

  // Filter to the current book (and any unsynced local ones)
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

  // Reset selection when the panel is closed or the book changes
  useEffect(() => {
    if (!showQuotes) setSelected(new Set())
  }, [showQuotes, pdfFileName])

  // Hydrate from server when the panel opens (keeps the local store in sync
  // if another tab/AI added a quote while this one was closed).
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
      } catch {
        if (prev) addQuote(prev)
      } finally {
        setDeletingId(null)
      }
    },
    [quotes, removeQuote, addQuote]
  )

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
          iconClassName="text-yellow-500"
          title="Saved Quotes"
          badge={
            <span className="text-[10px] text-muted-foreground">({visibleQuotes.length})</span>
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
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-white">
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
                    className="h-9 gap-1.5 bg-yellow-500 text-xs font-semibold text-white hover:bg-yellow-600"
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
              className="h-9 w-full rounded-lg border border-border/50 bg-muted/40 pl-8 pr-8 text-sm placeholder:text-muted-foreground/60 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30"
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
              <span className="font-semibold text-yellow-600">
                {selectedCount} selected
              </span>
            )}
          </div>
        </div>

        {visibleQuotes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <QuoteIcon className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                {search ? 'No quotes match your search' : 'No quotes saved yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Open a quote in the word popup and tap the quote icon to save it
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {visibleQuotes.map((q) => {
              const isSelected = selected.has(q.id)
              return (
                <div
                  key={q.id}
                  className={`group relative cursor-pointer border-b px-3 py-3 transition-colors ${
                    isSelected ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => toggleSelected(q.id)}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelected(q.id)
                      }}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        isSelected
                          ? 'border-yellow-500 bg-yellow-500 text-white'
                          : 'border-border/60 bg-background/50 text-transparent group-hover:border-yellow-500/50'
                      }`}
                      aria-pressed={isSelected}
                      aria-label={isSelected ? 'Deselect quote' : 'Select quote'}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-foreground line-clamp-4">
                        &ldquo;{q.text}&rdquo;
                      </p>
                      {q.noteText && (
                        <p className="mt-1.5 text-xs italic text-muted-foreground line-clamp-2">
                          Note: {q.noteText}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <BookOpen className="h-3 w-3 shrink-0" />
                        <span className="truncate">{q.pdfFileName}</span>
                        <span>·</span>
                        <span>Page {q.pageNumber || '?'}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
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
              )
            })}
          </div>
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
    </ResponsivePanel>
  )
}
