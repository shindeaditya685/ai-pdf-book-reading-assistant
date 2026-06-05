'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useAuth } from '@/context/auth-context'
import { setActiveBook, setStoredBookPage } from '@/lib/reading-progress'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { lookupWord } from '@/lib/dictionary'
import { PdfPage } from '@/components/pdf-page'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  Bookmark,
  Clock,
  Brain,
  Users,
  HelpCircle,
  Sparkles,
  Volume2,
  AlignJustify,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SearchBar } from '@/components/search-bar'
import { AnnotationToolbar } from '@/components/annotation-toolbar'
import { WordConfirmTooltip } from '@/components/word-confirm-tooltip'

// Set worker source
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
}

export function PDFViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageTextCacheRef = useRef<Map<number, string>>(new Map())
  const ocrCancelledRef = useRef(false)
  const saveProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readingLogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartRef = useRef<number>(Date.now())
  const lastLoggedPageRef = useRef<number>(0)
  const { user } = useAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
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
    toggleFlashcards,
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
  } = usePDFStore()

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
      pdfDocRef.current = null
      setTotalPages(0)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when pdf is unloaded
      setPdfReady(false)
      pageTextCacheRef.current.clear()
      return
    }

    const loadPDF = async () => {
      setIsLoading(true)
      try {
        const loadingTask = pdfjsLib.getDocument(pdfDataUrl)
        const pdf = await loadingTask.promise
        pdfDocRef.current = pdf
        setTotalPages(pdf.numPages)
        const requestedPage = usePDFStore.getState().currentPage || 1
        const restoredPage = Math.min(Math.max(1, requestedPage), pdf.numPages)
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
      } catch (err) {
        console.error('Error loading PDF:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadPDF()
  }, [pdfDataUrl, pdfFileName, setCurrentPage, setTotalPages])

  // Persist active book + page progress
  useEffect(() => {
    if (!pdfDataUrl || !pdfFileName || totalPages <= 0) return

    const safePage = Math.min(Math.max(1, currentPage), totalPages)
    setActiveBook(user?.username, pdfFileName)
    setStoredBookPage(user?.username, pdfFileName, safePage)
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
  }, [currentPage, pdfDataUrl, pdfFileName, totalPages, user?.username])

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
          if (ocrCancelledRef.current) break

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

          setOcrProgress(Math.round((pageNum / totalPages) * 100))
        }

        if (!ocrCancelledRef.current) {
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
        if (!ocrCancelledRef.current) {
          setIsOcrProcessing(false)
          setOcrProgress(100)
        }
      }
    }

    runOcr()

    return () => {
      ocrCancelledRef.current = true
    }
  }, [ocrEnabled, totalPages, setOcrText, setIsOcrProcessing, setOcrProgress])

  const fetchExplanation = useCallback(
    async (word: string, sentence: string, pageNum: number) => {
      setIsExplaining(true)
      setExplanation(null)
      let aiOk = false
      try {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, sentence, pageNumber: pageNum, translationLanguage, accent }),
        })
        const data = await res.json()
        if (!data.error) {
          setExplanation(data)
          setIsOfflineResult(false)
          aiOk = true
        }
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
    [setExplanation, setIsExplaining, setIsOfflineResult, translationLanguage, accent]
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
  const handleClearAllPageAnnotations = useCallback(async () => {
    const pageAnns = annotations.filter((a) => a.pageNumber === currentPage)
    if (pageAnns.length === 0) return
    if (confirm('Are you sure you want to clear all highlights, drawings, and notes on this page?')) {
      for (const ann of pageAnns) {
        removeAnnotation(ann.id)
        deleteAnnotationFromDb(ann.id)
      }
    }
  }, [annotations, currentPage, removeAnnotation, deleteAnnotationFromDb])

  // Keyboard shortcuts for annotation tools
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

      // Skip letter shortcuts when modifier is held
      if (mod || e.altKey) return

      switch (e.key) {
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
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pdfDataUrl, setAnnotationMode, undo, redo])

  // Word-picked callback from PdfPage
  const handleWordPicked = useCallback(
    (word: string, sentence: string, pageNumber: number, position: { x: number; y: number }) => {
      setPendingWord({ word, sentence, pageNumber, position })
    },
    []
  )

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
      setCurrentPage(page)
      if (scrollMode && containerRef.current) {
        const target = containerRef.current.querySelector(`[data-page="${page}"]`)
        if (target) {
          ;(target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    },
    [scrollMode, setCurrentPage, clearSelection]
  )

  // Local buffer for the page number input so the user can type freely
  // and only commit to navigation on Enter / blur (like Adobe Acrobat).
  // Synced with `currentPage` when it changes externally (prev/next, follow mode, etc.)
  const [pageInput, setPageInput] = useState<string>(String(currentPage))
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional external-state sync
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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional external-state sync
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

  // Track current page in scroll mode via IntersectionObserver
  useEffect(() => {
    if (!scrollMode || !pdfReady || totalPages === 0) return
    const container = containerRef.current
    if (!container) return

    const visibility = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
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
        if (bestPage && bestRatio > 0 && bestPage !== usePDFStore.getState().currentPage) {
          usePDFStore.getState().setCurrentPage(bestPage)
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    const wrappers = container.querySelectorAll('[data-page]')
    wrappers.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [scrollMode, pdfReady, totalPages])

  // Follow mode: auto-navigate when leader changes page
  useEffect(() => {
    if (!followMode || !shareSession) return
    const leader = shareSession.members.find((m) => m.username !== user?.username)
    if (!leader) return
    const leaderPage = remotePages[leader.username]
    if (leaderPage && leaderPage !== currentPage && leaderPage >= 1 && leaderPage <= totalPages) {
      scrollToPage(leaderPage)
    }
  }, [followMode, remotePages, shareSession, currentPage, totalPages, user?.username, scrollToPage])

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) scrollToPage(currentPage - 1)
  }, [currentPage, scrollToPage])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) scrollToPage(currentPage + 1)
  }, [currentPage, totalPages, scrollToPage])

  const zoomIn = useCallback(() => { setScale(Math.min(scale + 0.25, 3)) }, [scale, setScale])
  const zoomOut = useCallback(() => { setScale(Math.max(scale - 0.25, 0.5)) }, [scale, setScale])

  // Clear selection when clicking outside the text layer
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-popup]') && !target.closest('span')) {
      clearSelection()
      setPendingWord(null)
    }
  }, [clearSelection])

  if (!pdfDataUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-100 to-emerald-50 shadow-lg shadow-emerald-500/10 dark:from-emerald-900/30 dark:to-emerald-800/20">
            <svg className="h-12 w-12 text-emerald-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-foreground/60">No PDF Loaded</h3>
          <p className="mt-1 text-sm text-muted-foreground/40">Upload a PDF to start reading</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-background to-muted/10">
      <div className="flex items-center justify-between border-b bg-background/80 px-3 py-1.5 backdrop-blur-lg shadow-sm">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={goToPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={String(totalPages).length}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, '').slice(0, String(totalPages).length))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setPageInput(String(currentPage))
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            onFocus={(e) => e.target.select()}
            onBlur={commitPageInput}
            className="w-12 rounded-lg border bg-background/80 px-1 py-0.5 text-center text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          />
          <span className="text-xs text-muted-foreground/60">/ {totalPages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={goToNextPage} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {showSearch && <SearchBar />}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg ${showSearch ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            onClick={toggleSearch}
            title="Search in PDF (/ or F)"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={toggleBookmarks}
            title="Bookmarks (B)"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={toggleHistory}
            title="Word History (H)"
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={toggleFlashcards}
            title="Flashcards (G)"
          >
            <Brain className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg ${showQuestionGenerator ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            onClick={toggleQuestionGenerator}
            title="AI Question Generator"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg ${showSummarizer ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            onClick={toggleSummarizer}
            title="AI Summarizer"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg ${shareSession ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            onClick={toggleSharePanel}
            title={shareSession ? `Session: ${shareSession.name}` : 'Collaborative Reading'}
          >
            <Users className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
            onClick={handleReadAloud}
            title="Read Aloud (current page or selection)"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-1 h-5 w-px bg-border/50" />
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg ${scrollMode ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            onClick={() => {
              const next = !scrollMode
              setScrollMode(next)
              // When switching modes, reset scroll to current page
              if (next && containerRef.current) {
                requestAnimationFrame(() => {
                  const target = containerRef.current?.querySelector(`[data-page="${currentPage}"]`)
                  ;(target as HTMLElement)?.scrollIntoView({ behavior: 'auto', block: 'start' })
                })
              } else {
                containerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
              }
            }}
            title={scrollMode ? 'Scroll mode (continuous)' : 'Page mode (single)'}
          >
            {scrollMode ? <AlignJustify className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={zoomInput}
              onChange={(e) => setZoomInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setZoomInput(String(Math.round(scale * 100)))
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              onFocus={(e) => e.target.select()}
              onBlur={commitZoomInput}
              className="w-10 rounded-lg border bg-background/80 px-1 py-0.5 text-center text-[11px] font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 tabular-nums"
              title="Type a zoom percentage and press Enter (50-300%)"
            />
            <span className="ml-0.5 text-[11px] font-medium text-muted-foreground/70">%</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={zoomIn} disabled={scale >= 3}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {(isOcrProcessing || (ocrProgress > 0 && ocrProgress < 100)) && (
        <div className="flex items-center justify-center gap-2.5 border-b bg-gradient-to-r from-emerald-50/50 to-transparent px-4 py-1.5 dark:from-emerald-950/10">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <svg className="h-3 w-3 animate-pulse text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v6h6M21 17a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">OCR in progress...</span>
          <Progress value={ocrProgress} className="h-1.5 w-24" />
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{ocrProgress}%</span>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <AnnotationToolbar onClearAll={handleClearAllPageAnnotations} />

        <div
          ref={containerRef}
          className="pdf-scroll-container h-full overflow-auto bg-gradient-to-b from-muted/20 to-muted/5 dark:from-muted/5"
          onClick={handleContainerClick}
          onMouseMove={(e) => setMousePosition(e.clientX, e.clientY)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-8 w-8 animate-spin text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="40 60" />
                </svg>
                <p className="text-xs text-muted-foreground/60">Loading PDF...</p>
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
    </div>
  )
}
