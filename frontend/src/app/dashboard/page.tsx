'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, BookOpen, Loader2, Gift, X, Library } from 'lucide-react'

import { useAuth } from '@/context/auth-context'
import { UploadZone } from '@/components/upload-zone'
import { WordPopup } from '@/components/word-popup'
import { HistoryPanel } from '@/components/history-panel'
import { QuotesPanel } from '@/components/quotes-panel'
import { TtsControls } from '@/components/tts-controls'
import { ReadingTimer } from '@/components/reading-timer'
import { BookmarksPanel } from '@/components/bookmarks-panel'
import { FlashcardReview } from '@/components/flashcard-review'
import { ReadingAnalytics } from '@/components/reading-analytics'
import { RecentBookshelf } from '@/components/recent-bookshelf'
import { ReadingStatsRow } from '@/components/reading-stats-row'
import { ReadingChallenge } from '@/components/reading-challenge'
import { QuestionGeneratorPanel } from '@/components/question-generator-panel'
import { SummarizerPanel } from '@/components/summarizer-panel'
import { ErrorBoundary } from '@/components/error-boundary'
import { WordLabPreview } from '@/components/word-lab/word-lab-preview'
import { usePDFStore } from '@/store/use-pdf-store'
import { SettingsPanel } from '@/components/settings-panel'
import { useShareSSE } from '@/hooks/useShareSSE'
import { authFetch } from '@/lib/api'
import { generateFirstPageCover } from '@/lib/pdf-cover'
import { getActiveBook, getStoredBookPage, setActiveBook, setStoredBookPage } from '@/lib/reading-progress'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

const timeAgo = (timestamp: number) => {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatRecentDate(timestamp)
}

const RESUME_DISMISS_KEY = 'pdf-reader-ai-resume-dismissed'
const FETCH_TTL = 60_000

