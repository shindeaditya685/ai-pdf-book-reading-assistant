'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, BookOpen, Clock, Volume2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePDFStore } from '@/store/use-pdf-store'

export function HistoryPanel() {
  const {
    wordHistory,
    showHistory,
    setShowHistory,
    clearHistory,
    removeHistoryEntry,
    setSelectedWord,
    setSelectedSentence,
    setSelectedPageNumber,
    setPopupPosition,
    setExplanation,
    setIsExplaining,
    setCurrentPage,
    pdfFileName,
  } = usePDFStore()

  const handleRestore = useCallback(
    (entry: (typeof wordHistory)[0]) => {
      setSelectedWord(entry.word)
      setSelectedSentence(entry.sentence)
      setSelectedPageNumber(entry.pageNumber)
      setPopupPosition({ x: window.innerWidth / 2, y: 150 })
      setExplanation({
        word: entry.word,
        meaning: entry.meaning,
        pronunciation: entry.pronunciation,
        translation: entry.translation,
      })
      setIsExplaining(false)
      setCurrentPage(entry.pageNumber)
    },
    [
      setSelectedWord,
      setSelectedSentence,
      setSelectedPageNumber,
      setPopupPosition,
      setExplanation,
      setIsExplaining,
      setCurrentPage,
    ]
  )

  const handleExport = useCallback(() => {
    if (wordHistory.length === 0) return
    const content = wordHistory
      .map(
        (e, i) =>
          `${i + 1}. Word: ${e.word}\n   Meaning: ${e.meaning}\n   Pronunciation: ${e.pronunciation}\n   Translation: ${e.translation}\n   Sentence: "${e.sentence}"\n   Page: ${e.pageNumber}\n   Date: ${new Date(e.timestamp).toLocaleString()}\n`
      )
      .join('\n---\n\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pdfFileName || 'notes'}-vocabulary.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [wordHistory, pdfFileName])

  if (!showHistory) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 320 }}
        animate={{ x: 0 }}
        exit={{ x: 320 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-foreground">
              Word History
            </h2>
            <span className="text-[10px] text-muted-foreground">
              ({wordHistory.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            {wordHistory.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleExport}
                title="Export as text file"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowHistory(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {wordHistory.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No words looked up yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Click any word in the PDF to see its explanation here
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {wordHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="group relative px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between">
                    <button
                      className="flex-1 text-left"
                      onClick={() => handleRestore(entry)}
                    >
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {entry.word}
                      </span>
                      {entry.pronunciation && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          <Volume2 className="mr-0.5 inline h-2.5 w-2.5" />
                          {entry.pronunciation}
                        </span>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                      onClick={() => removeHistoryEntry(entry.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {entry.meaning}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                    <span>
                      Page {entry.pageNumber}
                    </span>
                    {entry.translation && (
                      <span>{entry.translation}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {wordHistory.length > 0 && (
          <div className="border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs text-muted-foreground hover:text-red-500"
              onClick={clearHistory}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear all history
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
