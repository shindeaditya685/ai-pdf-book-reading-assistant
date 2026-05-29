'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bookmark, Trash2, BookOpen, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePDFStore } from '@/store/use-pdf-store'

export function BookmarksPanel() {
  const {
    bookmarks,
    showBookmarks,
    setShowBookmarks,
    removeBookmark,
    setCurrentPage,
    pdfFileName,
  } = usePDFStore()

  const handleGoToPage = useCallback(
    (page: number) => {
      setCurrentPage(page)
      setShowBookmarks(false)
    },
    [setCurrentPage, setShowBookmarks]
  )

  const handleExport = useCallback(() => {
    if (bookmarks.length === 0) return
    const content = bookmarks
      .map(
        (bm, i) =>
          `${i + 1}. Word: ${bm.word}\n   Meaning: ${bm.meaning}\n   Pronunciation: ${bm.pronunciation}\n   Translation: ${bm.translation}\n   Sentence: "${bm.sentence}"\n   Page: ${bm.pageNumber}\n   Date: ${new Date(bm.timestamp).toLocaleString()}\n`
      )
      .join('\n---\n\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pdfFileName || 'bookmarks'}-bookmarks.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [bookmarks, pdfFileName])

  if (!showBookmarks) return null

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
            <Bookmark className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">
              Bookmarks
            </h2>
            <span className="text-[10px] text-muted-foreground">
              ({bookmarks.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            {bookmarks.length > 0 && (
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
              onClick={() => setShowBookmarks(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {bookmarks.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No bookmarks yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Bookmark pages to quickly jump back to them
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {[...bookmarks]
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((bm) => (
                  <div
                    key={bm.id}
                    className="group relative px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between">
                      <button
                        className="flex-1 text-left"
                        onClick={() => handleGoToPage(bm.pageNumber)}
                      >
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {bm.word}
                        </span>
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          Page {bm.pageNumber}
                        </span>
                        {bm.pronunciation && (
                          <span className="ml-2 text-[10px] italic text-muted-foreground">
                            {bm.pronunciation}
                          </span>
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                        onClick={() => removeBookmark(bm.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {bm.meaning}
                    </p>
                    {bm.translation && (
                      <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                        {bm.translation}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