export default function DashboardPage() {
  const {
    pdfDataUrl,
    pdfFileName,
    clearSelection,
        toggleSearch,
        toggleHistory,
        toggleBookmarks,
        toggleFlashcards,
        toggleReadingStats,
        streakCount,
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
    focusMode,
    toggleFocusMode,
    setFocusMode,
    setOcrText,
    clearOcrText,
    setStreakCount,
    announcements,
    rewardNotification,
    lastDashboardFetch,
    setDashboardCache,
  } = usePDFStore()

  const { user } = useAuth()
  const isMobile = useIsMobile()
  const username = user?.username
  const [recentLoading, setRecentLoading] = useState<string | null>(null)
  const [recentPdfsLoading, setRecentPdfsLoading] = useState(true)
  const [resumeBook, setResumeBook] = useState<{
    fileName: string
    lastPage: number
    pageCount: number
    timestamp: number
  } | null>(null)
  const [dismissedResume, setDismissedResume] = useState(true)
  // UX fix (U11): keyboard shortcuts cheatsheet dialog state.
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('dismissed-announcements')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  function greeting(): string {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const handleUpload = async (files: FileList) => {
    const file = files[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { alert('File too large (max 50MB)'); return }
    if (file.type !== 'application/pdf') { alert('Please upload a PDF file'); return }

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        const res = await authFetch('/api/db/pdf', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, content: dataUrl, size: file.size }),
        })
        if (!res.ok) { alert('Upload failed'); return }
        const data = await res.json()
        if (!data?.id) { alert('Upload failed'); return }
        setPdfDataUrl(dataUrl)
        setPdfFileName(file.name)
        window.history.replaceState({}, '', '/dashboard?open=' + encodeURIComponent(file.name))
        generateFirstPageCover(file.name, dataUrl).catch(() => {})
      }
      reader.readAsDataURL(file)
    } catch { alert('Upload failed') }
  }

  const dismissAnnouncement = (id: string) => {
    setDismissedAnnouncements((prev) => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('dismissed-announcements', JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  const dataLoadedRef = useRef<string | null>(null)
  const recentLoadedRef = useRef<string | null>(null)
  const openRequestLoadedRef = useRef<string | null>(null)

  // Load a recent PDF from MongoDB
  const handleLoadRecentPdf = useCallback(
    async (fileName: string, preferredPage?: number | null) => {
      setRecentLoading(fileName)
      try {
        const res = await authFetch(`/api/db/pdf?fileName=${encodeURIComponent(fileName)}`)
        if (!res.ok) return

        const pdf = await res.json()
        if (pdf) {
          const existingMeta = usePDFStore
            .getState()
            .recentPdfs.find((item) => item.fileName === fileName)
          // Combine all sources and take the highest — localStorage may be ahead of the DB
          // if the user closed the tab before the debounced PATCH fired.
          const storedPage = getStoredBookPage(username, fileName) || 0
          const dbPage = Number(pdf.lastPage) || 0
          const metaPage = Number(existingMeta?.lastPage) || 0
          const preferred = Number(preferredPage) || 0
          const restoredPage = Math.max(preferred, dbPage, metaPage, storedPage) || 1

          clearOcrText()
          setCurrentPage(Math.max(1, Number(restoredPage) || 1))
          setPdfFileName(fileName)
          addRecentPdf({
            fileName,
            timestamp: Date.now(),
            pageCount: pdf.pageCount || existingMeta?.pageCount || 0,
            lastPage: Math.max(1, Number(restoredPage) || 1),
            wordCount: existingMeta?.wordCount,
            bookmarkCount: existingMeta?.bookmarkCount,
          })
          setActiveBook(username, fileName)
          setStoredBookPage(username, fileName, Math.max(1, Number(restoredPage) || 1))

          // Restore OCR data if available
          if (pdf.ocrText) {
            for (const [page, data] of Object.entries(pdf.ocrText)) {
              setOcrText(Number(page), data as any)
            }
          }

          // Mark as recently accessed
          authFetch('/api/db/pdf', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, lastAccessedAt: new Date().toISOString() }),
          }).catch(() => {})

          // Fetch PDF file from the file-serving API route
          const fileRes = await authFetch(`/api/db/pdf/file?fileName=${encodeURIComponent(fileName)}`)
          if (fileRes.ok) {
            const blob = await fileRes.blob()
            const objectUrl = URL.createObjectURL(blob)
            setPdfDataUrl(objectUrl)
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
      username,
    ]
  )

  useEffect(() => {
    if (!user?.username || typeof window === 'undefined') return
    const openFileName = new URLSearchParams(window.location.search).get('open')
    if (!openFileName || openRequestLoadedRef.current === openFileName) return

    openRequestLoadedRef.current = openFileName
    handleLoadRecentPdf(openFileName)

    // Clean the ?open= param from the URL so refresh doesn't re-open
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('open')
      window.history.replaceState({}, '', url.toString())
    }
  }, [handleLoadRecentPdf, user?.username])

  // Load recent PDFs from MongoDB on mount (cache in zustand store across navigations)
  useEffect(() => {
    if (!user?.username || recentLoadedRef.current === user.username) return
    recentLoadedRef.current = user.username

    const store = usePDFStore.getState()
    const hasCached = store.recentPdfs.length > 0

    if (hasCached) {
      // Show cached data immediately; re-fetch silently in background
      setRecentPdfsLoading(false)
      restoreResumeBook(store.recentPdfs)
    } else {
      setRecentPdfsLoading(true)
    }

    const loadRecentPdfs = async () => {
      try {
        const res = await authFetch('/api/db/pdf')
        const pdfs: any[] = await res.json()
        if (Array.isArray(pdfs)) {
          // Merge remote data into store (dedupes by fileName internally)
          pdfs.forEach((p) => {
            const storedPage = getStoredBookPage(user.username, p.fileName) || 0
            const dbPage = Number(p.lastPage) || 0
            const lastPage = Math.max(dbPage, storedPage) || 1
            addRecentPdf({
              fileName: p.fileName,
              timestamp: new Date(p.updatedAt || p.createdAt).getTime(),
              pageCount: p.pageCount || 0,
              lastPage,
              wordCount: p.wordCount || 0,
              bookmarkCount: p.bookmarkCount || 0,
            })
          })

          if (!hasCached) {
            restoreResumeBook(pdfs)
          }
        }
      } catch {
        // Recent books are a convenience layer; the reader still works without them.
      } finally {
        setRecentPdfsLoading(false)
      }
    }

    loadRecentPdfs()
  }, [addRecentPdf, handleLoadRecentPdf, pdfDataUrl, user?.username])

  function restoreResumeBook(pdfs: any[]) {
    const activeBook = getActiveBook(user?.username)
    if (!pdfDataUrl && activeBook && pdfs.some((p: any) => p.fileName === activeBook)) {
      const activeMeta = pdfs.find((p: any) => p.fileName === activeBook)
      const storedPage = getStoredBookPage(user?.username, activeBook) || 0
      const dbPage = Number(activeMeta?.lastPage) || 0
      const lastPage = Math.max(dbPage, storedPage) || 1
      const dismissed = typeof window !== 'undefined' &&
        window.localStorage.getItem(RESUME_DISMISS_KEY) === activeBook
      setDismissedResume(dismissed)
      if (!dismissed) {
        setResumeBook({
          fileName: activeBook,
          lastPage,
          pageCount: activeMeta?.pageCount || 0,
          timestamp: activeMeta?.timestamp ? Number(activeMeta.timestamp) : Date.now(),
        })
      }
    }
  }

  // Load bookmarks and history from MongoDB when PDF loads (cache in zustand store)
  useEffect(() => {
    if (!pdfFileName || dataLoadedRef.current === pdfFileName) return
    dataLoadedRef.current = pdfFileName

    // Skip fetch if store already has data for this PDF
    const store = usePDFStore.getState()
    const hasHistory = store.wordHistory.some((w) => w.pdfFileName === pdfFileName)
    const hasBookmarks = store.bookmarks.some((b) => b.pdfFileName === pdfFileName)
    if (hasHistory && hasBookmarks) return

    const loadData = async () => {
      try {
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

  // Fetch dashboard data (streak, announcements, rewards) — cached in store across navigations
  useEffect(() => {
    const now = Date.now()
    if (now - lastDashboardFetch < FETCH_TTL) return

    Promise.all([
      authFetch('/api/reading-stats?days=1').then((r) => r.ok ? r.json() : null),
      authFetch('/api/announcements').then((r) => r.ok ? r.json() : null),
      authFetch('/api/rewards').then((r) => r.ok ? r.json() : null),
    ]).then(([stats, ann, rew]) => {
      if (stats) {
        setStreakCount(stats.streak || 0)
        if (stats.today) {
          usePDFStore.getState().setTodayStats(
            stats.today.pagesRead || 0,
            stats.today.timeSpentMs ? Math.round(stats.today.timeSpentMs / 60000) : 0
          )
        }
      }
      setDashboardCache({
        announcements: ann?.announcements || [],
        rewardNotification: rew?.newReward
          ? { days: rew.streak, rewardDays: rew.newReward.durationDays }
          : null,
      })
    }).catch(() => {})
  }, [lastDashboardFetch, setStreakCount, setDashboardCache])

  // Real-time share session sync
  useShareSSE()

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (e.key === 'Escape') {
        if (focusMode) { setFocusMode(false); return }
        if (showSearch) setShowSearch(false)
        else if (showHistory) setShowHistory(false)
        else if (showBookmarks) setShowBookmarks(false)
        else clearSelection()
        return
      }

      // Don't trigger shortcuts when typing in inputs
      if (isInput) return

      switch (e.key.toLowerCase()) {
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            toggleFocusMode()
          }
          break
        case '/':
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
        case 'g':
          toggleFlashcards()
          break
        case 'n':
          e.preventDefault()
          goToNextSearchResult()
          break
        case 'p':
          e.preventDefault()
          goToPrevSearchResult()
          break
        case '?':
          // UX fix (U11): surface keyboard shortcuts via a cheatsheet dialog.
          e.preventDefault()
          setShortcutsOpen(true)
          break
      }
    },
    [
      clearSelection,
      toggleSearch,
      toggleHistory,
      toggleBookmarks,
      toggleFlashcards,
      goToNextSearchResult,
      goToPrevSearchResult,
      showSearch,
      showHistory,
      showBookmarks,
      setShowSearch,
      setShowHistory,
      setShowBookmarks,
      focusMode,
      toggleFocusMode,
      setFocusMode,
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const recentBookCards = recentPdfs.map((pdf) => {
    const storedPage = getStoredBookPage(user?.username, pdf.fileName) || 0
    const dbPage = Number(pdf.lastPage) || 0
    const lastPage = Math.max(1, Math.max(dbPage, storedPage))
    const pageCount = Math.max(0, Number(pdf.pageCount || 0))
    const progress = pageCount > 0 ? Math.min(100, Math.round((lastPage / pageCount) * 100)) : 0
    const wordCount =
      pdf.wordCount ??
      bookmarks.filter((b) => b.pdfFileName === pdf.fileName).length
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

  return (
    <>
      {focusMode && <div className="fixed inset-0 z-30 bg-background" />}
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="fixed left-1/2 top-3 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-violet-200/50 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-4 py-2 text-xs font-semibold text-violet-700 shadow-lg shadow-violet-200/30 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-violet-200/40 active:scale-[0.97] dark:border-violet-800/20 dark:from-violet-950/30 dark:to-fuchsia-950/30 dark:text-violet-400 dark:shadow-violet-900/10"
        >
          <span>Exit focus mode</span>
          <kbd className="rounded-md border border-violet-200/50 bg-white/60 px-1.5 py-0.5 text-[10px] font-mono font-bold dark:border-violet-800/30 dark:bg-violet-950/50">Esc</kbd>
        </button>
      )}

      {pdfDataUrl ? (
        <main id="main-content" className={`relative flex-1 overflow-hidden ${focusMode ? 'fixed inset-0 z-40' : ''}`}>
          <ErrorBoundary>
            <PDFViewer />
            <WordPopup />
            <TtsControls />
            {!isMobile && <ReadingTimer />}
          </ErrorBoundary>
          <div className={`transition-opacity duration-300 ${focusMode ? 'pointer-events-none opacity-0' : ''}`}>
            <HistoryPanel />
            <BookmarksPanel />
            <QuotesPanel />
            <FlashcardReview />
            <ReadingAnalytics />
            <QuestionGeneratorPanel />
            <SummarizerPanel />
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-auto relative bg-dots">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
            {/* Greeting */}
            <div className="mb-10">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                  <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
                    {greeting()}, {username}.
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Pick up your next page.
                  </p>
                </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShortcutsOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-mono">?</kbd>
                  Shortcuts
                </button>
                <SettingsPanel />
              </div>
              </div>
            </div>

            {/* Reward notification */}
            {rewardNotification && (
              <div className="relative rounded-xl border border-brand/30 bg-brand/5 px-5 py-4 pr-12 mb-4">
                <button
                  onClick={() => setDashboardCache({ rewardNotification: null })}
                  className="absolute right-3 top-3 rounded-md p-1 text-brand/60 transition-colors hover:text-brand"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Streak Reward Unlocked!
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You reached a {rewardNotification.days}-day streak and earned <strong>{rewardNotification.rewardDays} days of Pro</strong> access!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Announcements */}
            {announcements.filter((a) => !dismissedAnnouncements.has(a._id)).map((a) => (
              <div key={a._id} className="relative rounded-xl border border-border/20 bg-card/40 px-5 py-4 pr-12 mb-4">
                <button
                  onClick={() => dismissAnnouncement(a._id)}
                  className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground/40 transition-colors hover:text-foreground"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">{a.title}</p>
                <p className="mt-1 text-sm text-muted-foreground/70">{a.body}</p>
              </div>
            ))}

            {/* Resume reading */}
            {resumeBook && !dismissedResume && (
              <div className="group relative rounded-2xl border border-brand/30 bg-card/50 p-6 lg:p-8 mb-8 overflow-hidden">
                <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-brand/10 blur-3xl" aria-hidden />
                <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-6">
                  <div className="flex h-16 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 shrink-0">
                    <BookOpen className="h-7 w-7 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Resume reading</span>
                    <h2 className="font-serif text-xl font-semibold truncate">{resumeBook.fileName}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Page {resumeBook.lastPage}{resumeBook.pageCount > 0 ? ` of ${resumeBook.pageCount}` : ''}</span>
                      {resumeBook.timestamp && (
                        <span className="text-muted-foreground/60">· {timeAgo(Number(resumeBook.timestamp))}</span>
                      )}
                      {resumeBook.pageCount > 0 && (
                        <span className="font-medium text-brand">{Math.min(100, Math.round((resumeBook.lastPage / resumeBook.pageCount) * 100))}% complete</span>
                      )}
                    </div>
                    {resumeBook.pageCount > 0 && (
                      <div className="mt-3 h-1.5 w-full max-w-md rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((resumeBook.lastPage / resumeBook.pageCount) * 100))}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleLoadRecentPdf(resumeBook.fileName, resumeBook.lastPage)}
                      disabled={recentLoading === resumeBook.fileName}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-wait disabled:opacity-40"
                    >
                      {recentLoading === resumeBook.fileName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4" />
                          Continue
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        window.localStorage.setItem(RESUME_DISMISS_KEY, resumeBook.fileName)
                        setDismissedResume(true)
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 text-muted-foreground/50 transition-all hover:bg-muted hover:text-foreground"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stats row */}
            <ReadingStatsRow />

            {/* 2-column grid: main (upload + library) | sidebar (wordlab + challenge) */}
            <div className="grid lg:grid-cols-3 gap-6 mt-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Upload zone */}
                <div 
                  className="group relative overflow-hidden rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-card/60 via-card/40 to-brand/5 p-8 lg:p-12 text-center hover:border-brand/40 hover:bg-muted/10 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'application/pdf'
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files
                      if (files && files.length > 0) handleUpload(files)
                    }
                    input.click()
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).click()}
                >
                  {/* Subtle hover gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand/0 to-brand/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="relative flex flex-col items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand mb-4 group-hover:scale-105 group-hover:rotate-2 transition-transform duration-300 shadow-sm border border-brand/10">
                      <BookOpen className="h-7 w-7" />
                    </div>
                    <h3 className="font-serif text-xl font-bold tracking-tight text-foreground">Drop your PDF here</h3>
                    <p className="text-sm text-muted-foreground mt-1.5">or click to browse from device</p>
                    <div className="h-px w-24 bg-border/60 my-4" />
                    <p className="text-xs text-muted-foreground/60">Supports documents up to 50MB</p>
                    
                    {/* Visual Feature Tags */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-md">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-xs">
                        ⚡ Context Dictionary
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-xs">
                        🤖 AI Summaries
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-xs">
                        ✍️ PDF Annotations
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-xs">
                        👥 Shared Reading
                      </span>
                    </div>
                  </div>
                </div>

                {/* Library */}
                <section className="pt-4">
                  <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                        <Library className="h-4 w-4" />
                      </div>
                      <h2 className="font-serif text-xl font-bold tracking-tight text-foreground">Your library</h2>
                    </div>
                    {recentPdfs.length > 0 && (
                      <Link href="/library" className="text-xs text-brand hover:underline font-semibold flex items-center gap-1 transition-all hover:translate-x-0.5 animate-pulse">
                        View all library &rarr;
                      </Link>
                    )}
                  </div>
                  <RecentBookshelf onOpen={(fileName) => handleLoadRecentPdf(fileName)} loadingFileName={recentLoading} />
                </section>
              </div>

              <div className="space-y-6">
                <WordLabPreview />
                <ReadingChallenge />
              </div>
            </div>
          </div>
        </main>
      )}

      {/* UX fix (U11): keyboard shortcuts cheatsheet. Triggered by `?`. */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">F</kbd>
            <span className="text-muted-foreground">Toggle focus mode</span>
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">/</kbd>
            <span className="text-muted-foreground">Search in PDF</span>
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">H</kbd>
            <span className="text-muted-foreground">History</span>
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">B</kbd>
            <span className="text-muted-foreground">Bookmarks</span>
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">G</kbd>
            <span className="text-muted-foreground">Flashcards</span>
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">N</kbd>
            <span className="text-muted-foreground">Next search result</span>
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">P</kbd>
            <span className="text-muted-foreground">Previous search result</span>
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">Esc</kbd>
            <span className="text-muted-foreground">Close panel / exit focus</span>
            <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">?</kbd>
            <span className="text-muted-foreground">This help</span>
          </div>
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Annotations</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">1</kbd>
              <span className="text-muted-foreground">Select</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">2</kbd>
              <span className="text-muted-foreground">Highlight</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">3</kbd>
              <span className="text-muted-foreground">Draw (pen)</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">4</kbd>
              <span className="text-muted-foreground">Eraser</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">5</kbd>
              <span className="text-muted-foreground">Sticky note</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">Ctrl+Z</kbd>
              <span className="text-muted-foreground">Undo</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">Ctrl+Shift+Z</kbd>
              <span className="text-muted-foreground">Redo</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
