'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Volume2, Loader2, Sparkles, Languages, Bookmark, Brain, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePDFStore, LANGUAGE_LABELS } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'

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

  // Reset state and check for existing flashcard when word changes
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

  const handleSimplify = useCallback(async () => {
    if (!selectedSentence) return
    setIsSimplifying(true)
    setSimplified(null)
    setShowSimplified(true)

    try {
      const res = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: selectedSentence,
          translationLanguage,
        }),
      })
      const data = await res.json()
      setSimplified(data.simplified || 'Could not simplify')
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
      const res = await fetch('/api/explain', {
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
      if (data.error) {
        setExplanation({ word: selectedWord, meaning: data.error, pronunciation: '', translation: '' })
      } else {
        setExplanation(data)
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

  if (!selectedWord || !popupPosition) return null

  // Calculate popup position - viewport-relative
  const popupWidth = 320
  const popupHeight = 300
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  let popupX = popupPosition.x - popupWidth / 2
  let popupY = popupPosition.y

  // Clamp X to viewport
  popupX = Math.max(12, Math.min(popupX, vw - popupWidth - 12))

  // Determine if popup should show above or below based on available space
  const spaceAbove = popupY
  const spaceBelow = vh - popupY
  const showAbove = spaceAbove > spaceBelow && spaceAbove > popupHeight

  // Position top/bottom edge (no CSS transform, to avoid conflict with drag)
  const popupTop = showAbove
    ? Math.max(8, popupY - popupHeight)
    : Math.min(popupY + 20, vh - 60)

  const clampedTop = popupTop + dragOffset.y
  const clampedLeft = popupX + dragOffset.x

  return (
    <AnimatePresence>
      <motion.div
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
        drag
        dragMomentum={false}
        onDragEnd={(_, info) =>
          setDragOffset((prev) => ({
            x: prev.x + info.offset.x,
            y: prev.y + info.offset.y,
          }))
        }
      >
        <div className="rounded-xl border border-border bg-background shadow-2xl">
          {/* Header - drag handle */}
          <div className="flex items-start justify-between border-b px-3 pt-3 pb-2 cursor-grab active:cursor-grabbing select-none">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              <h3 className="text-base font-bold text-foreground">
                {selectedWord}
              </h3>
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
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={clearSelection}
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
                {/* Meaning */}
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

                {/* Translation */}
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

                {/* Simplify sentence */}
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

                {/* Highlight Options */}
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

                {/* Flashcard */}
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

        {/* Arrow */}
        <div className="flex justify-center">
          {showAbove ? (
            <div className="h-0 w-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-border" />
          ) : (
            <div className="h-0 w-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-border" />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
