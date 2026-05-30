'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
import { useAuth } from '@/context/auth-context'
import { setActiveBook, setStoredBookPage } from '@/lib/reading-progress'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Search,
  Bookmark,
  Clock,
  Scan,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SearchBar } from '@/components/search-bar'
import { AnnotationToolbar } from '@/components/annotation-toolbar'
import { StickyNoteItem } from '@/components/sticky-note-item'
import { WordConfirmTooltip } from '@/components/word-confirm-tooltip'

// Set worker source
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
}

export function PDFViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const renderChainRef = useRef<Promise<void>>(Promise.resolve())
  const renderRequestIdRef = useRef<number>(0)
  const pageTextCacheRef = useRef<Map<number, string>>(new Map())
  const ocrCancelledRef = useRef(false)
  const saveProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { user } = useAuth()

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
    clearSelection,
    translationLanguage,
    accent,
    searchQuery,
    searchResults,
    currentSearchIndex,
    showSearch,
    toggleSearch,
    toggleHistory,
    toggleBookmarks,
    ocrEnabled,
    ocrText,
    setOcrText,
    isOcrProcessing,
    setIsOcrProcessing,
    ocrProgress,
    setOcrProgress,
    annotationMode,
    setAnnotationMode,
    highlightColor,
    penColor,
    penWidth,
    annotations,
    setAnnotations,
    addRecentPdf,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    pdfFileName,
  } = usePDFStore()

  const [isLoading, setIsLoading] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  // Pending word confirmation state (shown before firing API)
  const [pendingWord, setPendingWord] = useState<{
    word: string
    sentence: string
    pageNumber: number
    position: { x: number; y: number }
  } | null>(null)

  // Drawing and annotation refs/states
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const currentPathRef = useRef<{ x: number; y: number }[]>([])

  // Load PDF document
  useEffect(() => {
    if (!pdfDataUrl) {
      pdfDocRef.current = null
      setTotalPages(0)
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
  }, [addRecentPdf, pdfDataUrl, pdfFileName, setCurrentPage, setTotalPages])

  // Persist active book + page progress so refreshes resume in the same place.
  useEffect(() => {
    if (!pdfDataUrl || !pdfFileName || totalPages <= 0) return

    const safePage = Math.min(Math.max(1, currentPage), totalPages)
    setActiveBook(user?.username, pdfFileName)
    setStoredBookPage(user?.username, pdfFileName, safePage)
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
  }, [addRecentPdf, currentPage, pdfDataUrl, pdfFileName, totalPages, user?.username])

  // Get full page text for context
  const getPageText = useCallback(async (pageNum: number): Promise<string> => {
    const cached = pageTextCacheRef.current.get(pageNum)
    if (cached) return cached
    const pageOcrData = ocrText[pageNum]
    if (pageOcrData) {
      pageTextCacheRef.current.set(pageNum, pageOcrData.text)
      return pageOcrData.text
    }
    const pdf = pdfDocRef.current
    if (!pdf) return ''
    try {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const items = textContent.items.filter((item): item is any => 'str' in item)
      const text = items.map((item) => item.str).join(' ')
      pageTextCacheRef.current.set(pageNum, text)
      return text
    } catch {
      return ''
    }
  }, [ocrText])

  // Render page
  const renderPage = useCallback(async () => {
    const reqId = ++renderRequestIdRef.current

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {
        // ignore
      }
    }

    const previousRender = renderChainRef.current

    const promise = (async () => {
      try {
        await previousRender
      } catch {
        // ignore
      }

      // If a newer render request has arrived, abort immediately.
      if (reqId !== renderRequestIdRef.current) return

      const pdf = pdfDocRef.current
      if (!pdf || !canvasRef.current) return

      setIsLoading(true)
      let renderTask: pdfjsLib.RenderTask | null = null
      try {
        const page = await pdf.getPage(currentPage)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.height = viewport.height
        canvas.width = viewport.width

        renderTask = page.render({ canvasContext: context, viewport })
        renderTaskRef.current = renderTask
        await renderTask.promise

        if (reqId !== renderRequestIdRef.current) return

        // Build text layer
        const textLayer = textLayerRef.current
        const pageOcrData = ocrText[currentPage]
        const textContent = await page.getTextContent()
        const textItems = textContent.items.filter((item): item is any => 'str' in item)
        const pageText = pageOcrData
          ? pageOcrData.text
          : textItems.map((item) => item.str).join(' ')
        pageTextCacheRef.current.set(currentPage, pageText)

        if (textLayer) {
          textLayer.innerHTML = ''
          textLayer.className = 'pdf-text-layer'
          textLayer.style.width = `${viewport.width}px`
          textLayer.style.height = `${viewport.height}px`

          if (pageOcrData && pageOcrData.words.length > 0) {
            const scaleX = viewport.width / pageOcrData.width
            const scaleY = viewport.height / pageOcrData.height
            pageOcrData.words.forEach((word) => {
              if (!word.text) return
              const fontSize = Math.min(word.height * scaleY * 0.85, 30)
              const span = document.createElement('span')
              span.textContent = word.text
              span.style.position = 'absolute'
              span.style.left = `${word.x * scaleX}px`
              span.style.top = `${word.y * scaleY}px`
              span.style.fontSize = `${fontSize}px`
              span.style.fontFamily = 'sans-serif'
              span.style.transformOrigin = '0% 0%'

              if (searchQuery && word.text.toLowerCase().includes(searchQuery.toLowerCase())) {
                const highlight = document.createElement('mark')
                highlight.className = 'pdf-search-highlight'
                if (searchResults[currentSearchIndex]?.text === word.text) {
                  highlight.classList.add('pdf-search-highlight-current')
                }
                highlight.textContent = word.text
                span.textContent = ''
                span.appendChild(highlight)
              }

              textLayer.appendChild(span)
            })
          } else {
            textContent.items.forEach((item) => {
              if (!('str' in item) || !item.str) return
              const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
              const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3])
              const span = document.createElement('span')
              span.textContent = item.str
              span.style.position = 'absolute'
              span.style.left = `${tx[4]}px`
              span.style.top = `${tx[5] - fontSize}px`
              span.style.fontSize = `${fontSize}px`
              span.style.fontFamily = 'sans-serif'
              span.style.transformOrigin = '0% 0%'

              if (searchQuery && item.str.toLowerCase().includes(searchQuery.toLowerCase())) {
                const highlight = document.createElement('mark')
                highlight.className = 'pdf-search-highlight'
                if (searchResults[currentSearchIndex]?.text === item.str) {
                  highlight.classList.add('pdf-search-highlight-current')
                }
                highlight.textContent = item.str
                span.textContent = ''
                span.appendChild(highlight)
              }

              textLayer.appendChild(span)
            })
          }
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err)
        }
      } finally {
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null
        }
        if (reqId === renderRequestIdRef.current) {
          setIsLoading(false)
        }
      }
    })()

    renderChainRef.current = promise
  }, [currentPage, scale, searchQuery, searchResults, currentSearchIndex, ocrText])

  useEffect(() => {
    if (pdfDocRef.current) renderPage()
  }, [renderPage, pdfReady])

  // OCR processing
  useEffect(() => {
    const pdf = pdfDocRef.current
    if (!ocrEnabled || !pdf || totalPages === 0) return

    ocrCancelledRef.current = false
    setIsOcrProcessing(true)
    setOcrProgress(0)

    const runOcr = async () => {
      let worker: Awaited<ReturnType<typeof createWorker>> | null = null
      const ocrCanvas = document.createElement('canvas')
      try {
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

            const ocrResult = await worker.recognize(blob)
            const imageWords: any[] = (ocrResult as any).data?.words || []
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
              text: (ocrResult as any).data.text,
              words,
              width: viewport.width,
              height: viewport.height,
            })
          } catch {
            // skip failed page
          }

          setOcrProgress(Math.round((pageNum / totalPages) * 100))
        }

        // Save OCR results to MongoDB
        if (!ocrCancelledRef.current) {
          const store = usePDFStore.getState()
          const fileName = store.pdfFileName
          if (fileName) {
            const allOcrText: Record<string, { text: string; words: { text: string; x: number; y: number; width: number; height: number }[]; width: number; height: number }> = {}
            const state = usePDFStore.getState()
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

  const extractSentence = useCallback((text: string, word: string): string => {
    const sentences = text.match(/[^.!?\n]+[.!?]+/g) || [text]
    let found = sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()))
    if (!found) {
      const idx = text.toLowerCase().indexOf(word.toLowerCase())
      if (idx >= 0) {
        const start = Math.max(0, text.lastIndexOf('.', idx) + 1)
        const end = text.indexOf('.', idx + word.length)
        found = text.slice(start, end > 0 ? end + 1 : text.length).trim()
      }
    }
    return found || word
  }, [])

  const fetchExplanation = useCallback(
    async (word: string, sentence: string, pageNum: number) => {
      setIsExplaining(true)
      setExplanation(null)
      try {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, sentence, pageNumber: pageNum, translationLanguage, accent }),
        })
        const data = await res.json()
        if (data.error) {
          setExplanation({ word, meaning: data.error, pronunciation: '', translation: '' })
        } else {
          setExplanation(data)
        }
      } catch {
        setExplanation({ word, meaning: 'Failed to get explanation. Please try again.', pronunciation: '', translation: '' })
      } finally {
        setIsExplaining(false)
      }
    },
    [setExplanation, setIsExplaining, translationLanguage, accent]
  )

  // Load annotations on mount or when PDF filename changes
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

  // Sync size of drawing canvas
  useEffect(() => {
    if ((annotationMode === 'pen' || annotationMode === 'eraser') && drawingCanvasRef.current && canvasRef.current) {
      drawingCanvasRef.current.width = canvasRef.current.width
      drawingCanvasRef.current.height = canvasRef.current.height
    }
  }, [annotationMode, scale, currentPage])

  // Save annotation to MongoDB helper
  const saveAnnotationToDb = useCallback(async (ann: any) => {
    try {
      await authFetch('/api/db/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ann),
      })
    } catch (err) {
      console.error('Failed to sync annotation to db:', err)
    }
  }, [])

  // Delete annotation from MongoDB helper
  const deleteAnnotationFromDb = useCallback(async (id: string) => {
    try {
      await authFetch(`/api/db/annotations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Failed to delete annotation from db:', err)
    }
  }, [])

  // Eraser helper: erase drawing stroke near (px, py)
  const eraseDrawingAtPoint = useCallback((px: number, py: number) => {
    const pageAnns = annotations.filter((a) => a.pageNumber === currentPage && a.type === 'drawing')
    
    const isPointNearLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number, threshold = 8) => {
      const A = px - x1
      const B = py - y1
      const C = x2 - x1
      const D = y2 - y1

      const dot = A * C + B * D
      const lenSq = C * C + D * D
      let param = -1
      if (lenSq !== 0) {
        param = dot / lenSq
      }

      let xx, yy
      if (param < 0) {
        xx = x1
        yy = y1
      } else if (param > 1) {
        xx = x2
        yy = y2
      } else {
        xx = x1 + param * C
        yy = y1 + param * D
      }

      const dx = px - xx
      const dy = py - yy
      return Math.sqrt(dx * dx + dy * dy) < threshold
    }

    for (const ann of pageAnns) {
      if (!ann.points) continue
      for (let i = 0; i < ann.points.length - 1; i++) {
        const p1 = ann.points[i]
        const p2 = ann.points[i + 1]
        if (isPointNearLine(px, py, p1.x, p1.y, p2.x, p2.y, 10 / scale)) {
          removeAnnotation(ann.id)
          deleteAnnotationFromDb(ann.id)
          return
        }
      }
    }
  }, [annotations, currentPage, removeAnnotation, deleteAnnotationFromDb, scale])

  // Drawing event handlers
  const handleDrawingStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    if (annotationMode === 'pen') {
      setIsDrawing(true)
      currentPathRef.current = [{ x, y }]

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = penColor
        ctx.lineWidth = penWidth * scale
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(x * scale, y * scale)
        ctx.lineTo(x * scale, y * scale)
        ctx.stroke()
      }
    } else if (annotationMode === 'eraser') {
      eraseDrawingAtPoint(x, y)
    }
  }

  const handleDrawingMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing && annotationMode !== 'eraser') return
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    if (annotationMode === 'pen' && isDrawing) {
      const prevPoint = currentPathRef.current[currentPathRef.current.length - 1]
      currentPathRef.current.push({ x, y })

      const ctx = canvas.getContext('2d')
      if (ctx && prevPoint) {
        ctx.strokeStyle = penColor
        ctx.lineWidth = penWidth * scale
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(prevPoint.x * scale, prevPoint.y * scale)
        ctx.lineTo(x * scale, y * scale)
        ctx.stroke()
      }
    } else if (annotationMode === 'eraser') {
      if (e.buttons === 1) {
        eraseDrawingAtPoint(x, y)
      }
    }
  }

  const handleDrawingEnd = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    if (currentPathRef.current.length > 1) {
      const newId = `ann-${Date.now()}-${Math.random()}`
      const newDrawing = {
        id: newId,
        pdfFileName: pdfFileName || 'unknown',
        pageNumber: currentPage,
        type: 'drawing' as const,
        color: penColor,
        thickness: penWidth,
        points: currentPathRef.current,
        timestamp: Date.now(),
      }

      addAnnotation(newDrawing)
      saveAnnotationToDb(newDrawing)
    }

    const canvas = drawingCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
    currentPathRef.current = []
  }

  // Sticky Note placement click handler
  const handleNotePlacement = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    const newId = `ann-${Date.now()}-${Math.random()}`
    const newNote = {
      id: newId,
      pdfFileName: pdfFileName || 'unknown',
      pageNumber: currentPage,
      type: 'note' as const,
      color: '#F59E0B',
      noteText: '',
      x,
      y,
      timestamp: Date.now(),
    }

    addAnnotation(newNote)
    saveAnnotationToDb(newNote)
    setAnnotationMode('select')
  }

  // Clear annotations helper
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

  // Mouse up selection handler
  const handleMouseUp = useCallback(async () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return
    const selectedText = selection.toString().trim()
    const textLayer = textLayerRef.current
    if (!textLayer || !textLayer.contains(selection.anchorNode)) return

    // If Highlight tool is active, instantly apply text selection highlight
    if (annotationMode === 'highlight') {
      const range = selection.getRangeAt(0)
      const clientRects = Array.from(range.getClientRects())
      const canvasElement = canvasRef.current
      if (canvasElement && clientRects.length > 0) {
        const canvasRect = canvasElement.getBoundingClientRect()
        const rects = clientRects.map((r) => ({
          left: (r.left - canvasRect.left) / scale,
          top: (r.top - canvasRect.top) / scale,
          width: r.width / scale,
          height: r.height / scale,
        }))

        const newId = `ann-${Date.now()}-${Math.random()}`
        const newHighlight = {
          id: newId,
          pdfFileName: pdfFileName || 'unknown',
          pageNumber: currentPage,
          type: 'highlight' as const,
          color: highlightColor,
          rects,
          noteText: selectedText,
          timestamp: Date.now(),
        }

        addAnnotation(newHighlight)
        saveAnnotationToDb(newHighlight)
        selection.removeAllRanges()
      }
      return
    }

    const word = selectedText.split(/\s+/)[0]
    const pageText = await getPageText(currentPage)
    const sentence = extractSentence(pageText, selectedText)

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    }

    // Show confirm tooltip — do NOT call API yet
    setPendingWord({ word, sentence, pageNumber: currentPage, position })
  }, [
    currentPage,
    getPageText,
    extractSentence,
    annotationMode,
    highlightColor,
    pdfFileName,
    scale,
    addAnnotation,
    saveAnnotationToDb,
  ])

  const getWordAtPoint = useCallback((target: HTMLElement, clientX: number, clientY: number): string => {
    const text = target.textContent || ''
    if (!('caretRangeFromPoint' in document)) {
      return text.trim().replace(/[^\w'-]/g, '')
    }
    const range = (document as any).caretRangeFromPoint(clientX, clientY)
    if (!range || !range.startContainer) return text.trim().replace(/[^\w'-]/g, '')
    const offset = range.startOffset
    const before = text.slice(0, offset)
    const after = text.slice(offset)
    const matchBefore = before.match(/(\w['\w-]*)$/)
    const matchAfter = after.match(/^(['\w-]*\w)/)
    return ((matchBefore?.[1] || '') + (matchAfter?.[1] || '')).trim()
  }, [])

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      if (annotationMode !== 'select') return
      const target = e.target as HTMLElement
      if (target.tagName !== 'SPAN' || !target.textContent) return
      const textLayer = textLayerRef.current
      if (!textLayer || !textLayer.contains(target)) return

      const word = getWordAtPoint(target, e.clientX, e.clientY)
      if (!word || word.length < 2) return

      const pageText = await getPageText(currentPage)
      const sentence = extractSentence(pageText, word)

      const rect = target.getBoundingClientRect()
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      }

      // Show confirm tooltip — do NOT call API yet
      setPendingWord({ word, sentence, pageNumber: currentPage, position })
    },
    [currentPage, getPageText, extractSentence, getWordAtPoint, annotationMode]
  )

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-popup]') && !target.closest('span')) {
      clearSelection()
      setPendingWord(null)
    }
  }, [clearSelection])

  // Called when user confirms they want the meaning
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

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) { clearSelection(); setCurrentPage(currentPage - 1) }
  }, [currentPage, setCurrentPage, clearSelection])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) { clearSelection(); setCurrentPage(currentPage + 1) }
  }, [currentPage, totalPages, setCurrentPage, clearSelection])

  const zoomIn = useCallback(() => { setScale(Math.min(scale + 0.25, 3)) }, [scale, setScale])
  const zoomOut = useCallback(() => { setScale(Math.max(scale - 0.25, 0.5)) }, [scale, setScale])

  if (!pdfDataUrl) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
            <svg className="h-10 w-10 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground/70">No PDF Loaded</h3>
          <p className="mt-1 text-sm text-muted-foreground/50">Upload a PDF to start reading</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-background/95 px-3 py-1.5 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value, 10)
              if (page >= 1 && page <= totalPages) {
                clearSelection()
                setCurrentPage(page)
              }
            }}
            className="w-10 rounded border bg-background px-1 py-0.5 text-center text-xs outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs text-muted-foreground">/ {totalPages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextPage} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          {showSearch && <SearchBar />}
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${showSearch ? 'text-emerald-500' : 'text-muted-foreground'}`}
            onClick={toggleSearch}
            title="Search in PDF (/ or F)"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={toggleBookmarks}
            title="Bookmarks (B)"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={toggleHistory}
            title="Word History (H)"
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[50px] text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={scale >= 3}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {(isOcrProcessing || ocrProgress > 0 && ocrProgress < 100) && (
        <div className="flex items-center justify-center gap-2 border-b px-3 py-1">
          <Scan className="h-3 w-3 animate-pulse text-emerald-500" />
          <span className="text-[10px] text-muted-foreground">OCR in progress...</span>
          <Progress value={ocrProgress} className="h-1 w-20" />
          <span className="text-[10px] text-muted-foreground">{ocrProgress}%</span>
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        {/* Floating Annotation Toolbar */}
        <AnnotationToolbar onClearAll={handleClearAllPageAnnotations} />

        <div ref={containerRef} className="pdf-scroll-container h-full overflow-auto bg-muted/30 dark:bg-muted/10" onClick={handleContainerClick} onMouseUp={handleMouseUp}>
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          )}
          <div className="flex justify-center py-6">
            <div className="relative shadow-xl">
              <canvas ref={canvasRef} className="block" />
              <div ref={textLayerRef} className="pdf-text-layer" onClick={handleClick} />

              {/* Highlights Overlay Layer */}
              <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                {annotations
                  .filter((ann) => ann.pageNumber === currentPage && ann.type === 'highlight' && ann.rects)
                  .map((ann) =>
                    ann.rects!.map((rect, idx) => (
                      <div
                        key={`${ann.id}-${idx}`}
                        style={{
                          position: 'absolute',
                          left: `${rect.left * scale}px`,
                          top: `${rect.top * scale}px`,
                          width: `${rect.width * scale}px`,
                          height: `${rect.height * scale}px`,
                          backgroundColor: ann.color,
                          opacity: 0.85,
                          mixBlendMode: 'multiply',
                        }}
                      />
                    ))
                  )}
              </div>

              {/* SVG Drawing Paths Overlay Layer */}
              <svg
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  width: '100%',
                  height: '100%',
                }}
              >
                {annotations
                  .filter((ann) => ann.pageNumber === currentPage && ann.type === 'drawing' && ann.points)
                  .map((ann) => {
                    const pathData = ann.points!
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`)
                      .join(' ')
                    return (
                      <path
                        key={ann.id}
                        d={pathData}
                        stroke={ann.color}
                        strokeWidth={(ann.thickness || 3) * scale}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )
                  })}
              </svg>

              {/* Sticky Notes Pin Layer */}
              <div className="absolute inset-0 pointer-events-none z-30">
                {annotations
                  .filter((ann) => ann.pageNumber === currentPage && ann.type === 'note')
                  .map((ann) => (
                    <StickyNoteItem
                      key={ann.id}
                      annotation={ann}
                      scale={scale}
                      onUpdate={(text) => {
                        updateAnnotation(ann.id, text)
                        saveAnnotationToDb({ ...ann, noteText: text })
                      }}
                      onDelete={() => {
                        removeAnnotation(ann.id)
                        deleteAnnotationFromDb(ann.id)
                      }}
                    />
                  ))}
              </div>

              {/* Interactive Drawing Layer (only visible/active in Pen/Eraser modes) */}
              {(annotationMode === 'pen' || annotationMode === 'eraser') && (
                <canvas
                  ref={drawingCanvasRef}
                  className="absolute inset-0 z-20 cursor-crosshair touch-none"
                  onPointerDown={handleDrawingStart}
                  onPointerMove={handleDrawingMove}
                  onPointerUp={handleDrawingEnd}
                  onPointerLeave={handleDrawingEnd}
                />
              )}

              {/* Sticky Note Placement Overlay Layer */}
              {annotationMode === 'note' && (
                <div
                  className="absolute inset-0 z-20 cursor-copy"
                  onClick={handleNotePlacement}
                />
              )}
            </div>
          </div>
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
