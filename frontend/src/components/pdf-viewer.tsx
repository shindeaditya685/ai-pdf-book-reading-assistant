'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as pdfjsLib from 'pdfjs-dist'
import { useAuth } from '@/context/auth-context'
import { setActiveBook, setStoredBookPage, getStoredBookPage, getActiveBook } from '@/lib/reading-progress'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { lookupWord } from '@/lib/dictionary'
import { PdfPage } from '@/components/pdf-page'
import { AIQuotaBadge } from '@/components/ai-quota-badge'
import { AIQuotaModal } from '@/components/ai-quota-modal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAIQuota, remainingFor } from '@/hooks/use-ai-quota'
import {
  X,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Search,
  Bookmark,
  Clock,
  Brain,
  StickyNote,
  Users,
  HelpCircle,
  Sparkles,
  Volume2,
  AlignJustify,
  BookOpen,
  Quote as QuoteIcon,
  MoreVertical,
  Menu,
  Ruler,
  Focus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AnnotationToolbar } from '@/components/annotation-toolbar'
import { SettingsPanel } from '@/components/settings-panel'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

import { WordConfirmTooltip } from '@/components/word-confirm-tooltip'
import { SelectionContextMenu } from '@/components/selection-context-menu'
import { ReaderLine } from '@/components/reader-line'

// Set worker source
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
}

