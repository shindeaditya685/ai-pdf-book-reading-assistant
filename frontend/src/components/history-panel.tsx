'use client'

import { useCallback } from 'react'
import { Trash2, Clock, Volume2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { CountBadge, EmptyState } from '@/components/panel-primitives'
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

  return (
    <ResponsivePanel
      open={showHistory}
      onClose={() => setShowHistory(false)}
      ariaLabel="Word history"
      header={
        <PanelHeader
          icon={Clock}
          eyebrow="Looked up while reading"
          title="Word History"
          badge={<CountBadge count={wordHistory.length} />}
          actions={
            wordHistory.length > 0 ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleExport}
                title="Export as text file"
                aria-label="Export as text file"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            ) : null
          }
          onClose={() => setShowHistory(false)}
        />
      }
      footer={
        wordHistory.length > 0 ? (
          <div className="border-t border-border/40 p-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs text-muted-foreground hover:text-destructive"
              onClick={clearHistory}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear all history
            </Button>
          </div>
        ) : null
      }
    >
      {wordHistory.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Clock}
            title="No words looked up yet"
            hint="Tap any word in the PDF and it will be remembered here."
          />
        </div>
      ) : (
        <div className="space-y-2.5 p-4">
          {wordHistory.map((entry) => (
            <div
              key={entry.id}
              className="group relative rounded-xl border border-border/60 bg-card/60 p-3 transition-colors hover:border-brand/25 hover:bg-card"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => handleRestore(entry)}
                >
                  <span className="block truncate font-serif text-[17px] font-semibold leading-tight text-brand">
                    {entry.word}
                  </span>
                  {entry.pronunciation && (
                    <span className="mt-1 block text-[10px] italic text-muted-foreground/60">
                      <Volume2 className="mr-0.5 inline h-2.5 w-2.5" />
                      {entry.pronunciation}
                    </span>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  onClick={() => removeHistoryEntry(entry.id)}
                  aria-label="Delete history entry"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {entry.meaning}
              </p>
              <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                <span>p.{entry.pageNumber}</span>
                {entry.translation && <span className="text-muted-foreground/70">→ {entry.translation}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </ResponsivePanel>
  )
}
