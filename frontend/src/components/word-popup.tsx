'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Volume2, Loader2, Sparkles, Languages, Bookmark, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePDFStore, LANGUAGE_LABELS } from '@/store/use-pdf-store'

export function WordPopup() {
  const {
    selectedWord,
    explanation,
    isExplaining,
    popupPosition,
    clearSelection,
    translationLanguage,
    selectedSentence,
    selectedPageNumber,
    pdfFileName,
    addToHistory,
    addBookmark,
    removeBookmark,
    bookmarks,
  } = usePDFStore()

  const [simplified, setSimplified] = useState<string | null>(null)
  const [isSimplifying, setIsSimplifying] = useState(false)
  const [showSimplified, setShowSimplified] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const historyAddedRef = useRef(false)

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
      fetch('/api/db/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {})
    }
  }, [explanation, selectedWord, selectedSentence, selectedPageNumber, isExplaining, addToHistory, pdfFileName])

  // Reset history flag and drag offset when word changes
  useEffect(() => {
    historyAddedRef.current = false
    setDragOffset({ x: 0, y: 0 })
  }, [selectedWord])

  const isBookmarked = selectedPageNumber && selectedWord
    ? bookmarks.some(
        (b) => b.pageNumber === selectedPageNumber && b.word === selectedWord
      )
    : false

  const handleBookmark = useCallback(() => {
    if (!selectedPageNumber || !explanation) return

    if (isBookmarked) {
      const existing = bookmarks.find(
        (b) => b.pageNumber === selectedPageNumber && b.word === selectedWord
      )
      if (existing) {
        removeBookmark(existing.id)
        fetch(`/api/db/bookmarks?id=${existing.id}`, { method: 'DELETE' }).catch(() => {})
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
    // Sync to MongoDB
    fetch('/api/db/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookmark),
    }).catch(() => {})
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
                      utterance.lang = 'en-US'
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
                    Contextual Meaning
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {explanation.meaning}
                  </p>
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
