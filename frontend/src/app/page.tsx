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

  const recentBookCards = recentPdfs.map((pdf) => {
    const storedPage = getStoredBookPage(user?.username, pdf.fileName)
    const lastPage = Math.max(1, Number(pdf.lastPage || storedPage || 1))
    const pageCount = Math.max(0, Number(pdf.pageCount || 0))
    const progress = pageCount > 0 ? Math.min(100, Math.round((lastPage / pageCount) * 100)) : 0
    const wordCount =
      pdf.wordCount ??
      wordHistory.filter((w) => w.pdfFileName === pdf.fileName).length
    const bookmarkCount =
      pdf.bookmarkCount ??
      bookmarks.filter((b) => b.pdfFileName === pdf.fileName).length

    return {
      ...pdf,
      lastPage,
      pageCount,
      progress,
      wordCount,
      bookmarkCount,
      isLoading: recentLoading === pdf.fileName,
    }
  })

  const totalWords = recentBookCards.reduce((total, pdf) => total + pdf.wordCount, 0)
  const totalBookmarks = recentBookCards.reduce((total, pdf) => total + pdf.bookmarkCount, 0)
  const inProgressBooks = recentBookCards.filter(
    (pdf) => pdf.pageCount > 0 && pdf.lastPage < pdf.pageCount
  ).length

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 shadow-sm">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">PDF Reader AI</p>
            {!pdfDataUrl && (
              <p className="hidden text-xs text-muted-foreground sm:block">
                Reading workspace
              </p>
            )}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          {pdfFileName && (
            <>
              <div className="hidden md:block">
                <UploadZone />
              </div>
              <div className="mx-1 hidden h-5 w-px bg-border/60 md:block" />
            </>
          )}
          <SettingsPanel />
          {user && (
            <div className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1.5 text-xs text-muted-foreground">
              <span className="hidden max-w-[110px] truncate sm:inline">{user.username}</span>
              <button
                onClick={logout}
                className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:text-red-500"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {pdfDataUrl ? (
        <main className="relative flex-1 overflow-hidden">
          <ErrorBoundary>
            <PDFViewer />
            <WordPopup />
          </ErrorBoundary>
          <HistoryPanel />
          <BookmarksPanel />
        </main>
      ) : (
        <main className="flex-1 overflow-auto bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.45)_100%)]">
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
            <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 pt-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
                  Reading Desk
                </p>
                <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Pick up your next page
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Recent books, saved words, bookmarks, and reading progress are arranged in one calm workspace.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border bg-background/80 p-4 shadow-sm">
                    <FileText className="h-4 w-4 text-emerald-500" />
                    <p className="mt-3 text-2xl font-semibold text-foreground">{recentBookCards.length}</p>
                    <p className="text-xs text-muted-foreground">Books</p>
                  </div>
                  <div className="rounded-lg border bg-background/80 p-4 shadow-sm">
                    <Clock className="h-4 w-4 text-sky-500" />
                    <p className="mt-3 text-2xl font-semibold text-foreground">{inProgressBooks}</p>
                    <p className="text-xs text-muted-foreground">In progress</p>
                  </div>
                  <div className="rounded-lg border bg-background/80 p-4 shadow-sm">
                    <Brain className="h-4 w-4 text-violet-500" />
                    <p className="mt-3 text-2xl font-semibold text-foreground">{totalWords}</p>
                    <p className="text-xs text-muted-foreground">Words</p>
                  </div>
                  <div className="rounded-lg border bg-background/80 p-4 shadow-sm">
                    <Bookmark className="h-4 w-4 text-amber-500" />
                    <p className="mt-3 text-2xl font-semibold text-foreground">{totalBookmarks}</p>
                    <p className="text-xs text-muted-foreground">Bookmarks</p>
                  </div>
                </div>
              </div>

              <aside className="rounded-lg border bg-background p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Start Reading</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Upload a PDF to open the reader.</p>
                  </div>
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                </div>
                <UploadZone variant="panel" />
              </aside>
            </section>

            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Recent Books
                  </h2>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    Continue where you left off
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {recentBookCards.length} saved
                </span>
              </div>

              {recentBookCards.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {recentBookCards.map((pdf) => (
                    <button
                      key={pdf.fileName}
                      onClick={() => handleLoadRecentPdf(pdf.fileName)}
                      disabled={pdf.isLoading}
                      className="group flex min-h-[168px] flex-col justify-between rounded-lg border bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:hover:border-emerald-600 disabled:cursor-wait disabled:opacity-60"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {pdf.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground" title={pdf.fileName}>
                            {pdf.fileName}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatRecentDate(pdf.timestamp)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Page {pdf.lastPage}{pdf.pageCount > 0 ? ` of ${pdf.pageCount}` : ''}
                          </span>
                          {pdf.pageCount > 0 && <span>{pdf.progress}%</span>}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pdf.pageCount > 0 ? pdf.progress : 12}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {pdf.wordCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Bookmark className="h-3.5 w-3.5" />
                            {pdf.bookmarkCount}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-background/80 p-8 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-foreground">No recent books yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Your library will appear here after the first upload.</p>
                </div>
              )}
            </section>
          </div>
        </main>
      )}
    </div>
  )
}
