'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Volume2, Loader2, Sparkles, Languages, Bookmark, GripVertical, Quote as QuoteIcon, ListPlus, Brain } from 'lucide-react'
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
    setExplanation,
    setIsExplaining,
    setIsOfflineResult,
    addSharedBookmark,
    autoFlashcard,
    autoAddToList,
    defaultListId,
    flashcards,
    addFlashcard,
    removeFlashcard,
    addSharedFlashcard,
  } = usePDFStore()

  const [simplified, setSimplified] = useState<string | null>(null)
  const [isSimplifying, setIsSimplifying] = useState(false)
  const [showSimplified, setShowSimplified] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStateRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
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
        word: selectedWord.toLowerCase(),
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

  // Reset drag offset when a new word is selected
  useEffect(() => {
    historyAddedRef.current = false
    setDragOffset({ x: 0, y: 0 })
  }, [selectedWord, pdfFileName])

  const isBookmarked = selectedPageNumber && selectedWord
    ? bookmarks.some(
        (b) =>
          b.word.toLowerCase() === selectedWord.toLowerCase() &&
          b.pdfFileName === pdfFileName
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

  const [showListMenu, setShowListMenu] = useState(false)
  const [addingToList, setAddingToList] = useState(false)
  const wordLists = usePDFStore((s) => s.wordLists)
  const fetchLists = useCallback(async () => {
    try {
      const res = await authFetch('/api/word-lists')
      const data = await res.json()
      if (data.lists) usePDFStore.getState().setWordLists(data.lists)
    } catch {}
  }, [])
  const handleAddToList = useCallback(async (listId: string) => {
    if (!selectedWord || !explanation) return
    setAddingToList(true)
    try {
      await authFetch(`/api/word-lists/${listId}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: selectedWord,
          meaning: explanation.meaning,
          pronunciation: explanation.pronunciation,
          translation: explanation.translation,
          example: explanation.example,
          partOfSpeech: explanation.partOfSpeech,
        }),
      })
      fetchLists()
      setShowListMenu(false)
    } catch (err) {
      console.error('Failed to add word to list:', err)
    } finally {
      setAddingToList(false)
    }
  }, [selectedWord, explanation, fetchLists])

  const isFlashcardCreated = selectedWord && pdfFileName
    ? flashcards.some((f) => f.word.toLowerCase() === selectedWord.toLowerCase() && f.pdfFileName === pdfFileName)
    : false

  const handleToggleFlashcard = useCallback(async () => {
    if (!selectedWord || !explanation) return
    const word = selectedWord.trim().toLowerCase()
    if (isFlashcardCreated) {
      const flashcard = flashcards.find(
        (f) => f.word.toLowerCase() === word && f.pdfFileName === pdfFileName
      )
      if (flashcard) removeFlashcard(flashcard._id || flashcard.id || '')
      await authFetch(
        `/api/flashcards?word=${encodeURIComponent(word)}&pdfFileName=${encodeURIComponent(pdfFileName || '')}`,
        { method: 'DELETE' }
      ).catch(() => {})
    } else {
      const res = await authFetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          word,
          meaning: explanation.meaning,
          pronunciation: explanation.pronunciation || '',
          translation: explanation.translation || '',
          sentence: selectedSentence || '',
          pageNumber: selectedPageNumber || 1,
          pdfFileName: pdfFileName || 'unknown',
          partOfSpeech: explanation.partOfSpeech || undefined,
          example: explanation.example || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        addFlashcard(data.flashcard || { ...data, word, pdfFileName })
        const session = usePDFStore.getState().shareSession
        if (session) {
          const shareRes = await authFetch('/api/share/flashcards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: data.id, sessionId: session._id, word, pdfFileName }),
          })
          if (shareRes.ok) {
            const shared = await shareRes.json()
            addSharedFlashcard(shared)
          }
        }
      }
    }
  }, [selectedWord, explanation, selectedSentence, selectedPageNumber, pdfFileName, isFlashcardCreated, flashcards, removeFlashcard, addFlashcard, addSharedFlashcard])

  const handleBookmark = useCallback(() => {
    if (!selectedPageNumber || !explanation) return

    // Always store words in one (lowercase) form so the same word can't appear
    // both capitalized and lowercase across bookmarks/flashcards/vocabulary.
    const word = (selectedWord || '').trim().toLowerCase()

    if (isBookmarked) {
      const existing = bookmarks.find(
        (b) => b.word.toLowerCase() === word && b.pdfFileName === pdfFileName
      )
      if (existing) {
        removeBookmark(existing.id)
        authFetch(`/api/db/bookmarks?id=${existing.id}`, { method: 'DELETE' }).catch(() => {})
      }
      // Cascade delete: also remove the matching flashcard + vocabulary entry.
      const flashcard = flashcards.find(
        (f) => f.word.toLowerCase() === word && f.pdfFileName === pdfFileName
      )
      if (flashcard) {
        removeFlashcard(flashcard._id || flashcard.id || '')
        authFetch(
          `/api/flashcards?word=${encodeURIComponent(word)}&pdfFileName=${encodeURIComponent(pdfFileName || '')}`,
          { method: 'DELETE' }
        ).catch(() => {})
      }
      const st = usePDFStore.getState()
      if (st.autoAddToList && st.defaultListId) {
        authFetch(
          `/api/word-lists/${st.defaultListId}/words?word=${encodeURIComponent(word)}`,
          { method: 'DELETE' }
        ).catch(() => {})
        st.setWordLists(
          st.wordLists.map((l) =>
            l._id === st.defaultListId
              ? { ...l, words: l.words.filter((w) => w.word.toLowerCase() !== word) }
              : l
          )
        )
      }
      return
    }

    // Dedupe: don't insert the same word twice in bookmarks.
    if (
      bookmarks.some((b) => b.word.toLowerCase() === word && b.pdfFileName === pdfFileName)
    ) {
      return
    }

    const bookmark = {
      id: `bm-${Date.now()}`,
      pageNumber: selectedPageNumber,
      word,
      meaning: explanation.meaning,
      pronunciation: explanation.pronunciation,
      translation: explanation.translation,
      sentence: selectedSentence || '',
      timestamp: Date.now(),
      pdfFileName: pdfFileName || 'unknown',
      partOfSpeech: explanation.partOfSpeech || undefined,
      example: explanation.example || undefined,
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

    // Auto-create flashcard (only if setting enabled)
    if (autoFlashcard) {
      authFetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          word,
          meaning: explanation.meaning,
          pronunciation: explanation.pronunciation || '',
          translation: explanation.translation || '',
          sentence: selectedSentence || '',
          pageNumber: selectedPageNumber || 1,
          pdfFileName: pdfFileName || 'unknown',
          partOfSpeech: explanation.partOfSpeech || undefined,
          example: explanation.example || undefined,
        }),
      }).then(async (res) => {
        const data = await res.json()
        if (data.success) {
          const currentSession = usePDFStore.getState().shareSession
          if (currentSession) {
            const shareRes = await authFetch('/api/share/flashcards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: data.id,
                sessionId: currentSession._id,
                word,
                meaning: explanation.meaning,
                pronunciation: explanation.pronunciation || '',
                translation: explanation.translation || '',
                sentence: selectedSentence || '',
                pageNumber: selectedPageNumber || 1,
                pdfFileName: pdfFileName || 'unknown',
                partOfSpeech: explanation.partOfSpeech || undefined,
                example: explanation.example || undefined,
              }),
            })
            if (shareRes.ok) {
              const shared = await shareRes.json()
              usePDFStore.getState().addSharedFlashcard(shared)
            }
          }
        }
      }).catch(() => {})
    }

    // Auto-add to default list (if setting enabled + default list is set)
    if (autoAddToList && defaultListId) {
      authFetch(`/api/word-lists/${defaultListId}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          meaning: explanation.meaning,
          pronunciation: explanation.pronunciation,
          translation: explanation.translation,
          example: explanation.example,
          partOfSpeech: explanation.partOfSpeech,
        }),
      }).catch(() => {})
      usePDFStore.getState().setWordLists(
        usePDFStore.getState().wordLists.map((l) =>
          l._id === defaultListId && !l.words.some((w) => w.word.toLowerCase() === word)
            ? { ...l, words: [...l.words, { word, meaning: explanation.meaning, addedAt: new Date().toISOString() }] }
            : l
        )
      )
    }
  }, [selectedPageNumber, explanation, selectedWord, selectedSentence, addBookmark, removeBookmark, removeFlashcard, bookmarks, flashcards, isBookmarked, pdfFileName, autoFlashcard, autoAddToList, defaultListId])

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

  // UX fix (U7): focus management for the popup. When it opens, focus moves
  // into the dialog; Tab is trapped within; Escape closes; focus restores to
  // the trigger on close. Previously keyboard users had to Tab through all
  // underlying content to reach the popup.
  const popupRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!selectedWord) return
    previousFocusRef.current = document.activeElement as HTMLElement
    const popup = document.querySelector('[data-popup][role="dialog"]') as HTMLElement | null
    popup?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection()
        return
      }
      if (e.key !== 'Tab') return
      const root = document.querySelector('[data-popup][role="dialog"]') as HTMLElement | null
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      previousFocusRef.current?.focus?.()
    }
  }, [selectedWord, clearSelection])

  if (!selectedWord || !popupPosition) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const isMobile = vw < 640
  const popupWidth = isMobile ? Math.min(380, vw - 24) : 400
  const popupHeight = 360

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
    <div className="flex max-h-[75vh] flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
      {/* Slim header: grip (desktop) + bookmark + close */}
      <div
        onMouseDown={isMobile ? undefined : handleHeaderMouseDown}
        onTouchStart={isMobile ? undefined : handleHeaderTouchStart}
        className={`shrink-0 flex items-center justify-between px-3 pt-2.5 pb-0 select-none ${
          isMobile ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {!isMobile && <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />}
        {isMobile && <div />}
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
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (isQuoteSaved) setShowQuotes(true)
              clearSelection()
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content (scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 pt-1.5 pb-2 popup-scrollbar">
        {isExplaining ? (
          <div className="flex items-center gap-2 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            <span className="text-sm text-muted-foreground">
              Analyzing context...
            </span>
          </div>
        ) : explanation ? (
          <div className="space-y-3">
            {/* WORD HERO */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  className="font-serif text-xl font-bold leading-tight text-foreground break-words"
                  title={selectedWord || ''}
                >
                  {selectedWord}
                </h3>
                {explanation.pronunciation && (
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs italic text-muted-foreground/70">
                      {explanation.pronunciation}
                    </span>
                    <button
                      onClick={() => {
                        const u = new SpeechSynthesisUtterance(selectedWord)
                        u.lang = accent
                        u.rate = 0.85
                        speechSynthesis.cancel()
                        speechSynthesis.speak(u)
                      }}
                      className="text-emerald-500 hover:text-emerald-600 transition-colors shrink-0"
                      title="Hear pronunciation"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {explanation.partOfSpeech && (
                <span className="shrink-0 self-start rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                  {explanation.partOfSpeech}
                </span>
              )}
            </div>

            {/* MEANING */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {isOfflineResult ? 'Dictionary Meaning' : 'Meaning'}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-foreground">
                {explanation.meaning}
              </p>
              {isOfflineResult && !explanation.translation && selectedSentence && !isExplaining && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1.5 h-7 gap-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  onClick={handleGetAIContext}
                >
                  <Sparkles className="h-3 w-3" />
                  Get AI Context
                </Button>
              )}
            </div>

            {/* AI-GENERATED EXAMPLE */}
            {explanation.example && (
              <div className="border-l-2 border-muted-foreground/15 pl-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Example
                </p>
                <p className="mt-0.5 text-sm italic leading-relaxed text-foreground/80">
                  {(() => {
                    const word = selectedWord || ''
                    const ex = explanation.example || ''
                    if (!word) return ex
                    const idx = ex.toLowerCase().indexOf(word.toLowerCase())
                    if (idx === -1) return ex
                    return (
                      <>
                        {ex.slice(0, idx)}
                        <strong className="font-semibold not-italic text-foreground">{ex.slice(idx, idx + word.length)}</strong>
                        {ex.slice(idx + word.length)}
                      </>
                    )
                  })()}
                </p>
              </div>
            )}

            {/* TRANSLATION */}
            {explanation.translation && (
              <div className="rounded-lg bg-emerald-50/70 p-2.5 dark:bg-emerald-950/15">
                <div className="flex items-center gap-1.5">
                  <Languages className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {LANGUAGE_LABELS[translationLanguage]}
                  </p>
                </div>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {explanation.translation}
                </p>
              </div>
            )}

            {/* SIMPLIFIED SENTENCE */}
            {selectedSentence && (
              <div>
                {!showSimplified ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-1.5"
                    onClick={handleSimplify}
                  >
                    <Sparkles className="h-3 w-3" />
                    Simplify this sentence
                  </Button>
                ) : isSimplifying ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                    <span className="text-xs text-muted-foreground">Simplifying...</span>
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Simplified
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-foreground">
                      {simplified}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            No explanation available
          </p>
        )}
      </div>

      {/* Fixed bottom action bar */}
      {selectedPageNumber && explanation && !isExplaining && (
        <div className="shrink-0 flex items-center justify-between border-t border-border/50 px-3 py-2 bg-background">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 gap-1.5 text-[11px] ${
                isFlashcardCreated
                  ? 'text-violet-600 hover:text-violet-700'
                  : 'text-muted-foreground hover:text-violet-600'
              }`}
              onClick={handleToggleFlashcard}
            >
              <Brain className={`h-3 w-3 ${isFlashcardCreated ? 'fill-violet-500' : ''}`} />
              {isFlashcardCreated ? 'Flashcard' : 'Flashcard'}
            </Button>
            {quoteText && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 gap-1.5 text-[11px] ${
                  isQuoteSaved
                    ? 'text-yellow-600 hover:text-yellow-700'
                    : 'text-muted-foreground hover:text-yellow-600'
                }`}
                onClick={handleSaveQuote}
                disabled={quoteStatus === 'saving'}
              >
                <QuoteIcon className={`h-3 w-3 ${isQuoteSaved ? 'fill-yellow-500' : ''}`} />
                {isQuoteSaved ? 'Saved' : 'Quote'}
              </Button>
            )}
          </div>
          <div className="relative flex items-center gap-1.5">
            {wordLists.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-emerald-600"
                onClick={() => { fetchLists(); setShowListMenu(!showListMenu) }}
              >
                <ListPlus className="h-3 w-3" />
                List
              </Button>
            )}
            {showListMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-48 rounded-lg border bg-popover p-1 shadow-lg z-50">
                {wordLists.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">No lists yet</p>
                ) : (
                  wordLists.map((l) => (
                    <button
                      key={l._id}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-accent"
                      onClick={() => handleAddToList(l._id)}
                      disabled={addingToList}
                    >
                      {addingToList ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ListPlus className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="truncate">{l.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mr-0.5">
              Highlight
            </span>
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleHighlightFromPopup(color.value)}
                className={`h-4.5 w-4.5 rounded-full ${color.tailwind} transition-all hover:scale-125 border border-border shadow-sm active:scale-95`}
                title={`Highlight as ${color.label}`}
              />
            ))}
          </div>
        </div>
      )}
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
          role="dialog"
          aria-modal="true"
          aria-label={`Meaning of ${selectedWord}`}
          tabIndex={-1}
          className="fixed bottom-0 left-0 right-0 z-50 focus:outline-none"
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
          role="dialog"
          aria-modal="true"
          aria-label={`Meaning of ${selectedWord}`}
          tabIndex={-1}
          className="fixed z-50 focus:outline-none"
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
