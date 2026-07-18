'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, Bookmark, BookOpen, BookText, Brain, BrainCircuit, Clock, Sparkles, FileText, LogOut, Loader2, Flame, Maximize2, Minimize2, Users, Shield, X, Crown, Rocket, FlaskConical, MoreHorizontal, Settings2, Gift, GraduationCap, List, Library } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { UploadZone } from '@/components/upload-zone'
import { WordPopup } from '@/components/word-popup'
import { SettingsPanel } from '@/components/settings-panel'
import { HistoryPanel } from '@/components/history-panel'
import { QuotesPanel } from '@/components/quotes-panel'
import { TtsControls } from '@/components/tts-controls'
import { ReadingTimer } from '@/components/reading-timer'
import { BookmarksPanel } from '@/components/bookmarks-panel'
import { FlashcardReview } from '@/components/flashcard-review'
import { ReadingAnalytics } from '@/components/reading-analytics'
import { ShareSessionPanel } from '@/components/share-session-panel'

import { RecentBookshelf } from '@/components/recent-bookshelf'
import { StarsBackground } from '@/components/stars-background'
import { ReadingStatsRow } from '@/components/reading-stats-row'
import { ReadingChallenge } from '@/components/reading-challenge'
import { QuestionGeneratorPanel } from '@/components/question-generator-panel'
import { SummarizerPanel } from '@/components/summarizer-panel'
import { ErrorBoundary } from '@/components/error-boundary'
import { WordLabPreview } from '@/components/word-lab/word-lab-preview'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePDFStore } from '@/store/use-pdf-store'
import { useShareSSE } from '@/hooks/useShareSSE'
import { authFetch } from '@/lib/api'
import { getActiveBook, getStoredBookPage, setActiveBook, setStoredBookPage } from '@/lib/reading-progress'
import { PLAN_LABELS, type AIPlan } from '@/lib/ai-plan'
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
    shareSession,
    toggleSharePanel,
    setOcrText,
    clearOcrText,
    setStreakCount,
    announcements,
    rewardNotification,
    lastDashboardFetch,
    setDashboardCache,
  } = usePDFStore()

  const { user, logout } = useAuth()
  const isMobile = useIsMobile()
  const userPlan = user?.plan
  const userIsAdmin = user?.isAdmin
  const username = user?.username

  const plan: AIPlan = userPlan || (userIsAdmin ? 'admin' : 'free')
  const planBadgeClass = (() => {
    if (plan === 'admin') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    if (plan === 'founder') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    if (plan === 'pro') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
    if (plan === 'beta') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
  })()
  const PlanIcon = plan === 'founder' ? Crown : plan === 'pro' ? Rocket : plan === 'beta' ? FlaskConical : Sparkles
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
    <div className="flex h-screen flex-col bg-background">
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
      <header className={`flex h-14 items-center justify-between gap-2 border-b border-border/15 bg-background/50 px-3 backdrop-blur-xl transition-all duration-300 sm:h-16 sm:px-4 ${
        focusMode ? 'pointer-events-none opacity-0 -translate-y-2' : ''
      }`}>
        {/* Left: Brand + PDF File Name */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm sm:h-9 sm:w-9">
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                PDFMind<span className="text-emerald-500">AI</span>
              </p>
              {pdfFileName ? (
                <p className="max-w-[120px] truncate text-[10px] text-muted-foreground sm:max-w-[200px] sm:text-xs">
                  <span className="text-emerald-500/70 mr-1">&#9654;</span>
                  {pdfFileName.replace(/\.pdf$/i, '')}
                </p>
              ) : (
                <p className="hidden text-[10px] text-muted-foreground/50 sm:block sm:text-xs">
                  Reading workspace
                </p>
              )}
            </div>
          </Link>
          {pdfDataUrl && (
            <button
              onClick={() => setPdfDataUrl(null)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 transition-all hover:bg-muted/50 hover:text-foreground sm:h-7 sm:w-7"
              title="Close PDF"
              aria-label="Close PDF"
            >
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-1.5">
          {pdfFileName && (
            <div className="hidden md:block">
              <UploadZone />
            </div>
          )}
          {streakCount > 0 && (
            <Link
              href="/profile"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-orange-200/20 bg-orange-50/50 px-2 text-xs font-semibold text-orange-600 transition-all hover:bg-orange-100/50 sm:h-9 sm:rounded-xl sm:px-3 dark:border-orange-800/15 dark:bg-orange-950/10 dark:text-orange-400 dark:hover:bg-orange-950/20"
              title={`${streakCount}-day streak!`}
            >
              <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">{streakCount}</span>
            </Link>
          )}

          {/* Desktop action links */}
          <div className="hidden items-center gap-0.5 sm:flex sm:gap-1">
            <Link
              href="/review"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-violet-600 hover:bg-muted/40"
              title="Flashcard Review"
            >
              <BrainCircuit className="h-3 w-3" />
            </Link>
            <Link
              href="/vocabulary"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-violet-600 hover:bg-muted/40"
              title="Vocabulary"
            >
              <BookText className="h-3 w-3" />
            </Link>
            <Link
              href="/collections"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-muted/40"
              title="Collections"
            >
              <Library className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/lists"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-muted/40"
              title="Word Lists"
            >
              <List className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/ielts"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:text-emerald-600 hover:bg-muted/40 transition-colors"
              title="IELTS Prep"
            >
              <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
              <span className="hidden lg:inline">IELTS Prep</span>
            </Link>
            <button
              onClick={toggleSharePanel}
              className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-all ${
                shareSession
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
              title={shareSession ? `Session: ${shareSession.name}` : 'Collaborative Reading'}
            >
              <Users className="h-3 w-3" />
              <span className="hidden xl:inline">{shareSession ? shareSession.name : 'Collaborate'}</span>
            </button>
            {user?.isAdmin && (
              <Link
                href="/admin"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-violet-600 hover:bg-muted/40"
                title="Admin Panel"
              >
                <Shield className="h-3 w-3" />
              </Link>
            )}
            <div className="inline-flex">
              <SettingsPanel />
            </div>
          </div>

          {/* Mobile overflow */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/80 text-muted-foreground shadow-sm transition-all hover:border-muted-foreground/20 hover:text-foreground sm:hidden"
                aria-label="More menu"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Signed in as <span className="font-semibold text-foreground">{user?.username}</span>
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/review" className="flex items-center gap-2">
                  <BrainCircuit className="h-3.5 w-3.5" /> Flashcard Review
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/vocabulary" className="flex items-center gap-2">
                  <BookText className="h-3.5 w-3.5" /> Vocabulary
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/collections" className="flex items-center gap-2">
                  <Library className="h-3.5 w-3.5" /> Collections
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/lists" className="flex items-center gap-2">
                  <List className="h-3.5 w-3.5" /> Word Lists
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/ielts" className="flex items-center gap-2">
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-500" /> IELTS Prep
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleSharePanel()}>
                <Users className="h-3.5 w-3.5" />
                {shareSession ? shareSession.name : 'Collaborate'}
              </DropdownMenuItem>
              {user?.isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" /> Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={(e) => {
                e.preventDefault()
                const btn = document.querySelector<HTMLButtonElement>('[aria-label="Settings"]')
                btn?.click()
              }}>
                <Settings2 className="h-3.5 w-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => logout()} className="text-red-600 focus:text-red-600">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile pill */}
          {user && (
            <Link
              href="/profile"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/30 bg-background/70 px-1.5 transition-all hover:bg-muted/50 sm:h-9 sm:rounded-xl sm:px-2"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-white sm:h-6 sm:w-6">
                <span className="text-[9px] font-bold sm:text-[10px]">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden max-w-[80px] truncate text-xs font-medium text-foreground sm:inline sm:max-w-[100px]">
                {user.username}
              </span>
              <span
                className={`hidden md:inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${planBadgeClass}`}
                title={`Plan: ${PLAN_LABELS[plan as AIPlan]}`}
              >
                <PlanIcon className="h-2 w-2" />
                {PLAN_LABELS[plan as AIPlan]}
              </span>
            </Link>
          )}
        </div>
      </header>

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
        <main className="flex-1 overflow-auto relative">
          <StarsBackground />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--emerald-500)/0.05)_0%,transparent_40%,hsl(var(--background))_100%)]" />
          <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10 lg:px-8">
            <section className="grid items-start gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 pt-2 space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  <BookOpen className="h-3 w-3" /> Reading Desk
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl text-foreground">
                  Pick up your <span className="text-emerald-500">next page</span>
                </h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground/70">
                  Recent books, saved words, bookmarks, and reading progress in one calm, AI-powered workspace.
                </p>
              </div>

              <aside className="rounded-2xl border border-border/30 bg-card/50 p-5 transition-all hover:border-border/50 duration-300">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      Start Reading
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Upload a PDF to open the interactive reader.</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
                <UploadZone variant="panel" />
              </aside>
            </section>

            <WordLabPreview />

            {rewardNotification && (
              <div className="relative rounded-xl border border-emerald-500/15 bg-emerald-50/50 px-5 py-4 pr-12 dark:border-emerald-800/15 dark:bg-emerald-950/10">
                <button
                  onClick={() => setDashboardCache({ rewardNotification: null })}
                  className="absolute right-3 top-3 rounded-md p-1 text-emerald-400 transition-colors hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-800/30"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      Streak Reward Unlocked!
                    </p>
                    <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                      You reached a {rewardNotification.days}-day streak and earned <strong>{rewardNotification.rewardDays} days of Pro</strong> access!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {announcements.filter((a) => !dismissedAnnouncements.has(a._id)).map((a) => (
              <div key={a._id} className="relative rounded-xl border border-border/20 bg-card/40 px-5 py-4 pr-12">
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

            {resumeBook && !dismissedResume && (
              <div className="group relative rounded-2xl border border-border/20 bg-card/40 p-6 transition-all hover:border-border/40 duration-300">
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Resume Reading
                      </p>
                      <p className="mt-2 text-base font-extrabold truncate sm:text-lg text-foreground">
                        {resumeBook.fileName}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70">
                        <span className="inline-flex items-center gap-1.5">
                          Page {resumeBook.lastPage}{resumeBook.pageCount > 0 ? ` of ${resumeBook.pageCount}` : ''}
                        </span>
                        {resumeBook.timestamp && (
                          <span className="inline-flex items-center gap-1.5">
                            {timeAgo(Number(resumeBook.timestamp))}
                          </span>
                        )}
                        {resumeBook.pageCount > 0 && (
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {Math.min(100, Math.round((resumeBook.lastPage / resumeBook.pageCount) * 100))}% complete
                          </span>
                        )}
                      </div>
                      {resumeBook.pageCount > 0 && (
                        <div className="mt-3 h-1.5 w-full max-w-xs rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500/80 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.round((resumeBook.lastPage / resumeBook.pageCount) * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:items-start">
                    <button
                      onClick={() => handleLoadRecentPdf(resumeBook.fileName, resumeBook.lastPage)}
                      disabled={recentLoading === resumeBook.fileName}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-[0.97] disabled:cursor-wait disabled:opacity-40 sm:flex-none"
                    >
                      {recentLoading === resumeBook.fileName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem(RESUME_DISMISS_KEY, resumeBook.fileName)
                        }
                        setDismissedResume(true)
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/40 text-muted-foreground/50 transition-all hover:bg-muted hover:text-foreground"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <ReadingStatsRow />

            <div className="max-w-3xl">
              <ReadingChallenge />
            </div>

            <section>
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Your Library
                </p>
                <p className="mt-1 text-lg italic text-foreground/70">
                  All your books
                </p>
              </div>
              <div className="max-w-3xl">
                <RecentBookshelf onOpen={(fileName) => handleLoadRecentPdf(fileName)} loadingFileName={recentLoading} />
              </div>
            </section>
          </div>
        </main>
      )}
      <ShareSessionPanel />

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
        </DialogContent>
      </Dialog>
    </div>
  )
}
