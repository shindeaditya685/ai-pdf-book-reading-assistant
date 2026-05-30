'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowRight, Bookmark, BookOpen, Brain, Clock, Sparkles, FileText, LogOut, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { UploadZone } from '@/components/upload-zone'
import { WordPopup } from '@/components/word-popup'
import { SettingsPanel } from '@/components/settings-panel'
import { HistoryPanel } from '@/components/history-panel'
import { BookmarksPanel } from '@/components/bookmarks-panel'
import { ErrorBoundary } from '@/components/error-boundary'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { getActiveBook, getStoredBookPage, setActiveBook, setStoredBookPage } from '@/lib/reading-progress'

// Dynamically import PDFViewer to avoid loading pdfjs-dist in the initial bundle
const PDFViewer = dynamic(
  () => import('@/components/pdf-viewer').then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-emerald-500" />
          <p className="text-sm text-muted-foreground">Loading PDF engine...</p>
        </div>
      </div>
    ),
  }
)

const formatRecentDate = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))

export default function Home() {
  const {
    pdfDataUrl,
    pdfFileName,
    clearSelection,
    toggleSearch,
    toggleHistory,
    toggleBookmarks,
    goToNextSearchResult,
    goToPrevSearchResult,
    showSearch,
    showHistory,
    showBookmarks,
    setShowHistory,
    setShowBookmarks,
    setShowSearch,
    recentPdfs,
    wordHistory,
    bookmarks,
    addToHistory,
    addBookmark,
    addRecentPdf,
    setPdfDataUrl,
    setPdfFileName,
    setCurrentPage,
    setOcrText,
    clearOcrText,
  } = usePDFStore()

  const { user, logout } = useAuth()
  const [recentLoading, setRecentLoading] = useState<string | null>(null)

  const dataLoadedRef = useRef<string | null>(null)
  const recentLoadedRef = useRef<string | null>(null)

  // Load a recent PDF from MongoDB
  const handleLoadRecentPdf = useCallback(
    async (fileName: string, preferredPage?: number | null) => {
      setRecentLoading(fileName)
      try {
        const res = await authFetch(`/api/db/pdf?fileName=${encodeURIComponent(fileName)}`)
        if (!res.ok) return

        const pdf = await res.json()
        if (pdf?.content) {
          const existingMeta = usePDFStore
            .getState()
            .recentPdfs.find((item) => item.fileName === fileName)
          const restoredPage =
            preferredPage ||
            pdf.lastPage ||
            existingMeta?.lastPage ||
            getStoredBookPage(user?.username, fileName) ||
            1

          clearOcrText()
          setCurrentPage(Math.max(1, Number(restoredPage) || 1))
          setPdfFileName(fileName)
          setPdfDataUrl(pdf.content)
          addRecentPdf({
            fileName,
            timestamp: Date.now(),
            pageCount: pdf.pageCount || existingMeta?.pageCount || 0,
            lastPage: Math.max(1, Number(restoredPage) || 1),
            wordCount: existingMeta?.wordCount,
            bookmarkCount: existingMeta?.bookmarkCount,
          })
          setActiveBook(user?.username, fileName)
          setStoredBookPage(user?.username, fileName, Math.max(1, Number(restoredPage) || 1))

          // Restore OCR data if available
          if (pdf.ocrText) {
            for (const [page, data] of Object.entries(pdf.ocrText)) {
              setOcrText(Number(page), data as any)
            }
          }
        }
      } catch {
        // Not available
      } finally {
        setRecentLoading(null)
      }
    },
    [
      addRecentPdf,
      clearOcrText,
      setCurrentPage,
      setPdfDataUrl,
      setPdfFileName,
      setOcrText,
      user?.username,
    ]
  )

  // Load recent PDFs from MongoDB on mount
  useEffect(() => {
    if (!user?.username || recentLoadedRef.current === user.username) return
    recentLoadedRef.current = user.username

    const loadRecentPdfs = async () => {
      try {
        const res = await authFetch('/api/db/pdf')
        const pdfs: any[] = await res.json()
        if (Array.isArray(pdfs)) {
          pdfs.forEach((p) => {
            const lastPage = p.lastPage || getStoredBookPage(user.username, p.fileName) || 1
            addRecentPdf({
              fileName: p.fileName,
              timestamp: new Date(p.updatedAt || p.createdAt).getTime(),
              pageCount: p.pageCount || 0,
              lastPage,
              wordCount: p.wordCount || 0,
              bookmarkCount: p.bookmarkCount || 0,
            })
          })

          const activeBook = getActiveBook(user.username)
          if (!pdfDataUrl && activeBook && pdfs.some((p) => p.fileName === activeBook)) {
            const activeMeta = pdfs.find((p) => p.fileName === activeBook)
            await handleLoadRecentPdf(
              activeBook,
              activeMeta?.lastPage || getStoredBookPage(user.username, activeBook)
            )
          }
        }
      } catch {
        // Recent books are a convenience layer; the reader still works without them.
      }
    }

    loadRecentPdfs()
  }, [addRecentPdf, handleLoadRecentPdf, pdfDataUrl, user?.username])

  // Load bookmarks and history from MongoDB when PDF loads
  useEffect(() => {
    if (!pdfFileName || dataLoadedRef.current === pdfFileName) return
    dataLoadedRef.current = pdfFileName

    const loadData = async () => {
      try {
        usePDFStore.setState({ wordHistory: [], bookmarks: [] })

        const [bookmarksRes, historyRes] = await Promise.all([
          authFetch(`/api/db/bookmarks?pdfFileName=${encodeURIComponent(pdfFileName)}`),
          authFetch(`/api/db/history?pdfFileName=${encodeURIComponent(pdfFileName)}`),
        ])

        if (bookmarksRes.ok) {
          const bmData = await bookmarksRes.json()
          bmData.forEach((bm: any) => {
            addBookmark({
              id: bm._id?.toString() || `bm-${Date.now()}-${Math.random()}`,
              pageNumber: bm.pageNumber,
              word: bm.word,
              meaning: bm.meaning,
              pronunciation: bm.pronunciation,
              translation: bm.translation,
              sentence: bm.sentence,
              timestamp: new Date(bm.timestamp).getTime(),
              pdfFileName: bm.pdfFileName,
            })
          })
        }

        if (historyRes.ok) {
          const histData = await historyRes.json()
          histData.forEach((h: any) => {
            addToHistory({
              id: h._id?.toString() || `hist-${Date.now()}-${Math.random()}`,
              word: h.word,
              meaning: h.meaning,
              pronunciation: h.pronunciation,
              translation: h.translation,
              sentence: h.sentence,
              pageNumber: h.pageNumber,
              timestamp: new Date(h.timestamp).getTime(),
              pdfFileName: h.pdfFileName,
            })
          })
        }
      } catch (e) {
        console.error('Failed to load data from MongoDB:', e)
      }
    }

    loadData()
  }, [pdfFileName, addBookmark, addToHistory])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false)
        else if (showHistory) setShowHistory(false)
        else if (showBookmarks) setShowBookmarks(false)
        else clearSelection()
        return
      }

      // Don't trigger shortcuts when typing in inputs
      if (isInput) return

      switch (e.key.toLowerCase()) {
        case '/':
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            toggleSearch()
          }
          break
        case 'h':
          toggleHistory()
          break
        case 'b':
          toggleBookmarks()
          break
        case 'n':
          e.preventDefault()
          goToNextSearchResult()
          break
        case 'p':
          e.preventDefault()
          goToPrevSearchResult()
          break
      }
    },
    [
      clearSelection,
      toggleSearch,
      toggleHistory,
      toggleBookmarks,
      goToNextSearchResult,
      goToPrevSearchResult,
      showSearch,
      showHistory,
      showBookmarks,
      setShowSearch,
      setShowHistory,
      setShowBookmarks,
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background/80 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <BookOpen className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">PDF Reader AI</span>
        </div>

        <div className="flex items-center gap-1.5">
          <UploadZone />
          <div className="mx-1 h-4 w-px bg-border/50" />
          <SettingsPanel />
          {user && (
            <div className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground">
              <span className="hidden sm:inline max-w-[80px] truncate">{user.username}</span>
              <button
                onClick={logout}
                className="ml-0.5 rounded p-0.5 text-muted-foreground/60 hover:text-red-500 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1 overflow-hidden">
        <ErrorBoundary>
          <PDFViewer />
          <WordPopup />
        </ErrorBoundary>
        <HistoryPanel />
        <BookmarksPanel />
      </main>

      {/* Footer - only visible when no PDF */}
      {!pdfDataUrl && (
        <footer className="border-t bg-muted/30 px-4 py-6">
          <div className="mx-auto max-w-3xl">
            {recentPdfs.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Books
                    </h3>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      Continue where you left off
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {recentPdfs.length} saved
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recentPdfs.map((pdf) => {
                    const storedPage = getStoredBookPage(user?.username, pdf.fileName)
                    const lastPage = Math.max(1, Number(pdf.lastPage || storedPage || 1))
                    const pageCount = Math.max(0, Number(pdf.pageCount || 0))
                    const progress = pageCount > 0 ? Math.min(100, Math.round((lastPage / pageCount) * 100)) : 0
                    const wordCount =
                      pdf.wordCount ??
                      wordHistory.filter((w) => w.pdfFileName === pdf.fileName).length
                    const bmCount =
                      pdf.bookmarkCount ??
                      bookmarks.filter((b) => b.pdfFileName === pdf.fileName).length
                    const isLoadingBook = recentLoading === pdf.fileName
                    return (
                      <button
                        key={pdf.fileName}
                        onClick={() => handleLoadRecentPdf(pdf.fileName)}
                        disabled={isLoadingBook}
                        className="group flex min-h-[142px] flex-col justify-between rounded-lg border bg-background p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:hover:border-emerald-600 disabled:cursor-wait disabled:opacity-60"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {isLoadingBook ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground" title={pdf.fileName}>
                              {pdf.fileName}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatRecentDate(pdf.timestamp)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>
                              Page {lastPage}{pageCount > 0 ? ` of ${pageCount}` : ''}
                            </span>
                            {pageCount > 0 && <span>{progress}%</span>}
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${pageCount > 0 ? progress : 12}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {wordCount} words
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Bookmark className="h-3 w-3" />
                              {bmCount}
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Context-Aware AI
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Understands word meanings based on how they are used in the
                    sentence, not just dictionary definitions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                  <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Instant Popups
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Click or select any word to get its meaning, pronunciation,
                    and translation right beside it.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Multi-Language
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Get translations in Hindi, Marathi, Spanish, French, and
                    many more languages.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
