'use client'

import { useCallback, useState } from 'react'
import { X, Bookmark, Trash2, Download, Plus, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { CountBadge, EmptyState, PillTabs, SectionLabel, MemberAvatar } from '@/components/panel-primitives'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/auth-context'

export function BookmarksPanel() {
  const {
    bookmarks,
    showBookmarks,
    setShowBookmarks,
    removeBookmark,
    setCurrentPage,
    pdfFileName,
    shareSession,
    sharedBookmarks,
    removeSharedBookmark,
    addBookmark,
    flashcards,
    removeFlashcard,
    autoAddToList,
    defaultListId,
    setSelectedWord,
    setSelectedSentence,
    setSelectedPageNumber,
    setPopupPosition,
    setExplanation,
    setIsExplaining,
    setIsOfflineResult,
  } = usePDFStore()

  const { user } = useAuth()
  const [subTab, setSubTab] = useState<'personal' | 'shared'>('personal')
  const [importingBookmarkId, setImportingBookmarkId] = useState<string | null>(null)

  const handleGoToPage = useCallback(
    (page: number) => {
      setCurrentPage(page)
      setShowBookmarks(false)
    },
    [setCurrentPage, setShowBookmarks]
  )

  const handleDeleteBookmark = useCallback(async (id: string) => {
    const bookmark = bookmarks.find((b) => b.id === id)
    removeBookmark(id)
    try {
      await authFetch(`/api/db/bookmarks?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (shareSession) {
        await authFetch(`/api/share/bookmarks?id=${encodeURIComponent(id)}&sessionId=${encodeURIComponent(shareSession._id)}`, { method: 'DELETE' })
        removeSharedBookmark(id)
      }
    } catch (err) {
      console.error('Failed to delete bookmark:', err)
    }
    // Cascade delete: removing a bookmark also removes its flashcard + the
    // word from the default vocabulary list.
    if (bookmark) {
      const word = bookmark.word.trim().toLowerCase()
      const flashcard = flashcards.find(
        (f) => f.word.toLowerCase() === word && f.pdfFileName === bookmark.pdfFileName
      )
      if (flashcard) {
        removeFlashcard(flashcard._id || flashcard.id || '')
        authFetch(
          `/api/flashcards?word=${encodeURIComponent(word)}&pdfFileName=${encodeURIComponent(bookmark.pdfFileName)}`,
          { method: 'DELETE' }
        ).catch(() => {})
      }
      if (autoAddToList && defaultListId) {
        authFetch(
          `/api/word-lists/${defaultListId}/words?word=${encodeURIComponent(word)}`,
          { method: 'DELETE' }
        ).catch(() => {})
        usePDFStore.getState().setWordLists(
          usePDFStore.getState().wordLists.map((l) =>
            l._id === defaultListId
              ? { ...l, words: l.words.filter((w) => w.word.toLowerCase() !== word) }
              : l
          )
        )
      }
    }
  }, [bookmarks, flashcards, removeBookmark, removeFlashcard, shareSession, removeSharedBookmark, autoAddToList, defaultListId])

  const handleDeleteSharedBookmark = useCallback(async (bookmarkId: string) => {
    if (!shareSession) return
    try {
      await authFetch(`/api/share/bookmarks?id=${encodeURIComponent(bookmarkId)}&sessionId=${encodeURIComponent(shareSession._id)}`, { method: 'DELETE' })
      removeSharedBookmark(bookmarkId)
    } catch (err) {
      console.error('Failed to delete shared bookmark:', err)
    }
  }, [shareSession, removeSharedBookmark])

  const handleImportBookmark = useCallback(async (bm: any) => {
    if (!pdfFileName) return
    setImportingBookmarkId(bm.bookmarkId)
    try {
      const res = await authFetch('/api/db/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: bm.word,
          meaning: bm.meaning || '',
          pronunciation: bm.pronunciation || '',
          translation: bm.translation || '',
          sentence: bm.sentence || '',
          pageNumber: bm.pageNumber || 0,
          pdfFileName,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const newPersonalBookmark = {
          id: data.id,
          pageNumber: bm.pageNumber || 0,
          word: bm.word,
          meaning: bm.meaning || '',
          pronunciation: bm.pronunciation || '',
          translation: bm.translation || '',
          sentence: bm.sentence || '',
          timestamp: Date.now(),
          pdfFileName,
        }
        addBookmark(newPersonalBookmark)
      }
    } catch (err) {
      console.error('Failed to import bookmark:', err)
    } finally {
      setImportingBookmarkId(null)
    }
  }, [pdfFileName, addBookmark])

  const handleOpenWordPopup = useCallback((bm: { word: string; meaning: string; pronunciation: string; translation: string; sentence: string; pageNumber: number; example?: string; partOfSpeech?: string }) => {
    setSelectedWord(bm.word)
    setSelectedSentence(bm.sentence || null)
    setSelectedPageNumber(bm.pageNumber)
    setPopupPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    setExplanation({
      word: bm.word,
      meaning: bm.meaning,
      pronunciation: bm.pronunciation || '',
      translation: bm.translation || '',
      example: bm.example || undefined,
      partOfSpeech: bm.partOfSpeech || undefined,
    })
    setIsExplaining(false)
    setIsOfflineResult(false)
  }, [setSelectedWord, setSelectedSentence, setSelectedPageNumber, setPopupPosition, setExplanation, setIsExplaining, setIsOfflineResult])

  const handleExport = useCallback(() => {
    if (bookmarks.length === 0) return
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
    const csvHeader = 'Front,Back,Meaning,Pronunciation,Translation,Sentence,Page,Tags\n'
    const csvRows = bookmarks
      .map((bm) =>
        [
          esc(bm.word),
          esc(`Meaning: ${bm.meaning}\nPronunciation: ${bm.pronunciation || '-'}\nTranslation: ${bm.translation || '-'}\nSentence: ${bm.sentence}`),
          esc(bm.meaning),
          esc(bm.pronunciation || ''),
          esc(bm.translation || ''),
          esc(bm.sentence),
          bm.pageNumber,
          esc(pdfFileName || ''),
        ].join(',')
      )
      .join('\n')
    const csvContent = csvHeader + csvRows

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pdfFileName || 'bookmarks'}-flashcards.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [bookmarks, pdfFileName])

  return (
    <ResponsivePanel
      open={showBookmarks}
      onClose={() => setShowBookmarks(false)}
      ariaLabel="Bookmarks"
      header={
        <PanelHeader
          icon={Bookmark}
          eyebrow="From the page"
          title="Saved Words"
          badge={
            <CountBadge
              count={shareSession ? bookmarks.length + sharedBookmarks.length : bookmarks.length}
            />
          }
          actions={
            bookmarks.length > 0 ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleExport}
                title="Export as Anki CSV"
                aria-label="Export as Anki CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            ) : null
          }
          onClose={() => setShowBookmarks(false)}
        />
      }
    >
      {shareSession && (
        <div className="px-4 pt-3">
          <PillTabs
            value={subTab}
            onChange={(v) => setSubTab(v as 'personal' | 'shared')}
            tabs={[
              { value: 'personal', label: 'Mine', count: bookmarks.length },
              { value: 'shared', label: 'Circle', count: sharedBookmarks.length },
            ]}
          />
        </div>
      )}

      {(!shareSession || subTab === 'personal') ? (
        bookmarks.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Bookmark}
              title="No saved words yet"
              hint="Bookmark a word in the reader to keep it here for review."
            />
          </div>
        ) : (
          <div className="space-y-2.5 p-4">
            {[...bookmarks]
              .filter((b) => !pdfFileName || b.pdfFileName === pdfFileName)
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((bm) => (
                <div
                  key={bm.id}
                  className="group relative rounded-xl border border-border/60 bg-card/60 p-3 transition-colors hover:border-brand/25 hover:bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        handleGoToPage(bm.pageNumber)
                        handleOpenWordPopup(bm)
                      }}
                    >
                      <span className="block truncate font-serif text-[17px] font-semibold leading-tight text-brand">
                        {bm.word}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                        <span>p.{bm.pageNumber}</span>
                        {bm.pronunciation && (
                          <span className="font-sans italic text-muted-foreground/60">
                            / {bm.pronunciation}
                          </span>
                        )}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      onClick={() => handleDeleteBookmark(bm.id)}
                      aria-label="Delete bookmark"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {bm.meaning && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {bm.meaning}
                    </p>
                  )}
                  {bm.translation && (
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground/70">
                      → {bm.translation}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )
      ) : (
        sharedBookmarks.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Bookmark}
              title="Nothing from the circle yet"
              hint="Words your group saves will appear here with their reader's ink."
            />
          </div>
        ) : (
          <div className="space-y-2.5 p-4">
            {[...sharedBookmarks]
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .map((bm) => {
                const member = shareSession?.members.find((m) => m.username === bm.author)
                const authorColor = member?.color || '#3B82F6'
                const inPersonalBookmarks = bookmarks.some((b) => b.word.toLowerCase() === bm.word.toLowerCase())
                const isImporting = importingBookmarkId === bm.bookmarkId

                return (
                  <div
                    key={bm.bookmarkId}
                    className="group relative rounded-xl border border-border/60 bg-card/60 p-3"
                    style={{ borderLeft: `3px solid ${authorColor}` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          handleGoToPage(bm.pageNumber)
                          handleOpenWordPopup(bm)
                        }}
                      >
                        <span className="block truncate font-serif text-[17px] font-semibold leading-tight" style={{ color: authorColor }}>
                          {bm.word}
                        </span>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                          <span className="font-mono tabular-nums">p.{bm.pageNumber}</span>
                          {bm.pronunciation && (
                            <span className="italic text-muted-foreground/60">{bm.pronunciation}</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                          <MemberAvatar name={bm.author} color={authorColor} size={15} />
                          <span className="font-semibold" style={{ color: authorColor }}>
                            {bm.author} {bm.author === user?.username && '(you)'}
                          </span>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        {inPersonalBookmarks ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                            <Check className="h-2.5 w-2.5" />
                            Saved
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 gap-1 px-2 text-[9px] font-bold"
                            onClick={() => handleImportBookmark(bm)}
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

                        {bm.author === user?.username && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                            onClick={() => handleDeleteSharedBookmark(bm.bookmarkId)}
                            aria-label="Delete shared bookmark"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {bm.meaning && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {bm.meaning}
                      </p>
                    )}
                    {bm.translation && (
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground/70">
                        → {bm.translation}
                      </p>
                    )}
                  </div>
                )
              })}
          </div>
        )
      )}
    </ResponsivePanel>
  )
}
