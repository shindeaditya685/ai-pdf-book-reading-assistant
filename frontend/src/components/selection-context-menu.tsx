'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Quote as QuoteIcon,
  Bookmark,
  Highlighter,
  Copy,
  Languages,
  Volume2,
  Check,
  Loader2,
} from 'lucide-react'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'

const HIGHLIGHT_COLORS = [
  { value: 'rgba(253, 224, 71, 0.65)', label: 'Yellow', tailwind: 'bg-yellow-400 border-yellow-500' },
  { value: 'rgba(74, 222, 128, 0.65)', label: 'Green',  tailwind: 'bg-green-400 border-green-500' },
  { value: 'rgba(244, 114, 182, 0.65)', label: 'Pink',   tailwind: 'bg-pink-400 border-pink-500' },
  { value: 'rgba(96, 165, 250, 0.65)', label: 'Blue',   tailwind: 'bg-blue-400 border-blue-500' },
]

interface ContextMenuState {
  x: number
  y: number
  word: string
  sentence: string
  selectedText: string
  pageNumber: number
  pdfFileName: string
  // Pre-computed for highlight action
  selectionRects: { left: number; top: number; width: number; height: number }[]
  isBookmarked: boolean
  isQuoteSaved: boolean
  hasSelection: boolean
}

const MENU_WIDTH = 240
const MENU_MAX_HEIGHT = 380

function clampPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { x, y }
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    x: Math.max(8, Math.min(x, vw - MENU_WIDTH - 8)),
    y: Math.max(8, Math.min(y, vh - MENU_MAX_HEIGHT - 8)),
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '\u2026' : s
}

