'use client'

import { useCallback, useState } from 'react'
import { X, Bookmark, Trash2, BookOpen, Download, Plus, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
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
          iconClassName="text-amber-500"
          title="Bookmarks"
          badge={
            <span className="text-[10px] text-muted-foreground">
              ({shareSession ? bookmarks.length + sharedBookmarks.length : bookmarks.length})
            </span>
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
        <div className="mx-4 mt-3 flex gap-0.5 rounded-lg bg-muted/40 p-0.5">
          <button
            onClick={() => setSubTab('personal')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'personal' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            My Bookmarks ({bookmarks.length})
          </button>
          <button
            onClick={() => setSubTab('shared')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              subTab === 'shared' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Session ({sharedBookmarks.length})
          </button>
        </div>
      )}

      {(!shareSession || subTab === 'personal') ? (
        bookmarks.length === 0 ? (
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
              .filter((b) => !pdfFileName || b.pdfFileName === pdfFileName)
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((bm) => (
                <div
                  key={bm.id}
                  className="group relative px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between">
                    <button
                      className="flex-1 text-left"
                      onClick={() => {
                        handleGoToPage(bm.pageNumber)
                        handleOpenWordPopup(bm)
                      }}
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
                      onClick={() => handleDeleteBookmark(bm.id)}
                      aria-label="Delete bookmark"
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
        )
      ) : (
        sharedBookmarks.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                No session bookmarks yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Bookmarks added by group members will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
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
                    className="group relative px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => {
                          handleGoToPage(bm.pageNumber)
                          handleOpenWordPopup(bm)
                        }}
                      >
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                          {bm.word}
                        </span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Page {bm.pageNumber} {bm.pronunciation && `· ${bm.pronunciation}`}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: authorColor }} />
                          <span style={{ color: authorColor }} className="font-semibold">
                            {bm.author} {bm.author === user?.username && '(you)'}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {inPersonalBookmarks ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
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
                            className="h-6 w-6 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteSharedBookmark(bm.bookmarkId)}
                            aria-label="Delete shared bookmark"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {bm.meaning && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {bm.meaning}
                      </p>
                    )}
                    {bm.translation && (
                      <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                        {bm.translation}
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
