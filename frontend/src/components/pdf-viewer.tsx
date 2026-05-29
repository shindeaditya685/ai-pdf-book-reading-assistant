'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
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

// Set worker source
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
}

export function PDFViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const pageTextCacheRef = useRef<Map<number, string>>(new Map())
  const ocrCancelledRef = useRef(false)

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
  } = usePDFStore()

  const [isLoading, setIsLoading] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

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
        setCurrentPage(1)
        pageTextCacheRef.current.clear()
        setPdfReady(true)
      } catch (err) {
        console.error('Error loading PDF:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadPDF()
  }, [pdfDataUrl, setCurrentPage, setTotalPages])

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
      const text = textContent.items
        .filter((item): item is { str: string; transform: number[] } => 'str' in item)
        .map((item) => item.str)
        .join(' ')
      pageTextCacheRef.current.set(pageNum, text)
      return text
    } catch {
      return ''
    }
  }, [ocrText])

  // Render page
  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current
    if (!pdf || !canvasRef.current) return

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel() } catch { /* ignore */ }
      renderTaskRef.current = null
    }

    setIsLoading(true)
    try {
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.height = viewport.height
      canvas.width = viewport.width

      const renderTask = page.render({ canvasContext: context, viewport })
      renderTaskRef.current = renderTask
      await renderTask.promise

      // Build text layer
      const textLayer = textLayerRef.current
      const pageOcrData = ocrText[currentPage]
      const textContent = await page.getTextContent()
      const pageText = pageOcrData
        ? pageOcrData.text
        : textContent.items
            .filter((item): item is { str: string } => 'str' in item)
            .map((item) => item.str)
            .join(' ')
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, scale, searchQuery, searchResults, currentSearchIndex])

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

            const { data } = await worker.recognize(blob)
            const words = data.words
              .filter((w) => w.text.trim())
              .map((w) => ({
                text: w.text.trim(),
                x: w.bbox.x0,
                y: w.bbox.y0,
                width: w.bbox.x1 - w.bbox.x0,
                height: w.bbox.y1 - w.bbox.y0,
              }))

            setOcrText(pageNum, {
              text: data.text,
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
          body: JSON.stringify({ word, sentence, pageNumber: pageNum, translationLanguage }),
        })
        const data = await res.json()
        if (data.error) {
          setExplanation({ word, meaning: data.error, pronunciation: '', translation: null })
        } else {
          setExplanation(data)
        }
      } catch {
        setExplanation({ word, meaning: 'Failed to get explanation. Please try again.', pronunciation: '', translation: null })
      } finally {
        setIsExplaining(false)
      }
    },
    [setExplanation, setIsExplaining, translationLanguage]
  )

  const handleMouseUp = useCallback(async () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return
    const selectedText = selection.toString().trim()
    const textLayer = textLayerRef.current
    if (!textLayer || !textLayer.contains(selection.anchorNode)) return

    const word = selectedText.split(/\s+/)[0]
    const pageText = await getPageText(currentPage)
    const sentence = extractSentence(pageText, selectedText)

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    }

    setSelectedWord(word)
    setSelectedSentence(sentence)
    setSelectedPageNumber(currentPage)
    setPopupPosition(position)
    fetchExplanation(word, sentence, currentPage)
  }, [currentPage, getPageText, extractSentence, setSelectedWord, setSelectedSentence, setSelectedPageNumber, setPopupPosition, fetchExplanation])

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName !== 'SPAN' || !target.textContent) return
      const textLayer = textLayerRef.current
      if (!textLayer || !textLayer.contains(target)) return

      const word = target.textContent.trim().replace(/[^\w'-]/g, '')
      if (!word || word.length < 2) return

      const pageText = await getPageText(currentPage)
      const sentence = extractSentence(pageText, word)

      const rect = target.getBoundingClientRect()
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      }

      setSelectedWord(word)
      setSelectedSentence(sentence)
      setSelectedPageNumber(currentPage)
      setPopupPosition(position)
      fetchExplanation(word, sentence, currentPage)
    },
    [currentPage, getPageText, extractSentence, setSelectedWord, setSelectedSentence, setSelectedPageNumber, setPopupPosition, fetchExplanation]
  )

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-popup]') && !target.closest('span')) {
      clearSelection()
    }
  }, [clearSelection])

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
      <div ref={containerRef} className="pdf-scroll-container relative flex-1 overflow-auto bg-muted/30 dark:bg-muted/10" onClick={handleContainerClick} onMouseUp={handleMouseUp}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        )}
        <div className="flex justify-center py-6">
          <div className="relative shadow-xl">
            <canvas ref={canvasRef} className="block" />
            <div ref={textLayerRef} className="pdf-text-layer" onClick={handleClick} />
          </div>
        </div>
      </div>
    </div>
  )
}