export function SelectionContextMenu() {
  const [state, setState] = useState<ContextMenuState | null>(null)
  const [mounted, setMounted] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef<ContextMenuState | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keep ref in sync so the global mousedown handler can read the latest state
  // without re-binding the listener.
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const close = useCallback(() => {
    setState(null)
    setFlash(null)
    setLoadingAction(null)
  }, [])

  // Show a small "Saved!" / "Copied!" pill at the cursor, then close.
  const flashAndClose = useCallback((message: string) => {
    setFlash(message)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setFlash(null)
      setState(null)
    }, 900)
  }, [])

  // Listen for contextmenu on the document (event delegation).
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const textLayer = target.closest('.pdf-text-layer')
      if (!textLayer) return

      // Don't intercept while a non-select annotation tool is active.
      const mode = usePDFStore.getState().annotationMode
      if (mode !== 'select') return

      e.preventDefault()

      // The left-mouse mouseup that completed the text selection just fired
      // handleMouseUp, which set `pendingWord` in pdf-viewer and shows the
      // "Get meaning?" tooltip. The context menu is the only menu the user
      // should see on a right-click, so dismiss the tooltip immediately.
      window.dispatchEvent(new CustomEvent('pdf-clear-pending-word'))

      // Find the page number from the closest [data-page] wrapper.
      const pageWrapper = target.closest('[data-page]')
      const pageNumber = pageWrapper ? Number(pageWrapper.getAttribute('data-page')) : 0
      if (!pageNumber) return

      const store = usePDFStore.getState()
      const pdfFileName = store.pdfFileName || 'unknown'

      // Resolve the selection: prefer the current window selection; fall back
      // to the word under the cursor.
      const sel = window.getSelection()
      const hasSelection = !!(sel && !sel.isCollapsed && sel.toString().trim())
      let word = ''
      let sentence = ''
      let selectedText = ''
      let selectionRects: ContextMenuState['selectionRects'] = []

      if (hasSelection && sel) {
        selectedText = sel.toString().trim()
        word = selectedText.split(/\s+/)[0] || ''
        sentence = selectedText
        // Compute canvas-relative rects so a later "Highlight" click can still
        // draw the highlight even if the live selection has been cleared.
        const canvasElement = textLayer.parentElement?.querySelector('canvas')
        if (canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect()
          const range = sel.getRangeAt(0)
          const rects = Array.from(range.getClientRects())
          const scale = store.scale || 1
          selectionRects = rects.map((r) => ({
            left: (r.left - canvasRect.left) / scale,
            top: (r.top - canvasRect.top) / scale,
            width: r.width / scale,
            height: r.height / scale,
          }))
        }
      } else {
        const span = target.closest('span')
        word = span?.textContent?.trim() || target.textContent?.trim() || ''
        sentence = word
        selectedText = word
      }

      const isBookmarked = !!(word && store.bookmarks.some(
        (b) => b.pageNumber === pageNumber && b.word === word
      ))
      const isQuoteSaved = !!(sentence && store.quotes.some(
        (q) => q.pageNumber === pageNumber && q.text === sentence && q.pdfFileName === pdfFileName
      ))

      setState({
        x: e.clientX,
        y: e.clientY,
        word,
        sentence,
        selectedText,
        pageNumber,
        pdfFileName,
        selectionRects,
        isBookmarked,
        isQuoteSaved,
        hasSelection: !!hasSelection,
      })
    }

    // Dismiss on any of these events.
    const handleMouseDown = (e: MouseEvent) => {
      if (!stateRef.current) return
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close()
      }
    }
    const handleScroll = () => close()
    const handleResize = () => close()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('keydown', handleKey)
    }
  }, [close])

  // -- Action handlers --

  const handleGetMeaning = useCallback(() => {
    if (!state) return
    setState(null)
    // pdf-viewer listens for this event and triggers the same flow as
    // handleConfirmMeaning.
    window.dispatchEvent(new CustomEvent('pdf-get-meaning', {
      detail: {
        word: state.word,
        sentence: state.sentence,
        pageNumber: state.pageNumber,
        x: state.x,
        y: state.y,
      },
    }))
  }, [state])

  const handleToggleQuote = useCallback(async () => {
    if (!state || !state.sentence || !state.pageNumber || !state.pdfFileName) return
    if (loadingAction) return
    setLoadingAction('quote')
    const store = usePDFStore.getState()
    if (state.isQuoteSaved) {
      const existing = store.quotes.find(
        (q) => q.pageNumber === state.pageNumber && q.text === state.sentence && q.pdfFileName === state.pdfFileName
      )
      if (existing) {
        store.removeQuote(existing.id)
        try {
          await authFetch(`/api/db/quotes/${encodeURIComponent(existing.id)}`, { method: 'DELETE' })
          flashAndClose('Removed from Quotes')
        } catch {
          store.addQuote(existing)
          flashAndClose('Failed to remove')
        }
      }
      return
    }
    const draft = {
      text: state.sentence.slice(0, 500),
      context: state.selectedText.slice(0, 1000),
      noteText: '',
      pageNumber: state.pageNumber,
      pdfFileName: state.pdfFileName,
      rects: state.selectionRects,
      color: 'rgba(253, 224, 71, 0.65)',
      timestamp: Date.now(),
    }
    try {
      const res = await authFetch('/api/db/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (data.success && data.quote) {
        store.addQuote(data.quote)
        flashAndClose('Saved to Quotes!')
      } else {
        flashAndClose('Failed to save')
      }
    } catch {
      flashAndClose('Failed to save')
    } finally {
      setLoadingAction(null)
    }
  }, [state, flashAndClose, loadingAction])

  const handleToggleBookmark = useCallback(async () => {
    if (!state || !state.word || !state.pageNumber || !state.pdfFileName) return
    if (loadingAction) return
    setLoadingAction('bookmark')
    const store = usePDFStore.getState()
    if (state.isBookmarked) {
      const existing = store.bookmarks.find(
        (b) => b.pageNumber === state.pageNumber && b.word === state.word
      )
      if (existing) {
        store.removeBookmark(existing.id)
        try {
          await authFetch(`/api/db/bookmarks?id=${existing.id}`, { method: 'DELETE' })
          flashAndClose('Bookmark removed')
        } catch {
          store.addBookmark(existing)
          flashAndClose('Failed to remove')
        }
      }
      return
    }
    // Bookmarking without an explanation isn't possible in the existing flow
    // (bookmarks store meaning/translation). Open the meaning popup instead.
    setLoadingAction(null)
    handleGetMeaning()
  }, [state, flashAndClose, handleGetMeaning, loadingAction])

  const handleHighlight = useCallback(async (color: string) => {
    if (!state || !state.hasSelection) return
    if (loadingAction) return
    setLoadingAction('highlight')
    const store = usePDFStore.getState()
    const newId = `ann-${Date.now()}-${Math.random()}`
    const newHighlight = {
      id: newId,
      pdfFileName: state.pdfFileName,
      pageNumber: state.pageNumber,
      type: 'highlight' as const,
      color,
      rects: state.selectionRects,
      noteText: state.selectedText,
      timestamp: Date.now(),
    }
    store.addAnnotation(newHighlight)
    try {
      await authFetch('/api/db/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHighlight),
      })
      flashAndClose('Highlighted!')
    } catch {
      // Keep the local highlight even if the server save fails.
      flashAndClose('Highlighted (offline)')
    } finally {
      setLoadingAction(null)
    }
  }, [state, flashAndClose, loadingAction])

  const handleCopy = useCallback(async () => {
    if (!state?.selectedText) return
    if (loadingAction) return
    setLoadingAction('copy')
    try {
      await navigator.clipboard.writeText(state.selectedText)
      flashAndClose('Copied!')
    } catch {
      const ta = document.createElement('textarea')
      ta.value = state.selectedText
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
      flashAndClose('Copied!')
    } finally {
      setLoadingAction(null)
    }
  }, [state, flashAndClose, loadingAction])

  const handleSimplify = useCallback(() => {
    if (!state) return
    setState(null)
    window.dispatchEvent(new CustomEvent('pdf-simplify-sentence', {
      detail: { sentence: state.sentence, x: state.x, y: state.y },
    }))
  }, [state])

  const handleReadAloud = useCallback(() => {
    if (!state) return
    setState(null)
    const text = state.selectedText || state.sentence
    if (!text.trim()) return
    ;(window as any).__ttsStart?.(text.trim())
  }, [state])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {state && (
        <motion.div
          ref={menuRef}
          role="menu"
          aria-label="Selection actions"
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.08, ease: 'easeOut' }}
          className="fixed z-[60] min-w-[240px] overflow-visible rounded-lg border border-border bg-popover shadow-2xl py-1 text-sm text-popover-foreground"
          style={(() => {
            const p = clampPosition(state.x, state.y)
            return { left: p.x, top: p.y }
          })()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {flash ? (
            <div className="flex items-center gap-2 px-3 py-3 text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              <span className="font-medium">{flash}</span>
            </div>
          ) : (
            <>
              {state.selectedText && state.hasSelection && (
                <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border/60 truncate" title={state.selectedText}>
                  &ldquo;{truncate(state.selectedText, 60)}&rdquo;
                </div>
              )}

              <button
                role="menuitem"
                onClick={handleGetMeaning}
                disabled={!state.word || !!loadingAction}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <span>Get meaning</span>
                <span className="ml-auto text-[10px] text-muted-foreground/60">AI</span>
              </button>

              <button
                role="menuitem"
                onClick={handleToggleQuote}
                disabled={!state.sentence || !!loadingAction}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction === 'quote' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <QuoteIcon
                    className={`h-3.5 w-3.5 ${state.isQuoteSaved ? 'fill-yellow-500 text-yellow-600' : 'text-muted-foreground'}`}
                  />
                )}
                <span>{loadingAction === 'quote' ? 'Saving...' : state.isQuoteSaved ? 'Remove from Quotes' : 'Save as Quote'}</span>
              </button>

              <button
                role="menuitem"
                onClick={handleToggleBookmark}
                disabled={!state.word || !!loadingAction}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction === 'bookmark' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Bookmark
                    className={`h-3.5 w-3.5 ${state.isBookmarked ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`}
                  />
                )}
                <span>{loadingAction === 'bookmark' ? 'Saving...' : state.isBookmarked ? 'Remove Bookmark' : 'Bookmark'}</span>
                {!state.isBookmarked && (
                  <span className="ml-auto text-[10px] text-muted-foreground/60">needs meaning</span>
                )}
              </button>

              <div className="relative group/highlight" role="none">
                <button
                  role="menuitem"
                  disabled={!state.hasSelection || !!loadingAction}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAction === 'highlight' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{loadingAction === 'highlight' ? 'Highlighting...' : 'Highlight'}</span>
                  <span className="ml-auto text-muted-foreground/60">&#9656;</span>
                </button>
                <div
                  role="menu"
                  className="absolute left-full top-0 ml-1 hidden group-hover/highlight:flex group-focus-within/highlight:flex flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-2xl min-w-[120px]"
                >
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      role="menuitem"
                      onClick={() => handleHighlight(c.value)}
                      disabled={!!loadingAction}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted focus:bg-muted focus:outline-none rounded text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingAction === 'highlight' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                      ) : (
                        <span className={`h-4 w-4 rounded-full ${c.tailwind} border shadow-sm shrink-0`} />
                      )}
                      <span className="text-xs">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="my-1 h-px bg-border/60" />

              <button
                role="menuitem"
                onClick={handleSimplify}
                disabled={!state.sentence || state.sentence.split(/\s+/).length < 2 || !!loadingAction}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Languages className="h-3.5 w-3.5 text-amber-500" />
                <span>Simplify sentence</span>
              </button>

              <button
                role="menuitem"
                onClick={handleReadAloud}
                disabled={!state.sentence || !!loadingAction}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Volume2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Read aloud</span>
              </button>

              <button
                role="menuitem"
                onClick={handleCopy}
                disabled={!state.selectedText || !!loadingAction}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction === 'copy' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>{loadingAction === 'copy' ? 'Copying...' : 'Copy text'}</span>
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