export function PDFViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const pageTextCacheRef = useRef<Map<number, string>>(new Map())
  // Performance/race fix (P8): previously a single boolean `ocrCancelledRef`
  // was shared across OCR runs. Toggling OCR off→on quickly caused the old
  // run's finally-block to see `false` and prematurely clear the new run's
  // `isOcrProcessing` flag. A generation counter invalidates stale runs
  // cleanly: each run captures its generation; if the counter has moved by
  // the time the run finishes, the run is stale and must not touch state.
  const ocrGenerationRef = useRef(0)
  const ocrCancelledRef = useRef(false)
  const saveProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readingLogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartRef = useRef<number>(Date.now())
  const lastLoggedPageRef = useRef<number>(0)
  const resumeScrollPageRef = useRef<number | null>(null)
  const prevScaleRef = useRef(0)
  const isZoomingRef = useRef(false)
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { user } = useAuth()
  const username = user?.username
  const quota = useAIQuota(!!user)
  const [quotaModalOpen, setQuotaModalOpen] = useState(false)
  const lastSavedPageRef = useRef<{ page: number; fileName: string | null }>({ page: 0, fileName: null })

  // Mobile reading improvements
  const [showToolbar, setShowToolbar] = useState(true)
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  const touchStartTimeRef = useRef(0)
  const SWIPE_THRESHOLD = 40
  const SWIPE_TIME_MAX = 300
  const showToolbarTemp = useCallback(() => {
    setShowToolbar(true)
  }, [])
  const quotaReady = !quota.loading && !quota.error
  const questionQuotaBlocked = quotaReady && !quota.isUnlimited && remainingFor(quota, 'question') === 0
  const summaryQuotaBlocked = quotaReady && !quota.isUnlimited && remainingFor(quota, 'summary') === 0

  useEffect(() => {
    const onChanged = () => quota.refresh()
    const onExceeded = () => setQuotaModalOpen(true)
    window.addEventListener('ai-quota-changed', onChanged)
    window.addEventListener('ai-quota-exceeded', onExceeded)
    return () => {
      window.removeEventListener('ai-quota-changed', onChanged)
      window.removeEventListener('ai-quota-exceeded', onExceeded)
    }
  }, [quota.refresh])

  const [isLoading, setIsLoading] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [renderErrorCount, setRenderErrorCount] = useState(0)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  const {
    pdfDataUrl,
    currentPage,
    totalPages,
    scale,
    setCurrentPage,
    setTotalPages,
    setScale,
    setSelectedWord,
    setSelectedSentence,
    setSelectedPageNumber,
    setPopupPosition,
    setExplanation,
    setIsExplaining,
    setIsOfflineResult,
    clearSelection,
    translationLanguage,
    accent,
    scrollMode,
    setScrollMode,
    searchQuery,
    showSearch,
    toggleSearch,
    toggleHistory,
    toggleBookmarks,
    toggleQuotes,
    toggleFlashcards,
    togglePageNotes,
    toggleReadingStats,
    toggleSharePanel,
    showQuestionGenerator,
    toggleQuestionGenerator,
    showSummarizer,
    toggleSummarizer,
    ocrEnabled,
    ocrText,
    setOcrText,
    isOcrProcessing,
    setIsOcrProcessing,
    ocrProgress,
    setOcrProgress,
    annotationMode,
    annotations,
    setAnnotations,
    addAnnotation,
    removeAnnotation,
    setAnnotationMode,
    undo,
    redo,
    pdfFileName,
    shareSession,
    setMousePosition,
    followMode,
    remotePages,
    focusMode,
    setFocusMode,
    setPdfDataUrl,
    readerAidMode,
    setReaderAidMode,
  } = usePDFStore()

  if (prevScaleRef.current === 0) prevScaleRef.current = scale

  // Pending word confirmation state
  const [pendingWord, setPendingWord] = useState<{
    word: string
    sentence: string
    pageNumber: number
    position: { x: number; y: number }
  } | null>(null)

  // Load PDF document
  useEffect(() => {
    if (!pdfDataUrl) {
      // Performance fix (P4): destroy the previous PDF document to release
      // worker ports, page caches, and font caches. Previously only the ref
      // was nulled, leaking pdfjs resources across PDF switches.
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(() => {})
        pdfDocRef.current = null
      }
      resumeScrollPageRef.current = null
      setTotalPages(0)

      setPdfReady(false)
      pageTextCacheRef.current.clear()
      return
    }

    let cancelled = false
    const prevPdf = pdfDocRef.current

    const loadPDF = async () => {
      setIsLoading(true)
      setPdfReady(false)
      try {
        const loadingTask = pdfjsLib.getDocument(pdfDataUrl)
        const pdf = await loadingTask.promise
        if (cancelled) {
          pdf.destroy().catch(() => {})
          return
        }
        // Destroy the previous document now that the new one is loaded.
        if (prevPdf && prevPdf !== pdf) {
          prevPdf.destroy().catch(() => {})
        }
        pdfDocRef.current = pdf
        setTotalPages(pdf.numPages)

        let restoredPage: number
        if (pdfFileName) {
          const stored = getStoredBookPage(username, pdfFileName)
          const recentMatch = usePDFStore
            .getState()
            .recentPdfs.find((p) => p.fileName === pdfFileName)
          const recentLastPage = recentMatch?.lastPage
          const activeBook = getActiveBook(username)
          const storePage = usePDFStore.getState().currentPage
          const requestedFromStore = activeBook === pdfFileName ? storePage : 0

          const candidates = [stored, recentLastPage, requestedFromStore, 1].filter(
            (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
          )
          restoredPage = Math.min(Math.max(1, Math.max(...candidates)), pdf.numPages)
        } else {
          restoredPage = Math.min(Math.max(1, usePDFStore.getState().currentPage || 1), pdf.numPages)
        }
        resumeScrollPageRef.current = usePDFStore.getState().scrollMode ? restoredPage : null
        setCurrentPage(restoredPage)
        if (pdfFileName) {
          const { addRecentPdf } = usePDFStore.getState()
          addRecentPdf({
            fileName: pdfFileName,
            timestamp: Date.now(),
            pageCount: pdf.numPages,
            lastPage: restoredPage,
          })
        }
        pageTextCacheRef.current.clear()
        setPdfReady(true)
        setLoadError(null)
        setRenderErrorCount(0)
      } catch (err: any) {
        console.error('Error loading PDF:', err)
        // UX fix (P6/U6): surface the failure to the user instead of a silent
        // "No PDF loaded" empty state.
        const msg = err?.message || ''
        setLoadError(
          /password/i.test(msg)
            ? 'This PDF is password-protected. Remove the password and re-upload.'
            : /invalid|corrupt/i.test(msg)
              ? 'This PDF appears to be corrupted or invalid. Try re-downloading the original.'
              : 'Could not open this PDF. The file may be corrupted or unsupported.'
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadPDF()
    return () => {
      cancelled = true
    }
  }, [pdfDataUrl, pdfFileName, setCurrentPage, setTotalPages])

  // Periodic cleanup: release cached page objects so pdfjs worker doesn't
  // OOM on memory-constrained environments (Render, mobile, etc.).
  // The virtual scroll window (P3) creates and destroys PdfPage components
  // as the user scrolls; each mount calls pdf.getPage(), accumulating page
  // objects in the worker. Periodic cleanup prevents unbounded growth.
  useEffect(() => {
    if (!pdfReady) return
    const interval = setInterval(() => {
      pdfDocRef.current?.cleanup().catch(() => {})
    }, 30_000)
    return () => clearInterval(interval)
  }, [pdfReady])

  // Persist active book + page progress
  useEffect(() => {
    if (!pdfDataUrl || !pdfFileName || totalPages <= 0) return

    const safePage = Math.min(Math.max(1, currentPage), totalPages)
    setActiveBook(username, pdfFileName)
    setStoredBookPage(username, pdfFileName, safePage)
    const { addRecentPdf } = usePDFStore.getState()
    addRecentPdf({
      fileName: pdfFileName,
      timestamp: Date.now(),
      pageCount: totalPages,
      lastPage: safePage,
    })

    if (saveProgressTimerRef.current) {
      clearTimeout(saveProgressTimerRef.current)
    }

    saveProgressTimerRef.current = setTimeout(() => {
      authFetch('/api/db/pdf', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: pdfFileName,
          lastPage: safePage,
          pageCount: totalPages,
        }),
      }).catch(() => {})
    }, 500)

    return () => {
      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current)
      }
    }
  }, [currentPage, pdfDataUrl, pdfFileName, totalPages, username])

  // Synchronous page-save: keep `lastSavedPageRef` in sync with currentPage
  // so the pagehide / beforeunload flush below can write to localStorage
  // even if React unmounts the component before the next paint.
  useEffect(() => {
    if (!pdfFileName || totalPages <= 0) return
    const safePage = Math.min(Math.max(1, currentPage), totalPages)
    if (lastSavedPageRef.current.fileName === pdfFileName && lastSavedPageRef.current.page === safePage) return
    lastSavedPageRef.current = { page: safePage, fileName: pdfFileName }
    setActiveBook(username, pdfFileName)
    setStoredBookPage(username, pdfFileName, safePage)
  }, [currentPage, pdfFileName, totalPages, username])

  // Flush the latest page to localStorage AND MongoDB on tab close / navigation away.
  // The 500ms debounced PATCH above can be cancelled by React unmount cleanup if the
  // user closes the tab within 500ms of navigating. We use `keepalive: true` so the
  // fetch is guaranteed to complete even as the page unloads.
  useEffect(() => {
    const flush = () => {
      const { page, fileName } = lastSavedPageRef.current
      if (!fileName || page <= 0) return
      setActiveBook(username, fileName)
      setStoredBookPage(username, fileName, page)

      // Best-effort DB flush. If the user isn't logged in, the PATCH will 401 silently.
      // `keepalive: true` lets the request complete even as the page unloads.
      try {
        const token = window.localStorage?.getItem('auth-token')
        if (!token) return
        const body = JSON.stringify({ fileName, lastPage: page })
        fetch('/api/db/pdf', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body,
          keepalive: true,
        }).catch(() => {})
      } catch {
        // Ignore — localStorage is already updated; DB will catch up on next mount.
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [username])

  // Log reading activity (debounced)
  useEffect(() => {
    if (!pdfDataUrl || !pdfFileName || currentPage <= 0 || currentPage === lastLoggedPageRef.current) return

    const now = Date.now()
    const timeSinceLastPage = now - sessionStartRef.current
    sessionStartRef.current = now
    lastLoggedPageRef.current = currentPage

    if (readingLogTimerRef.current) {
      clearTimeout(readingLogTimerRef.current)
    }

    readingLogTimerRef.current = setTimeout(() => {
      authFetch('/api/reading-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagesRead: 1,
          timeSpentMs: Math.min(timeSinceLastPage, 120000),
          pdfFileName: pdfFileName || undefined,
        }),
      }).catch(() => {})
      authFetch('/api/reading-stats?days=1').then((res) => {
        if (res.ok) res.json().then((data) => {
          if (data.today) {
            usePDFStore.getState().setTodayStats(
              data.today.pagesRead || 0,
              data.today.timeSpentMs ? Math.round(data.today.timeSpentMs / 60000) : 0
            )
            usePDFStore.getState().setStreakCount(data.streak || 0)
          }
        })
      }).catch(() => {})
    }, 2000)

    return () => {
      if (readingLogTimerRef.current) {
        clearTimeout(readingLogTimerRef.current)
      }
    }
  }, [currentPage, pdfDataUrl, pdfFileName])

  // OCR processing
  useEffect(() => {
    const pdf = pdfDocRef.current
    if (!ocrEnabled || !pdf || totalPages === 0) return

    // Increment generation so any in-flight OCR run is invalidated.
    const myGen = ++ocrGenerationRef.current
    ocrCancelledRef.current = false
    setIsOcrProcessing(true)
    setOcrProgress(0)

    const runOcr = async () => {
      let worker: any = null
      const ocrCanvas = document.createElement('canvas')
      try {
        const { createWorker } = await import('tesseract.js')
        worker = await createWorker('eng')

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          // Stale if generation moved OR the legacy cancel flag was set.
          if (ocrGenerationRef.current !== myGen || ocrCancelledRef.current) break

          try {
            const page = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale: 2 })
            ocrCanvas.width = viewport.width
            ocrCanvas.height = viewport.height
            const ctx = ocrCanvas.getContext('2d')
            if (!ctx) continue

            await page.render({ canvasContext: ctx, viewport }).promise

            const blob = await new Promise<Blob | null>((resolve) =>
              ocrCanvas.toBlob(resolve, 'image/png')
            )
            // Performance fix (P7): free the canvas backing store between
            // pages. A scale=2 letter page is ~15MB of pixels; holding it
            // across the (slow) Tesseract call balloons memory for big PDFs.
            ocrCanvas.width = 0
            ocrCanvas.height = 0
            if (!blob) continue

            const ocrResult: any = await worker.recognize(blob)
            const imageWords: any[] = ocrResult.data?.words || []
            const words = imageWords
              .filter((w: any) => w.text.trim())
              .map((w: any) => ({
                text: w.text.trim(),
                x: w.bbox.x0,
                y: w.bbox.y0,
                width: w.bbox.x1 - w.bbox.x0,
                height: w.bbox.y1 - w.bbox.y0,
              }))

            setOcrText(pageNum, {
              text: ocrResult.data.text,
              words,
              width: viewport.width,
              height: viewport.height,
            })
          } catch {
            // skip failed page
          }

          if (ocrGenerationRef.current === myGen) {
            setOcrProgress(Math.round((pageNum / totalPages) * 100))
          }
        }

        if (ocrGenerationRef.current === myGen && !ocrCancelledRef.current) {
          const state = usePDFStore.getState()
          const fileName = state.pdfFileName
          if (fileName) {
            const allOcrText: any = {}
            for (const [page, data] of Object.entries(state.ocrText)) {
              allOcrText[page] = data
            }
            authFetch('/api/db/pdf', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName, ocrText: allOcrText }),
            }).catch(() => {})
          }
        }
      } catch {
        // OCR failed
      } finally {
        if (worker) await worker.terminate()
        // Only clear processing state if THIS run is still current.
        if (ocrGenerationRef.current === myGen) {
          setIsOcrProcessing(false)
          setOcrProgress(100)
        }
      }
    }

    runOcr()

    return () => {
      // Invalidate this run on cleanup (PDF switch, OCR toggle off, unmount).
      ocrCancelledRef.current = true
      ocrGenerationRef.current++ // ensures any in-flight iteration exits
    }
  }, [ocrEnabled, totalPages, setOcrText, setIsOcrProcessing, setOcrProgress])

  const fetchExplanation = useCallback(
    async (word: string, sentence: string, pageNum: number) => {
      setIsExplaining(true)
      setExplanation(null)
      let aiOk = false
      try {
        const res = await authFetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, sentence, pageNumber: pageNum, translationLanguage, accent }),
        })
        const data = await res.json()
        if (!data.error) {
          setExplanation(data)
          setIsOfflineResult(false)
          aiOk = true
        } else if (res.status === 429) {
          quota.refresh()
          setQuotaModalOpen(true)
        }
        if (aiOk) quota.refresh()
      } catch {}
      if (aiOk) { setIsExplaining(false); return }
      try {
        const dictResult = await lookupWord(word, accent)
        if (dictResult) {
          setExplanation({
            word: dictResult.word,
            meaning: dictResult.meaning,
            pronunciation: dictResult.pronunciation,
            translation: '',
            example: dictResult.example || undefined,
            partOfSpeech: dictResult.partOfSpeech || undefined,
          })
        } else {
          setExplanation({ word, meaning: 'Word not found.', pronunciation: '', translation: '' })
        }
      } catch {
        setExplanation({ word, meaning: 'Failed to get meaning. Please try again.', pronunciation: '', translation: '' })
      }
      setIsOfflineResult(true)
      setIsExplaining(false)
    },
    [setExplanation, setIsExplaining, setIsOfflineResult, translationLanguage, accent, quota.refresh]
  )

  // Load annotations
  useEffect(() => {
    setAnnotations([])
    if (!pdfFileName) return

    const fetchAnnotations = async () => {
      try {
        const res = await authFetch(`/api/db/annotations?pdfFileName=${encodeURIComponent(pdfFileName)}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            const mapped = data.map((ann: any) => ({
              id: ann.annotationId || ann._id?.toString() || `ann-${Date.now()}-${Math.random()}`,
              pdfFileName: ann.pdfFileName,
              pageNumber: ann.pageNumber,
              type: ann.type,
              color: ann.color,
              rects: ann.rects,
              points: ann.points,
              thickness: ann.thickness,
              noteText: ann.noteText,
              x: ann.x,
              y: ann.y,
              timestamp: ann.timestamp ? new Date(ann.timestamp).getTime() : Date.now(),
            }))
            setAnnotations(mapped)
          }
        }
      } catch (err) {
        console.error('Failed to load annotations:', err)
      }
    }

    fetchAnnotations()
  }, [pdfFileName, setAnnotations])

  // Save annotation to MongoDB
  const saveAnnotationToDb = useCallback(async (ann: any) => {
    try {
      const personalRes = await authFetch('/api/db/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ann),
      })
      if (!personalRes.ok) console.error('[Sync] Personal annotation save failed:', await personalRes.text())
      const session = usePDFStore.getState().shareSession
      if (session) {
        const sharedRes = await authFetch('/api/share/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...ann, sessionId: session._id }),
        })
        if (sharedRes.ok) {
          const sharedAnn = await sharedRes.json()
          usePDFStore.getState().addSharedAnnotation(sharedAnn)
        } else {
          console.error('[Sync] Shared annotation save failed:', await sharedRes.text())
        }
      }
    } catch (err) {
      console.error('Failed to sync annotation to db:', err)
    }
  }, [])

  const deleteAnnotationFromDb = useCallback(async (id: string) => {
    try {
      await authFetch(`/api/db/annotations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const session = usePDFStore.getState().shareSession
      if (session) {
        await authFetch(`/api/share/annotations?id=${encodeURIComponent(id)}&sessionId=${encodeURIComponent(session._id)}`, {
          method: 'DELETE',
        })
        usePDFStore.getState().removeSharedAnnotation(id)
      }
    } catch (err) {
      console.error('Failed to delete annotation from db:', err)
    }
  }, [])

  // Clear annotations on the current (in-view) page
  // UX fix (U8): replace native confirm() with a state-driven dialog.
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const handleClearAllPageAnnotations = useCallback(async () => {
    const pageAnns = annotations.filter((a) => a.pageNumber === currentPage)
    if (pageAnns.length === 0) return
    setShowClearConfirm(true)
  }, [annotations, currentPage])

  const confirmClearPageAnnotations = useCallback(() => {
    const pageAnns = annotations.filter((a) => a.pageNumber === currentPage)
    for (const ann of pageAnns) {
      removeAnnotation(ann.id)
      deleteAnnotationFromDb(ann.id)
    }
    setShowClearConfirm(false)
  }, [annotations, currentPage, removeAnnotation, deleteAnnotationFromDb])

  // Word-picked callback from PdfPage
  const handleWordPicked = useCallback(
    (word: string, sentence: string, pageNumber: number, position: { x: number; y: number }) => {
      setPendingWord({ word, sentence, pageNumber, position })
    },
    []
  )

  // Render-error callback from PdfPage — auto-reload on too many failures
  const handleRenderError = useCallback(() => {
    setRenderErrorCount((prev) => {
      const next = prev + 1
      if (next >= 3 && pdfDocRef.current && pdfDataUrl) {
        console.log('[pdf-viewer] auto-reloading after', next, 'page render failures')
        pdfDocRef.current.destroy().catch(() => {})
        pdfDocRef.current = null
        setPdfReady(false)
        setRenderErrorCount(0)
      }
      return next
    })
  }, [pdfDataUrl])

  const handleConfirmMeaning = useCallback(() => {
    if (!pendingWord) return
    const { word, sentence, pageNumber, position } = pendingWord
    setSelectedWord(word)
    setSelectedSentence(sentence)
    setSelectedPageNumber(pageNumber)
    setPopupPosition(position)
    fetchExplanation(word, sentence, pageNumber)
    setPendingWord(null)
  }, [pendingWord, setSelectedWord, setSelectedSentence, setSelectedPageNumber, setPopupPosition, fetchExplanation])

  // Listen for "Get meaning" requests from the right-click selection context
  // menu. The menu dispatches a CustomEvent with the word + cursor coords
  // captured at right-click time; we run the same flow as handleConfirmMeaning.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ word: string; sentence: string; pageNumber: number; x: number; y: number }>).detail
      if (!detail || !detail.word) return
      setSelectedWord(detail.word)
      setSelectedSentence(detail.sentence || detail.word)
      setSelectedPageNumber(detail.pageNumber)
      setPopupPosition({ x: detail.x, y: detail.y })
      fetchExplanation(detail.word, detail.sentence || detail.word, detail.pageNumber)
      // We're opening the real meaning popup, so the confirm-tooltip is no
      // longer needed.
      setPendingWord(null)
    }
    window.addEventListener('pdf-get-meaning', handler)
    return () => window.removeEventListener('pdf-get-meaning', handler)
  }, [setSelectedWord, setSelectedSentence, setSelectedPageNumber, setPopupPosition, fetchExplanation])

  // Listen for "Translate" requests from the right-click selection context
  // menu. Translates the full selected text using the /api/simplify endpoint
  // (which handles full sentences and returns translations).
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; pageNumber: number; x: number; y: number }>).detail
      if (!detail || !detail.text) return
      setSelectedWord(detail.text)
      setSelectedSentence(detail.text)
      setSelectedPageNumber(detail.pageNumber)
      setPopupPosition({ x: detail.x, y: detail.y })
      setPendingWord(null)

      setIsExplaining(true)
      setExplanation(null)
      try {
        const lang = translationLanguage !== 'none' ? translationLanguage : 'hi'
        const res = await authFetch('/api/simplify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentence: detail.text,
            translationLanguage: lang,
          }),
        })
        const data = await res.json()
        if (data.translation) {
          setExplanation({
            word: detail.text,
            meaning: data.simplified || detail.text,
            pronunciation: '',
            translation: data.translation,
          })
          setIsOfflineResult(false)
        } else if (data.error) {
          setExplanation({ word: detail.text, meaning: data.error, pronunciation: '', translation: '' })
        } else {
          setExplanation({ word: detail.text, meaning: 'No translation available', pronunciation: '', translation: '' })
        }
      } catch {
        setExplanation({ word: detail.text, meaning: 'Translation failed. Please try again.', pronunciation: '', translation: '' })
      }
      setIsExplaining(false)
    }
    window.addEventListener('pdf-translate-text', handler)
    return () => window.removeEventListener('pdf-translate-text', handler)
  }, [setSelectedWord, setSelectedSentence, setSelectedPageNumber, setPopupPosition, setIsExplaining, setExplanation, setIsOfflineResult, translationLanguage])

  // Listen for "Simplify sentence" requests from the right-click selection
  // context menu. Simplifies the full selected sentence using /api/simplify.
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ sentence: string; x: number; y: number }>).detail
      if (!detail || !detail.sentence) return
      setSelectedWord(detail.sentence)
      setSelectedSentence(detail.sentence)
      setPopupPosition({ x: detail.x, y: detail.y })
      setPendingWord(null)

      setIsExplaining(true)
      setExplanation(null)
      try {
        const res = await authFetch('/api/simplify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentence: detail.sentence,
            translationLanguage: 'none',
          }),
        })
        const data = await res.json()
        if (data.simplified) {
          setExplanation({
            word: detail.sentence,
            meaning: data.simplified,
            pronunciation: '',
            translation: data.translation || '',
          })
          setIsOfflineResult(false)
        } else if (data.error) {
          setExplanation({ word: detail.sentence, meaning: data.error, pronunciation: '', translation: '' })
        } else {
          setExplanation({ word: detail.sentence, meaning: 'Could not simplify', pronunciation: '', translation: '' })
        }
      } catch {
        setExplanation({ word: detail.sentence, meaning: 'Failed to simplify. Please try again.', pronunciation: '', translation: '' })
      }
      setIsExplaining(false)
    }
    window.addEventListener('pdf-simplify-sentence', handler)
    return () => window.removeEventListener('pdf-simplify-sentence', handler)
  }, [setSelectedWord, setSelectedSentence, setPopupPosition, setIsExplaining, setExplanation, setIsOfflineResult])

  // The right-click selection context menu dispatches this when it opens so
  // the "Get meaning?" tooltip from the prior left-mouse mouseup is dismissed.
  useEffect(() => {
    const handler = () => setPendingWord(null)
    window.addEventListener('pdf-clear-pending-word', handler)
    return () => window.removeEventListener('pdf-clear-pending-word', handler)
  }, [])

  const handleReadAloud = useCallback(async () => {
    ;(window as any).__ttsStop?.()
    const sel = window.getSelection()
    let text = ''
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      text = sel.toString().trim()
    } else {
      const pdf = pdfDocRef.current
      if (!pdf) return
      const page = await pdf.getPage(currentPage)
      const textContent = await page.getTextContent()
      const items = (textContent.items as any[]).filter((item) => 'str' in item)
      text = items.map((item) => item.str).join(' ')
    }
    if (!text.trim()) return
    ;(window as any).__ttsStart?.(text.trim())
  }, [currentPage])

  // Scroll the container to a specific page (used in scroll mode for prev/next/jump)
  const scrollToPage = useCallback(
    (page: number) => {
      clearSelection()
      if (scrollMode && page !== currentPage) {
        // Mute the IntersectionObserver during programmatic navigation. Without
        // this, the observer snaps `currentPage` back to whatever intermediate
        // page is most visible mid-scroll, so typing a page number only lands
        // on the exact page the second time (once the target content is loaded).
        // The `resumeScrollPageRef` layout effect below performs the exact scroll.
        resumeScrollPageRef.current = page
      }
      setCurrentPage(page)
    },
    [scrollMode, setCurrentPage, clearSelection, currentPage]
  )

  // Local buffer for the page number input so the user can type freely
  // and only commit to navigation on Enter / blur (like Adobe Acrobat).
  // Synced with `currentPage` when it changes externally (prev/next, follow mode, etc.)
  const [pageInput, setPageInput] = useState<string>(String(currentPage))
   
  useEffect(() => { setPageInput(String(currentPage)) }, [currentPage])
  const commitPageInput = useCallback(() => {
    const parsed = parseInt(pageInput, 10)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= totalPages && parsed !== currentPage) {
      scrollToPage(parsed)
    } else {
      setPageInput(String(currentPage))
    }
  }, [pageInput, totalPages, currentPage, scrollToPage])

  // Local buffer for the zoom input (displayed as %). Same pattern: only commits on Enter / blur.
  const ZOOM_MIN = 50
  const ZOOM_MAX = 300
  const [zoomInput, setZoomInput] = useState<string>(String(Math.round(scale * 100)))
   
  useEffect(() => { setZoomInput(String(Math.round(scale * 100))) }, [scale])
  const commitZoomInput = useCallback(() => {
    const parsed = parseInt(zoomInput, 10)
    if (Number.isFinite(parsed) && parsed >= ZOOM_MIN && parsed <= ZOOM_MAX) {
      const next = parsed / 100
      if (Math.abs(next - scale) > 0.0001) setScale(next)
      else setZoomInput(String(Math.round(scale * 100)))
    } else {
      setZoomInput(String(Math.round(scale * 100)))
    }
  }, [zoomInput, scale, setScale])

  useLayoutEffect(() => {
    if (!scrollMode) {
      resumeScrollPageRef.current = null
      return
    }
    if (!pdfReady || !containerRef.current) return
    const targetPage = resumeScrollPageRef.current
    if (!targetPage || targetPage < 1 || targetPage > totalPages) return

    let clearTimer: ReturnType<typeof setTimeout> | null = null
    const frame = requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector(`[data-page="${targetPage}"]`)
      if (!target) {
        resumeScrollPageRef.current = null
        return
      }

      ;(target as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'start' })
      clearTimer = setTimeout(() => {
        if (resumeScrollPageRef.current === targetPage) {
          resumeScrollPageRef.current = null
        }
      }, 150)
    })

    return () => {
      cancelAnimationFrame(frame)
      if (clearTimer) clearTimeout(clearTimer)
    }
  }, [currentPage, pdfDataUrl, pdfReady, scrollMode, totalPages])

  // Re-center current page when zoom changes in scroll mode, so the
  // IntersectionObserver doesn't pick a different page after resize.
  useLayoutEffect(() => {
    if (!scrollMode || !pdfReady || !containerRef.current) return
    const zoomChanged = prevScaleRef.current !== scale
    prevScaleRef.current = scale
    if (!zoomChanged) return

    // Set zooming flag to ignore IntersectionObserver updates during transition
    isZoomingRef.current = true
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
    zoomTimeoutRef.current = setTimeout(() => {
      isZoomingRef.current = false
    }, 1000)

    const target = containerRef.current.querySelector(`[data-page="${currentPage}"]`)
    if (target) {
      ;(target as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }, [scale, scrollMode, pdfReady, currentPage])

  // Track current page in scroll mode via IntersectionObserver.
  // Must be useLayoutEffect so the old observer is disconnected
  // BEFORE paint; otherwise the old observer's callback fires after
  // paint (between useLayoutEffect and useEffect) and overwrites
  // currentPage with whichever page happens to be most visible after
  // the zoom resize — before our scroll correction takes effect.
  useLayoutEffect(() => {
    if (!scrollMode || !pdfReady || totalPages === 0) return
    const container = containerRef.current
    if (!container) return

    const visibility = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        // If we are currently zooming, ignore intersection changes to prevent jumping pages
        if (isZoomingRef.current) return

        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page)
          if (!page) continue
          visibility.set(page, entry.intersectionRatio)
        }
        // Pick the page with the highest visibility
        let bestPage: number | null = null
        let bestRatio = 0
        for (const [page, ratio] of visibility.entries()) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestPage = page
          }
        }
        if (resumeScrollPageRef.current) return
        if (bestPage && bestRatio > 0 && bestPage !== usePDFStore.getState().currentPage) {
          usePDFStore.getState().setCurrentPage(bestPage)
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    const wrappers = container.querySelectorAll('[data-page]')
    wrappers.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [scrollMode, pdfReady, totalPages, scale])

  // Follow mode: auto-navigate when leader changes page
  useEffect(() => {
    if (!followMode || !shareSession) return
    const leader = shareSession.members.find((m) => m.username !== username)
    if (!leader) return
    const leaderPage = remotePages[leader.username]
    if (leaderPage && leaderPage !== currentPage && leaderPage >= 1 && leaderPage <= totalPages) {
      scrollToPage(leaderPage)
    }
  }, [followMode, remotePages, shareSession, currentPage, totalPages, username, scrollToPage])

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) scrollToPage(currentPage - 1)
  }, [currentPage, scrollToPage])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) scrollToPage(currentPage + 1)
  }, [currentPage, totalPages, scrollToPage])

  const zoomIn = useCallback(() => { setScale(Math.min(scale + 0.25, 3)) }, [scale, setScale])
  const zoomOut = useCallback(() => { setScale(Math.max(scale - 0.25, 0.5)) }, [scale, setScale])

  // Cycle the reading aid: off -> line -> focus -> off
  const cycleReaderAid = useCallback(() => {
    const order: ['off', 'line', 'focus'] = ['off', 'line', 'focus']
    const idx = order.indexOf(readerAidMode)
    setReaderAidMode(order[(idx + 1) % order.length])
  }, [readerAidMode, setReaderAidMode])

  // Keyboard shortcuts: Arrow keys for page navigation
  // 1=Select, 2=Highlight, 3=Pen, 4=Eraser, 5=Sticky note, Ctrl/Cmd+Z=Undo, Ctrl/Cmd+Shift+Z=Redo
  useEffect(() => {
    if (!pdfDataUrl) return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (isInput) return

      const mod = e.ctrlKey || e.metaKey

      // Undo / Redo
      if (mod && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      // Zoom: Ctrl+= / Ctrl++ / Ctrl+-
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomIn()
        return
      }
      if (mod && e.key === '-') {
        e.preventDefault()
        zoomOut()
        return
      }
      if (mod && !e.shiftKey && e.key === '0') {
        e.preventDefault()
        setScale(1)
        return
      }

      // Skip letter shortcuts when modifier is held
      if (mod || e.altKey) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          goToPrevPage()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNextPage()
          break
        case '1':
          e.preventDefault()
          setAnnotationMode('select')
          break
        case '2':
          e.preventDefault()
          setAnnotationMode('highlight')
          break
        case '3':
          e.preventDefault()
          setAnnotationMode('pen')
          break
        case '4':
          e.preventDefault()
          setAnnotationMode('eraser')
          break
        case '5':
          e.preventDefault()
          setAnnotationMode('note')
          break
        case 'l':
        case 'L':
          e.preventDefault()
          cycleReaderAid()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pdfDataUrl, setAnnotationMode, undo, redo, goToPrevPage, goToNextPage, cycleReaderAid])

  // Clear selection when clicking outside the text layer
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-popup]') && !target.closest('span')) {
      clearSelection()
      setPendingWord(null)
    }
  }, [clearSelection])

  // Mobile: swipe left/right + tap edges to turn pages
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    touchStartXRef.current = e.touches[0].clientX
    touchStartYRef.current = e.touches[0].clientY
    touchStartTimeRef.current = Date.now()
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.changedTouches.length !== 1) return
    const dt = Date.now() - touchStartTimeRef.current
    const dx = e.changedTouches[0].clientX - touchStartXRef.current
    const dy = e.changedTouches[0].clientY - touchStartYRef.current
    const x = e.changedTouches[0].clientX
    const target = e.target as HTMLElement
    const isOnText = !!target.closest('.pdf-text-layer')

    // Quick horizontal swipe → page turn (works on text too)
    if (dt < SWIPE_TIME_MAX && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 2) {
      e.preventDefault()
      if (dx > 0) goToPrevPage()
      else goToNextPage()
      showToolbarTemp()
      return
    }

    if (dt > 300) return // Not a tap

    const vw = window.innerWidth
    const vh = window.innerHeight

    // Top zone tap (top 12% of screen) → always reveal toolbar, even on text
    if (e.changedTouches[0].clientY < vh * 0.12) {
      setShowToolbar(true)
      showToolbarTemp()
      return
    }

    // Center tap → toggle toolbar (only on empty space)
    if (x > vw * 0.3 && x < vw * 0.7 && !isOnText) {
      setShowToolbar(v => !v)
      return
    }

    // Edge tap → page turn (only on empty space, not text)
    if (!isOnText) {
      if (x < vw * 0.3) {
        goToPrevPage()
        showToolbarTemp()
        return
      }
      if (x > vw * 0.7) {
        goToNextPage()
        showToolbarTemp()
        return
      }
    }
  }, [goToPrevPage, goToNextPage, showToolbarTemp])

  if (!pdfDataUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-card/30">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 ring-1 ring-border/30">
            <svg className="h-10 w-10 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground/50">No PDF loaded</h3>
          <p className="mt-1 text-sm text-muted-foreground/50">Upload a PDF to start reading</p>
        </div>
      </div>
    )
  }

  // Performance fix (P2): the previous handler called setMousePosition on
  // every mousemove (60-120 Hz), writing to the store and re-rendering the
  // viewer (and, before the P1 fix, every PdfPage). We now RAF-throttle and
  // skip entirely when not in a share session (cursor sharing is the only
  // consumer of mousePosition).
  const mouseRafRef = useRef<number | null>(null)
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const handleThrottledMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!shareSession) return // no-op when not collaborating
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      if (mouseRafRef.current !== null) return
      mouseRafRef.current = requestAnimationFrame(() => {
        mouseRafRef.current = null
        setMousePosition(mousePosRef.current.x, mousePosRef.current.y)
      })
    },
    [shareSession, setMousePosition],
  )
  useEffect(() => {
    return () => {
      if (mouseRafRef.current !== null) cancelAnimationFrame(mouseRafRef.current)
    }
  }, [])

  return (
    <div className="relative h-full flex flex-col bg-muted/20">
      {/* ── TOOLBAR ── */}
      <AnimatePresence>
        {showToolbar && !focusMode && (
          <motion.header
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 inset-x-0 z-50 glass-strong border-b border-border"
          >
            <div className="flex items-center justify-between gap-1.5 px-3 py-2">
              {/* LEFT GROUP: Close, Divider, Title */}
              <div className="flex items-center gap-1.5 min-w-0">
                <Button variant="ghost" size="sm" onClick={() => setPdfDataUrl(null)} className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Close</span>
                </Button>

                <div className="h-4 w-px bg-border mx-1 shrink-0" />

                {/* PDF Title */}
                <div className="flex items-center gap-2 min-w-0 max-w-[120px] sm:max-w-[200px] md:max-w-[300px]">
                  <div className="hidden min-[400px]:flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand shrink-0">
                    <BookOpen className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-foreground truncate" title={pdfFileName || "Untitled PDF"}>
                    {pdfFileName || "Untitled PDF"}
                  </span>
                </div>
              </div>

              {/* CENTER GROUP: Page Nav & Zoom */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Page Nav */}
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevPage} disabled={currentPage <= 1} title="Previous Page">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 text-xs sm:text-sm tabular-nums">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={String(totalPages).length}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value.replace(/\D/g, '').slice(0, String(totalPages).length))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitPageInput() }
                        else if (e.key === 'Escape') { e.preventDefault(); setPageInput(String(currentPage)) }
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={commitPageInput}
                      className="w-10 sm:w-12 h-8 rounded border border-border bg-background text-center text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-brand focus-visible:outline-none"
                      aria-label="Page number"
                    />
                    <span className="text-muted-foreground">/ {totalPages}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextPage} disabled={currentPage >= totalPages} title="Next Page">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="hidden sm:block h-4 w-px bg-border mx-1 shrink-0" />

                {/* Zoom - Hidden on Mobile */}
                <div className="hidden sm:flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} disabled={scale <= 0.5} title="Zoom Out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs sm:text-sm tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} disabled={scale >= 3} title="Zoom In">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* RIGHT GROUP: View Toggles & Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Desktop View & Sidebar Toggles */}
                <div className="flex items-center gap-1">
                  {/* View Toggles */}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSearch} title="Search">
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button variant={scrollMode ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setScrollMode(!scrollMode)} title={scrollMode ? "Continuous scroll" : "Single page"}>
                    {scrollMode ? <AlignJustify className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleReadAloud} title="Read Aloud">
                    <Volume2 className="h-4 w-4" />
                  </Button>
                  <Button variant={readerAidMode !== 'off' ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={cycleReaderAid} title={`Reading aid: ${readerAidMode} (L)`}>
                    {readerAidMode === 'focus' ? <Focus className="h-4 w-4" /> : <Ruler className="h-4 w-4" />}
                  </Button>
                  <Button variant={!!shareSession ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={toggleSharePanel} title={shareSession ? `Session: ${shareSession.name}` : "Collaborate"}>
                    <Users className="h-4 w-4" />
                  </Button>

                  <div className="hidden lg:flex items-center gap-1">

                  <div className="h-4 w-px bg-border mx-1" />

                  {/* Sidebar Toggles */}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleBookmarks} title="Bookmarks (B)">
                    <Bookmark className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleHistory} title="History (H)">
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleQuotes} title="Quotes">
                    <QuoteIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFlashcards} title="Flashcards (G)">
                    <Brain className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePageNotes} title="Page Notes">
                    <StickyNote className="h-4 w-4" />
                  </Button>

                  <div className="h-4 w-px bg-border mx-1" />

                  {/* AI Tools */}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (questionQuotaBlocked) setQuotaModalOpen(true); else toggleQuestionGenerator() }} disabled={questionQuotaBlocked} title={questionQuotaBlocked ? "Daily question limit reached" : "AI Questions"}>
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (summaryQuotaBlocked) setQuotaModalOpen(true); else toggleSummarizer() }} disabled={summaryQuotaBlocked} title={summaryQuotaBlocked ? "Daily summary limit reached" : "AI Summarizer"}>
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  
                  <div className="h-4 w-px bg-border mx-1" />
                  <SettingsPanel />
                  </div>
                </div>

                {/* Mobile Dropdown Menu */}
                <div className="lg:hidden flex items-center gap-1.5">
                  <SettingsPanel />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="More Tools">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 z-[60]">
                      <DropdownMenuItem onClick={toggleSearch}>
                        <Search className="mr-2 h-4 w-4" />
                        <span>Search</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setScrollMode(!scrollMode)}>
                        {scrollMode ? <BookOpen className="mr-2 h-4 w-4" /> : <AlignJustify className="mr-2 h-4 w-4" />}
                        <span>{scrollMode ? "Single Page" : "Continuous Scroll"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleReadAloud}>
                        <Volume2 className="mr-2 h-4 w-4" />
                        <span>Read Aloud</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={cycleReaderAid}>
                        {readerAidMode === 'focus' ? <Focus className="mr-2 h-4 w-4" /> : <Ruler className="mr-2 h-4 w-4" />}
                        <span>Reading aid: {readerAidMode}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={toggleSharePanel}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Collaborate</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={toggleBookmarks}>
                        <Bookmark className="mr-2 h-4 w-4" />
                        <span>Bookmarks</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={toggleHistory}>
                        <Clock className="mr-2 h-4 w-4" />
                        <span>History</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={toggleQuotes}>
                        <QuoteIcon className="mr-2 h-4 w-4" />
                        <span>Quotes</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={toggleFlashcards}>
                        <Brain className="mr-2 h-4 w-4" />
                        <span>Flashcards</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={togglePageNotes}>
                        <StickyNote className="mr-2 h-4 w-4" />
                        <span>Page Notes</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => { if (questionQuotaBlocked) setQuotaModalOpen(true); else toggleQuestionGenerator() }}
                        disabled={questionQuotaBlocked}
                      >
                        <HelpCircle className="mr-2 h-4 w-4" />
                        <span>AI Questions</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => { if (summaryQuotaBlocked) setQuotaModalOpen(true); else toggleSummarizer() }}
                        disabled={summaryQuotaBlocked}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        <span>AI Summarizer</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <AIQuotaBadge state={quota} onClick={() => setQuotaModalOpen(true)} />
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Floating pill to re-show toolbar */}
      {!showToolbar && !focusMode && (
        <button
          onClick={() => { setShowToolbar(true); showToolbarTemp() }}
          className="fixed left-1/2 top-1 z-50 flex h-11 w-20 -translate-x-1/2 items-start justify-center pt-2"
          aria-label="Show toolbar"
        >
          <span className="h-1.5 w-14 rounded-full bg-white/60 backdrop-blur-sm transition-all hover:bg-white/80 active:scale-95 dark:bg-stone-500/40 dark:hover:bg-stone-500/60" />
        </button>
      )}

      {(isOcrProcessing || (ocrProgress > 0 && ocrProgress < 100)) && (
        <div className="flex items-center justify-center gap-2.5 border-b bg-card/40 px-4 py-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10">
            <svg className="h-3 w-3 animate-pulse text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v6h6M21 17a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">OCR in progress...</span>
          <Progress value={ocrProgress} className="h-1.5 w-24" />
          <span className="text-[11px] font-semibold text-brand tabular-nums">{ocrProgress}%</span>
        </div>
      )}

      <div className={`relative flex-1 overflow-hidden transition-all duration-200 ${showToolbar && !focusMode ? 'pt-14' : 'pt-0'}`}>
        <AnnotationToolbar onClearAll={handleClearAllPageAnnotations} />
        <ReaderLine containerRef={containerRef} />

        <div
          ref={containerRef}
          className="pdf-scroll-container h-full overflow-auto bg-card/30"
          onClick={handleContainerClick}
          onMouseMove={(e) => { handleThrottledMouseMove(e); showToolbarTemp() }}
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {loadError && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
              <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-lg">
                <svg className="h-10 w-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-muted-foreground">{loadError}</p>
                <button
                  onClick={() => {
                    setLoadError(null)
                    clearSelection()
                  }}
                  className="rounded-md border border-border bg-background px-4 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-8 w-8 animate-spin text-brand/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="40 60" />
                </svg>
                <p className="text-xs text-muted-foreground/50">Loading PDF...</p>
              </div>
            </div>
          )}

          {scrollMode ? (
            <div className="flex flex-col items-center py-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PdfPage
                  key={p}
                  pageNumber={p}
                  pdfDocRef={pdfDocRef}
                  pdfReady={pdfReady}
                  pdfFileName={pdfFileName}
                  saveAnnotationToDb={saveAnnotationToDb}
                  deleteAnnotationFromDb={deleteAnnotationFromDb}
                  onWordPicked={handleWordPicked}
                  pageTextCacheRef={pageTextCacheRef}
                  lazy={true}
                  onRenderError={handleRenderError}
                />
              ))}
            </div>
          ) : (
            <div className="flex justify-center py-6">
              <PdfPage
                pageNumber={currentPage}
                pdfDocRef={pdfDocRef}
                pdfReady={pdfReady}
                pdfFileName={pdfFileName}
                saveAnnotationToDb={saveAnnotationToDb}
                deleteAnnotationFromDb={deleteAnnotationFromDb}
                onWordPicked={handleWordPicked}
                pageTextCacheRef={pageTextCacheRef}
                onRenderError={handleRenderError}
              />
            </div>
          )}
        </div>
      </div>

      {/* Confirm-before-fetch tooltip */}
      {pendingWord && (
        <WordConfirmTooltip
          word={pendingWord.word}
          position={pendingWord.position}
          onConfirm={handleConfirmMeaning}
          onDismiss={() => setPendingWord(null)}
        />
      )}

      <AIQuotaModal
        open={quotaModalOpen}
        onOpenChange={setQuotaModalOpen}
        state={quota}
        onRequested={() => quota.refresh()}
      />

      <SelectionContextMenu />

      {/* UX fix (U8): replaces native confirm() for clearing page annotations. */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all annotations on this page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all highlights, drawings, and sticky notes on the current page. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearPageAnnotations} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
