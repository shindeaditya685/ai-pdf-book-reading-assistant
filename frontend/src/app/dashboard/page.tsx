'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, Bookmark, BookOpen, BookText, Brain, BrainCircuit, Clock, Sparkles, FileText, Library, LogOut, Loader2, Flame, Maximize2, Minimize2, Users, Shield, X, Crown, Rocket, FlaskConical, MoreHorizontal, Settings2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/auth-context'
import { UploadZone } from '@/components/upload-zone'
import { WordPopup } from '@/components/word-popup'
import { SettingsPanel } from '@/components/settings-panel'
import { HistoryPanel } from '@/components/history-panel'
import { TtsControls } from '@/components/tts-controls'
import { ReadingTimer } from '@/components/reading-timer'
import { BookmarksPanel } from '@/components/bookmarks-panel'
import { FlashcardReview } from '@/components/flashcard-review'
import { ReadingAnalytics } from '@/components/reading-analytics'
import { ShareSessionPanel } from '@/components/share-session-panel'
import { QuestionGeneratorPanel } from '@/components/question-generator-panel'
import { SummarizerPanel } from '@/components/summarizer-panel'
import { ErrorBoundary } from '@/components/error-boundary'
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
  } = usePDFStore()

  const { user, logout } = useAuth()
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
        if (pdf?.content) {
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
          setPdfDataUrl(pdf.content)
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
  }, [handleLoadRecentPdf, user?.username])

  // Load recent PDFs from MongoDB on mount
  useEffect(() => {
    if (!user?.username || recentLoadedRef.current === user.username) return
    recentLoadedRef.current = user.username
    usePDFStore.setState({ recentPdfs: [] })

    const loadRecentPdfs = async () => {
      setRecentPdfsLoading(true)
      try {
        const res = await authFetch('/api/db/pdf')
        const pdfs: any[] = await res.json()
        if (Array.isArray(pdfs)) {
          pdfs.forEach((p) => {
            // Use the max of DB and localStorage — localStorage may be ahead of the DB
            // if the user closed the tab before the debounced PATCH fired.
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

          const activeBook = getActiveBook(user.username)
          if (!pdfDataUrl && activeBook && pdfs.some((p) => p.fileName === activeBook)) {
            const activeMeta = pdfs.find((p) => p.fileName === activeBook)
            // Use the max of DB and localStorage for the resume display
            const storedPage = getStoredBookPage(user.username, activeBook) || 0
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
      } catch {
        // Recent books are a convenience layer; the reader still works without them.
      } finally {
        setRecentPdfsLoading(false)
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

  // Fetch streak count on mount (always, even without PDF loaded)
  useEffect(() => {
    authFetch('/api/reading-stats?days=1').then((res) => {
      if (res.ok) res.json().then((data) => {
        setStreakCount(data.streak || 0)
        if (data.today) {
          usePDFStore.getState().setTodayStats(
            data.today.pagesRead || 0,
            data.today.timeSpentMs ? Math.round(data.today.timeSpentMs / 60000) : 0
          )
        }
      })
    }).catch(() => {})
  }, [setStreakCount])

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
      <header className={`flex h-16 items-center justify-between gap-2 border-b border-emerald-500/10 bg-background/60 px-3 shadow-[0_1px_0_0_rgba(16,185,129,0.05)] backdrop-blur-xl transition-opacity duration-300 sm:px-4 ${focusMode ? 'pointer-events-none opacity-0' : ''}`}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/20">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">PDFMind<span className="text-emerald-500">AI</span></p>
              {!pdfDataUrl && (
                <p className="hidden text-xs text-muted-foreground/60 sm:block">
                  Reading workspace
                </p>
              )}
            </div>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
          {pdfFileName && (
            <>
              <div className="hidden md:block">
                <UploadZone />
              </div>
              <div className="mx-1 hidden h-5 w-px bg-emerald-500/10 md:block" />
            </>
          )}
          {streakCount > 0 && (
            <Link
              href="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200/30 bg-gradient-to-r from-orange-50 to-amber-50 text-xs font-semibold text-orange-600 shadow-sm shadow-orange-200/20 transition-all hover:shadow-md hover:shadow-orange-200/30 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5 dark:border-orange-800/15 dark:from-orange-950/15 dark:to-amber-950/15 dark:text-orange-400 dark:shadow-orange-900/10"
              title={`${streakCount}-day streak!`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{streakCount}</span>
            </Link>
          )}

          {/* Desktop: individual icon buttons */}
          <button
            onClick={toggleSharePanel}
            className={`hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all ${
              shareSession
                ? 'border-emerald-400/50 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-200/30 dark:bg-emerald-950/20 dark:text-emerald-400'
                : 'border-border/60 bg-background/80 text-muted-foreground hover:border-muted-foreground/20 hover:text-foreground hover:shadow-sm'
            }`}
            title="Collaborative Reading Groups"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden md:inline">
              {shareSession ? shareSession.name : 'Collaborate'}
            </span>
          </button>
          <div className="hidden sm:inline-flex">
            <SettingsPanel />
          </div>
          <Link
            href="/library"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 hover:shadow-md sm:flex dark:hover:border-amber-800/30 dark:hover:bg-amber-950/20"
            title="Library"
          >
            <Library className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/review"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 hover:shadow-md sm:flex dark:hover:border-violet-800/30 dark:hover:bg-violet-950/20"
            title="Flashcard Review"
          >
            <BrainCircuit className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/vocabulary"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 hover:shadow-md sm:flex dark:hover:border-violet-800/30 dark:hover:bg-violet-950/20"
            title="Vocabulary"
          >
            <BookText className="h-3.5 w-3.5" />
          </Link>
          {user?.isAdmin && (
            <Link
              href="/admin"
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 hover:shadow-md sm:flex dark:hover:border-violet-800/30 dark:hover:bg-violet-950/20"
              title="Admin Panel"
            >
              <Shield className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Mobile: overflow menu with everything that doesn't fit */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-muted-foreground/20 hover:text-foreground sm:hidden"
                aria-label="More menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Signed in as <span className="font-semibold text-foreground">{user?.username}</span>
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => toggleSharePanel()}>
                <Users className="h-3.5 w-3.5" />
                {shareSession ? shareSession.name : 'Collaborate'}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/library" className="flex items-center gap-2">
                  <Library className="h-3.5 w-3.5" /> Library
                </Link>
              </DropdownMenuItem>
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
              {user?.isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" /> Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={(e) => {
                // SettingsPanel uses a Popover so we just trigger its trigger
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

          {user && (
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border/60 bg-background/80 px-1.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
              <Link href="/profile" className="flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-muted/50">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
                  <span className="text-[10px] font-bold text-white">{user.username.charAt(0).toUpperCase()}</span>
                </div>
                <span className="hidden max-w-[100px] truncate sm:inline font-medium">{user.username}</span>
              </Link>
              <span className={`hidden md:inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${planBadgeClass}`} title={`Plan: ${PLAN_LABELS[plan as AIPlan]}`}>
                <PlanIcon className="h-2.5 w-2.5" />
                {PLAN_LABELS[plan as AIPlan]}
              </span>
            </div>
          )}
        </div>
      </header>

      {pdfDataUrl ? (
        <main className={`relative flex-1 overflow-hidden ${focusMode ? 'fixed inset-0 z-40' : ''}`}>
          <ErrorBoundary>
            <PDFViewer />
            <WordPopup />
            <TtsControls />
            <ReadingTimer />
          </ErrorBoundary>
          <div className={`transition-opacity duration-300 ${focusMode ? 'pointer-events-none opacity-0' : ''}`}>
            <HistoryPanel />
            <BookmarksPanel />
            <FlashcardReview />
            <ReadingAnalytics />
            <QuestionGeneratorPanel />
            <SummarizerPanel />
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-auto relative">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--emerald-500)/0.05)_0%,transparent_40%,hsl(var(--background))_100%)]" />
          <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10 lg:px-8">
            <section className="grid items-start gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 pt-2">
                <div className="inline-flex items-center gap-2 rounded-full border bg-emerald-50/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                  <Sparkles className="h-3 w-3" />
                  Reading Desk
                </div>
                <h1 className="mt-4 max-w-2xl text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                  Pick up your next page
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground/80">
                  Recent books, saved words, bookmarks, and reading progress are arranged in one calm workspace.
                </p>
              </div>

              <aside className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-emerald-50/30 p-5 shadow-sm dark:to-emerald-950/10">
                <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-emerald-500/10 blur-xl" />
                <div className="relative mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Start Reading</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Upload a PDF to open the reader.</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                </div>
                <UploadZone variant="panel" />
              </aside>
            </section>

            {resumeBook && !dismissedResume && (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-100/30 p-5 shadow-lg shadow-emerald-500/10 sm:p-6 dark:from-emerald-950/20 dark:via-emerald-950/10 dark:to-emerald-900/20 dark:border-emerald-700/30">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
                <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-emerald-300/10 blur-xl" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 sm:h-12 sm:w-12">
                      <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-3 w-3" />
                        Resume Reading
                      </div>
                      <p className="mt-2 text-base font-bold text-foreground truncate sm:text-lg">
                        {resumeBook.fileName}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:gap-x-4 sm:text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-emerald-500" />
                          Page {resumeBook.lastPage}{resumeBook.pageCount > 0 ? ` of ${resumeBook.pageCount}` : ''}
                        </span>
                        {resumeBook.timestamp && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                            {timeAgo(Number(resumeBook.timestamp))}
                          </span>
                        )}
                        {resumeBook.pageCount > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {Math.min(100, Math.round((resumeBook.lastPage / resumeBook.pageCount) * 100))}% complete
                          </span>
                        )}
                      </div>
                      {resumeBook.pageCount > 0 && (
                        <div className="mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-emerald-500/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
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
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60 sm:flex-none"
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
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground/50 shadow-sm backdrop-blur-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500 sm:h-9 sm:w-9 dark:hover:border-red-800/30 dark:hover:bg-red-950/20"
                      title="Dismiss"
                      aria-label="Dismiss resume card"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <section>
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    <BookOpen className="h-3 w-3" />
                    Library
                  </div>
                  <p className="mt-1.5 text-lg font-bold text-foreground">
                    Continue where you left off
                  </p>
                </div>
                <span className="text-xs text-muted-foreground/50">
                  {recentBookCards.length} book{recentBookCards.length !== 1 ? 's' : ''}
                </span>
              </div>

              {recentPdfsLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex min-h-[180px] animate-pulse flex-col justify-between rounded-xl border bg-background/60 p-5"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-muted/70" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-3 w-3/4 rounded bg-muted/70" />
                          <div className="h-2 w-1/2 rounded bg-muted/70" />
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="h-2 w-full rounded bg-muted/70" />
                        <div className="h-4 w-full rounded bg-muted/70" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentBookCards.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {recentBookCards.map((pdf) => (
                    <button
                      key={pdf.fileName}
                      onClick={() => handleLoadRecentPdf(pdf.fileName)}
                      disabled={pdf.isLoading}
                      className="group relative flex min-h-[180px] flex-col justify-between overflow-hidden rounded-xl border bg-background/60 p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/5 disabled:cursor-wait disabled:opacity-60"
                    >
                      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-500/5 transition-all group-hover:bg-emerald-500/10" />
                      <div className="relative flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm">
                          {pdf.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground" title={pdf.fileName}>
                            {pdf.fileName}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{timeAgo(pdf.timestamp)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="relative mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Page {pdf.lastPage}{pdf.pageCount > 0 ? ` of ${pdf.pageCount}` : ''}
                          </span>
                          {pdf.pageCount > 0 && <span className="font-medium text-foreground">{pdf.progress}%</span>}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                            style={{ width: `${pdf.pageCount > 0 ? pdf.progress : 12}%` }}
                          />
                        </div>
                      </div>

                      <div className="relative mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                            {pdf.wordCount}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                            {pdf.bookmarkCount}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-emerald-500 transition-all group-hover:translate-x-1" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-dashed bg-gradient-to-br from-background to-muted/30 p-10 text-center">
                  <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl" />
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                    <BookOpen className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-foreground">No recent books yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground/60">Upload a PDF above and your library will appear here.</p>
                </div>
              )}
            </section>
          </div>
        </main>
      )}
      <ShareSessionPanel />
    </div>
  )
}
