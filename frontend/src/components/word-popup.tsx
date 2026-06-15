'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Volume2, Loader2, Sparkles, Languages, Bookmark, Brain, GripVertical, Quote as QuoteIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePDFStore, LANGUAGE_LABELS } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { cleanText } from '@/lib/quotes'

const HIGHLIGHT_COLORS = [
  { value: 'rgba(253, 224, 71, 0.65)', label: 'Yellow', tailwind: 'bg-yellow-400 border-yellow-500' },
  { value: 'rgba(74, 222, 128, 0.65)', label: 'Green',  tailwind: 'bg-green-400 border-green-500' },
  { value: 'rgba(244, 114, 182, 0.65)', label: 'Pink',   tailwind: 'bg-pink-400 border-pink-500' },
  { value: 'rgba(96, 165, 250, 0.65)', label: 'Blue',   tailwind: 'bg-blue-400 border-blue-500' },
]

export function WordPopup() {
  const {
    selectedWord,
    explanation,
    isExplaining,
    isOfflineResult,
    popupPosition,
    clearSelection,
    translationLanguage,
    accent,
    selectedSentence,
    selectedPageNumber,
    pdfFileName,
    addToHistory,
    addBookmark,
    removeBookmark,
    bookmarks,
    addQuote,
    removeQuote,
    quotes,
    setShowQuotes,
    flashcards,
    setExplanation,
    setIsExplaining,
    setIsOfflineResult,
    addSharedBookmark,
    addSharedFlashcard,
  } = usePDFStore()

  const [simplified, setSimplified] = useState<string | null>(null)
  const [isSimplifying, setIsSimplifying] = useState(false)
  const [showSimplified, setShowSimplified] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStateRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const [flashcardStatus, setFlashcardStatus] = useState<'idle' | 'creating' | 'created' | 'exists'>('idle')
  const historyAddedRef = useRef(false)
  const prevLanguageRef = useRef(translationLanguage)
  const prevAccentRef = useRef(accent)

  // Save to history when explanation is received
  useEffect(() => {
    if (
      explanation &&
      selectedWord &&
      selectedSentence &&
      selectedPageNumber &&
      !isExplaining &&
      !historyAddedRef.current
    ) {
      historyAddedRef.current = true
      const entry = {
        id: `hist-${Date.now()}`,
        word: selectedWord,
        meaning: explanation.meaning,
        pronunciation: explanation.pronunciation,
        translation: explanation.translation,
        sentence: selectedSentence,
        pageNumber: selectedPageNumber,
        pdfFileName: pdfFileName || 'unknown',
        timestamp: Date.now(),
      }
      addToHistory(entry)
      // Sync to MongoDB
      authFetch('/api/db/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {})
    }
  }, [explanation, selectedWord, selectedSentence, selectedPageNumber, isExplaining, addToHistory, pdfFileName])

  // Reset drag offset and flashcard state when a new word is selected
  useEffect(() => {
    historyAddedRef.current = false
     
    setDragOffset({ x: 0, y: 0 })
    if (selectedWord && pdfFileName && flashcards.some((f) => f.word === selectedWord && f.pdfFileName === pdfFileName)) {
      setFlashcardStatus('exists')
    } else {
      setFlashcardStatus('idle')
    }
  }, [selectedWord, pdfFileName, flashcards])

  const isBookmarked = selectedPageNumber && selectedWord
    ? bookmarks.some(
        (b) => b.pageNumber === selectedPageNumber && b.word === selectedWord
      )
    : false

  // The popup's "Save Quote" button saves the full sentence (or the word
  // alone if no sentence is available). We deduplicate per (book, page,
  // text) so a user can't accidentally save the same line 5 times.
  const quoteText = cleanText((selectedSentence || selectedWord || ''))
  const isQuoteSaved = selectedPageNumber && quoteText
    ? quotes.some(
        (q) => q.pageNumber === selectedPageNumber && q.text === quoteText && q.pdfFileName === pdfFileName
      )
    : false

  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const handleCreateFlashcard = useCallback(async () => {
    if (!selectedWord || !explanation || !pdfFileName) return
    setFlashcardStatus('creating')
    try {
      const res = await authFetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          word: selectedWord,
          meaning: explanation.meaning,
          pronunciation: explanation.pronunciation || '',
          translation: explanation.translation || '',
          sentence: selectedSentence || '',
          pageNumber: selectedPageNumber || 1,
          pdfFileName,
          bookmarkId: '',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setFlashcardStatus('created')
        // Sync to shared flashcards if in a session
        const session = usePDFStore.getState().shareSession
        if (session) {
          authFetch('/api/share/flashcards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: data.id,
              sessionId: session._id,
              word: selectedWord,
              meaning: explanation.meaning,
              pronunciation: explanation.pronunciation || '',
              translation: explanation.translation || '',
              sentence: selectedSentence || '',
              pageNumber: selectedPageNumber || 1,
              pdfFileName,
            }),
          }).then(async (r) => {
            if (r.ok) {
              const shared = await r.json()
              usePDFStore.getState().addSharedFlashcard(shared)
            }
          }).catch(() => {})
        }
      } else if (data.error === 'Flashcard already exists') {
        setFlashcardStatus('exists')
      }
    } catch {
      setFlashcardStatus('idle')
    }
  }, [selectedWord, explanation, pdfFileName, selectedSentence, selectedPageNumber])

  const handleBookmark = useCallback(() => {
    if (!selectedPageNumber || !explanation) return

    if (isBookmarked) {
      const existing = bookmarks.find(
        (b) => b.pageNumber === selectedPageNumber && b.word === selectedWord
      )
      if (existing) {
        removeBookmark(existing.id)
        authFetch(`/api/db/bookmarks?id=${existing.id}`, { method: 'DELETE' }).catch(() => {})
      }
      return
    }

    const bookmark = {
      id: `bm-${Date.now()}`,
      pageNumber: selectedPageNumber,
      word: selectedWord || '',
      meaning: explanation.meaning,
      pronunciation: explanation.pronunciation,
      translation: explanation.translation,
      sentence: selectedSentence || '',
      timestamp: Date.now(),
      pdfFileName: pdfFileName || 'unknown',
    }
    addBookmark(bookmark)
    authFetch('/api/db/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookmark),
    }).catch(() => {})

    // Sync to shared bookmarks if in a session
    const session = usePDFStore.getState().shareSession
    if (session) {
      authFetch('/api/share/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bookmark, sessionId: session._id }),
      }).then(async (res) => {
        if (res.ok) {
          const shared = await res.json()
          usePDFStore.getState().addSharedBookmark(shared)
        }
      }).catch(() => {})
    }
  }, [selectedPageNumber, explanation, selectedWord, selectedSentence, addBookmark, removeBookmark, bookmarks, isBookmarked, pdfFileName])

  const handleSaveQuote = useCallback(async () => {
    if (!selectedPageNumber || !quoteText || !pdfFileName) return
    if (isQuoteSaved) {
      // Unsave the existing matching quote
      const existing = quotes.find(
        (q) => q.pageNumber === selectedPageNumber && q.text === quoteText && q.pdfFileName === pdfFileName
      )
      if (existing) {
        removeQuote(existing.id)
        try {
          await authFetch(`/api/db/quotes/${encodeURIComponent(existing.id)}`, { method: 'DELETE' })
        } catch {
          // Re-add on failure so the UI doesn't lie
          addQuote(existing)
        }
      }
      return
    }
    setQuoteStatus('saving')
    const draft = {
      text: quoteText.slice(0, 500),
      context: cleanText((selectedSentence || '')).slice(0, 1000),
      noteText: '',
      pageNumber: selectedPageNumber,
      pdfFileName,
      rects: [],
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
        addQuote(data.quote)
        setQuoteStatus('saved')
        // Auto-revert indicator after a moment so the user can re-save edits
        setTimeout(() => setQuoteStatus('idle'), 1500)
      } else {
        setQuoteStatus('idle')
      }
    } catch {
      setQuoteStatus('idle')
    }
  }, [
    selectedPageNumber,
    quoteText,
    pdfFileName,
    isQuoteSaved,
    quotes,
    removeQuote,
    addQuote,
    selectedSentence,
  ])

  const handleSimplify = useCallback(async () => {
    if (!selectedSentence) return
    setIsSimplifying(true)
    setSimplified(null)
    setShowSimplified(true)

    try {
      const res = await authFetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: selectedSentence,
          translationLanguage,
        }),
      })
      const data = await res.json()
      if (res.status === 429) {
        window.dispatchEvent(new CustomEvent('ai-quota-exceeded', { detail: { feature: 'summary' } }))
      }
      setSimplified(data.simplified || data.error || 'Could not simplify')
    } catch {
      setSimplified('Failed to simplify. Please try again.')
    } finally {
      setIsSimplifying(false)
    }
  }, [selectedSentence, translationLanguage])

  const handleHighlightFromPopup = useCallback((colorValue: string) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return

    const textLayer = document.querySelector(`.pdf-text-layer`)
    if (!textLayer || !textLayer.contains(selection.anchorNode)) return

    const canvasElement = textLayer.parentElement?.querySelector(`canvas`)
    if (!canvasElement) return
    const canvasRect = canvasElement.getBoundingClientRect()
    const range = selection.getRangeAt(0)
    const clientRects = Array.from(range.getClientRects())
    
    const store = usePDFStore.getState()
    const activeScale = store.scale

    const rects = clientRects.map((r) => ({
      left: (r.left - canvasRect.left) / activeScale,
      top: (r.top - canvasRect.top) / activeScale,
      width: r.width / activeScale,
      height: r.height / activeScale,
    }))

    const newId = `ann-${Date.now()}-${Math.random()}`
    const newHighlight = {
      id: newId,
      pdfFileName: pdfFileName || 'unknown',
      pageNumber: selectedPageNumber || 1,
      type: 'highlight' as const,
      color: colorValue,
      rects,
      noteText: selection.toString().trim(),
      timestamp: Date.now(),
    }

    store.addAnnotation(newHighlight)
    
    // Sync to DB
    authFetch('/api/db/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newHighlight),
    }).catch(() => {})

    // Sync to shared annotations if in a session
    const session = store.shareSession
    if (session) {
      authFetch('/api/share/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newHighlight, sessionId: session._id }),
      }).then(async (res) => {
        if (res.ok) {
          const sharedAnn = await res.json()
          store.addSharedAnnotation(sharedAnn)
        }
      }).catch(() => {})
    }

    // Clear selection
    selection.removeAllRanges()
    clearSelection()
  }, [pdfFileName, selectedPageNumber, clearSelection])

  const handleGetAIContext = useCallback(async () => {
    if (!selectedWord || !selectedSentence || !selectedPageNumber) return
    setIsExplaining(true)
    setIsOfflineResult(false)
    setExplanation(null)
    try {
      const res = await authFetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: selectedWord,
          sentence: selectedSentence,
          pageNumber: selectedPageNumber,
          translationLanguage,
          accent,
        }),
      })
      const data = await res.json()
      if (res.status === 429) {
        window.dispatchEvent(new CustomEvent('ai-quota-exceeded', { detail: { feature: 'translation' } }))
      }
      if (data.error) {
        setExplanation({ word: selectedWord, meaning: data.error, pronunciation: '', translation: '' })
      } else {
        setExplanation(data)
        window.dispatchEvent(new CustomEvent('ai-quota-changed'))
      }
    } catch {
      setExplanation({ word: selectedWord, meaning: 'Failed to get AI context. Please try again.', pronunciation: '', translation: '' })
    } finally {
      setIsExplaining(false)
    }
  }, [selectedWord, selectedSentence, selectedPageNumber, translationLanguage, accent, setExplanation, setIsExplaining, setIsOfflineResult])

  // Re-fetch explanation when translation language or accent changes (without closing the popup)
  useEffect(() => {
    if (prevLanguageRef.current === translationLanguage && prevAccentRef.current === accent) return
    prevLanguageRef.current = translationLanguage
    prevAccentRef.current = accent
    if (!selectedWord || !selectedSentence || !selectedPageNumber) return
    if (!explanation || isExplaining) return
    handleGetAIContext()
  }, [translationLanguage, accent, selectedWord, selectedSentence, selectedPageNumber, explanation, isExplaining, handleGetAIContext])

  // Reset simplified state when word changes
  if (selectedWord && showSimplified && explanation?.word !== selectedWord) {
    setShowSimplified(false)
    setSimplified(null)
  }

  // Manual drag handlers (replaces framer-motion's `drag` to avoid transform/style.left conflicts)
  const handleHeaderPointerDown = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true)
    dragStateRef.current = {
      startX: clientX,
      startY: clientY,
      baseX: dragOffset.x,
      baseY: dragOffset.y,
    }
  }, [dragOffset])

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, [role="button"]')) return
    e.preventDefault()
    handleHeaderPointerDown(e.clientX, e.clientY)
  }, [handleHeaderPointerDown])

  const handleHeaderTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, [role="button"]')) return
    if (e.touches.length !== 1) return
    handleHeaderPointerDown(e.touches[0].clientX, e.touches[0].clientY)
  }, [handleHeaderPointerDown])

  useEffect(() => {
    if (!isDragging) return
    const onPointerMove = (clientX: number, clientY: number) => {
      if (!dragStateRef.current) return
      const { startX, startY, baseX, baseY } = dragStateRef.current
      setDragOffset({
        x: baseX + (clientX - startX),
        y: baseY + (clientY - startY),
      })
    }
    const onMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onPointerUp = () => {
      setIsDragging(false)
      dragStateRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onPointerUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onPointerUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onPointerUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onPointerUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onPointerUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onPointerUp)
    }
  }, [isDragging])

  if (!selectedWord || !popupPosition) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const isMobile = vw < 640
  const popupWidth = isMobile ? Math.min(360, vw - 24) : 320
  const popupHeight = 300

  // Desktop floating popup layout
  let popupX = popupPosition.x - popupWidth / 2
  let popupY = popupPosition.y

  if (!isMobile) {
    popupX = Math.max(12, Math.min(popupX, vw - popupWidth - 12))
  }

  const spaceAbove = popupY
  const spaceBelow = vh - popupY
  const showAbove = !isMobile && spaceAbove > spaceBelow && spaceAbove > popupHeight

  const popupTop = showAbove
    ? Math.max(8, popupY - popupHeight)
    : Math.min(popupY + 20, vh - 60)

  const maxX = vw - popupWidth - 12
  const maxY = vh - popupHeight - 12
  const clampedLeft = Math.max(12, Math.min(popupX + dragOffset.x, maxX))
  const clampedTop = Math.max(8, Math.min(popupTop + dragOffset.y, maxY))

  // Shared content (used by both desktop popup and mobile bottom sheet)
  const popupContent = (
    <div className="rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
      {/* Header - drag handle */}
      <div
        onMouseDown={isMobile ? undefined : handleHeaderMouseDown}
        onTouchStart={isMobile ? undefined : handleHeaderTouchStart}
        className={`flex items-start justify-between border-b px-3 pt-3 pb-2 select-none ${
          isMobile ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {!isMobile && <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground truncate" title={selectedWord || ''}>
              {selectedWord}
            </h3>
            {selectedSentence && selectedSentence.trim() !== (selectedWord || '').trim() && (
              <p
                className="text-[11px] text-muted-foreground/80 italic truncate -mt-0.5"
                title={selectedSentence}
              >
                &ldquo;{selectedSentence.length > 60 ? selectedSentence.slice(0, 60).trimEnd() + '\u2026' : selectedSentence}&rdquo;
              </p>
            )}
          </div>
          {explanation?.pronunciation && !isExplaining && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <button
                onClick={() => {
                  const utterance = new SpeechSynthesisUtterance(selectedWord)
                    utterance.lang = accent
                  utterance.rate = 0.85
                  speechSynthesis.cancel()
                  speechSynthesis.speak(utterance)
                }}
                className="cursor-pointer text-emerald-500 hover:text-emerald-600 transition-colors"
                title="Click to hear pronunciation"
              >
                <Volume2 className="h-3 w-3" />
              </button>
              <p className="text-xs italic text-muted-foreground">
                {explanation.pronunciation}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {selectedPageNumber && explanation && !isExplaining && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 ${isBookmarked ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-amber-500'}`}
              onClick={handleBookmark}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark this word'}
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-amber-500' : ''}`}
              />
            </Button>
          )}
          {selectedPageNumber && quoteText && (
            <Button
              variant="ghost"
              size="icon"
              className={
                isQuoteSaved
                  ? 'h-6 w-6 text-yellow-600 hover:text-yellow-700'
                  : 'text-muted-foreground hover:text-yellow-600'
              }
              onClick={handleSaveQuote}
              disabled={quoteStatus === 'saving'}
              title={isQuoteSaved ? 'Remove from quotes' : 'Save this sentence as a quote'}
              aria-label={isQuoteSaved ? 'Remove from quotes' : 'Save quote'}
            >
              <QuoteIcon
                className={`h-3.5 w-3.5 ${isQuoteSaved ? 'fill-yellow-500 text-yellow-600' : ''}`}
              />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (isQuoteSaved) {
                setShowQuotes(true)
              }
              clearSelection()
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
        {isExplaining ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            <span className="text-sm text-muted-foreground">
              Analyzing context...
            </span>
          </div>
        ) : explanation ? (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {isOfflineResult ? 'Dictionary Meaning' : 'Contextual Meaning'}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {explanation.meaning}
              </p>
              {explanation.example && (
                <p className="mt-1.5 text-xs italic text-muted-foreground/80 border-l-2 border-muted-foreground/20 pl-2">
                  e.g., {explanation.example}
                </p>
              )}
              {isOfflineResult && !explanation.translation && selectedSentence && !isExplaining && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 gap-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  onClick={handleGetAIContext}
                >
                  <Sparkles className="h-3 w-3" />
                  Get AI Context
                </Button>
              )}
            </div>

            {explanation.translation && (
              <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5">
                  <Languages className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {LANGUAGE_LABELS[translationLanguage]}
                  </p>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {explanation.translation}
                </p>
              </div>
            )}

            {selectedSentence && (
              <div className="border-t pt-2">
                {!showSimplified ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleSimplify}
                  >
                    <Sparkles className="h-3 w-3" />
                    Simplify this sentence
                  </Button>
                ) : isSimplifying ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                    <span className="text-xs text-muted-foreground">
                      Simplifying...
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Simplified Sentence
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">
                      {simplified}
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedPageNumber && explanation && !isExplaining && (
              <div className="flex items-center justify-between border-t border-border/80 pt-2.5 mt-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Highlight Selection</span>
                <div className="flex items-center gap-1.5">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleHighlightFromPopup(color.value)}
                      className={`h-5 w-5 rounded-full ${color.tailwind} transition-all hover:scale-125 border border-border shadow-sm active:scale-95`}
                      title={`Highlight as ${color.label}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedPageNumber && explanation && !isExplaining && (
              <div className="border-t border-border/80 pt-2.5 mt-2">
                <button
                  onClick={handleCreateFlashcard}
                  disabled={flashcardStatus === 'creating' || flashcardStatus === 'created' || flashcardStatus === 'exists'}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-semibold transition-all ${
                    flashcardStatus === 'created' || flashcardStatus === 'exists'
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/30'
                  }`}
                >
                  {flashcardStatus === 'creating' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Brain className="h-3 w-3" />
                  )}
                  {flashcardStatus === 'created'
                    ? 'Flashcard created!'
                    : flashcardStatus === 'exists'
                      ? 'Already a flashcard'
                      : 'Create Flashcard'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            No explanation available
          </p>
        )}
      </div>
    </div>
  )

  return (
    <AnimatePresence>
      {/* Mobile bottom sheet backdrop */}
      {selectedWord && popupPosition && isMobile && (
        <motion.div
          key="popup-backdrop"
          className="fixed inset-0 z-40 bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => clearSelection()}
        />
      )}
      {/* Mobile bottom sheet */}
      {selectedWord && popupPosition && isMobile && (
        <motion.div
          key="popup-sheet"
          data-popup
          className="fixed bottom-0 left-0 right-0 z-50"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="mx-auto my-2 flex w-10 h-1.5 rounded-full bg-muted-foreground/30" />
          {popupContent}
        </motion.div>
      )}
      {/* Desktop floating popup */}
      {selectedWord && popupPosition && !isMobile && (
        <motion.div
          key="popup"
          data-popup
          className="fixed z-50"
          style={{
            left: clampedLeft,
            top: clampedTop,
            width: popupWidth,
          }}
          initial={{ opacity: 0, y: showAbove ? 10 : -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: showAbove ? 5 : -5, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {popupContent}

          {/* Arrow */}
          <div className="flex justify-center">
            {showAbove ? (
              <div className="h-0 w-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-border" />
            ) : (
              <div className="h-0 w-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-border" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
