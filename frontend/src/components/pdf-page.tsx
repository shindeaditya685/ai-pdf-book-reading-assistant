'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore } from '@/store/use-pdf-store'
import { useAuth } from '@/context/auth-context'
import { StickyNoteItem } from '@/components/sticky-note-item'
import { Loader2 } from 'lucide-react'

interface PdfPageProps {
  pageNumber: number
  pdfDocRef: React.RefObject<pdfjsLib.PDFDocumentProxy | null>
  pdfReady: boolean
  pdfFileName: string | null
  saveAnnotationToDb: (ann: any) => Promise<void>
  deleteAnnotationFromDb: (id: string) => Promise<void>
  onWordPicked: (
    word: string,
    sentence: string,
    pageNumber: number,
    position: { x: number; y: number }
  ) => void
  pageTextCacheRef: React.RefObject<Map<number, string>>
  lazy?: boolean
}

function extractSentence(text: string, word: string): string {
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
}

function getWordAtPoint(target: HTMLElement, clientX: number, clientY: number): string {
  const text = target.textContent || ''
  if (!('caretRangeFromPoint' in (document as any))) {
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
}

export function PdfPage({
  pageNumber,
  pdfDocRef,
  pdfReady,
  pdfFileName,
  saveAnnotationToDb,
  deleteAnnotationFromDb,
  onWordPicked,
  pageTextCacheRef,
  lazy = false,
}: PdfPageProps) {
  const {
    scale,
    ocrText,
    searchQuery,
    searchResults,
    currentSearchIndex,
    annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    annotationMode,
    highlightColor,
    penColor,
    penWidth,
    shareSession,
    sharedAnnotations,
  } = usePDFStore()
  const { user } = useAuth()

  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const renderChainRef = useRef<Promise<void>>(Promise.resolve())
  const renderRequestIdRef = useRef<number>(0)
  const currentPathRef = useRef<{ x: number; y: number }[]>([])

  const [isVisible, setIsVisible] = useState(!lazy)
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)

  // Lazy render: only render canvas when the wrapper is in (or near) the viewport
  useEffect(() => {
    if (!lazy) return
    const el = wrapperRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        }
      },
      { rootMargin: '800px 0px 800px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [lazy])

  // Placeholder height: rough A4 ratio (1:1.414) scaled to current scale (derived)
  const placeholderHeight = lazy && !isVisible ? 800 * 1.414 * scale : null

  // Get full page text (uses shared cache + ocrText)
  const getPageText = useCallback(
    async (pageNum: number): Promise<string> => {
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
        const items = (textContent.items as any[]).filter((item) => 'str' in item)
        const text = items.map((item) => item.str).join(' ')
        pageTextCacheRef.current.set(pageNum, text)
        return text
      } catch {
        return ''
      }
    },
    [ocrText, pdfDocRef, pageTextCacheRef]
  )

  // Render the page
  const renderPageCanvas = useCallback(async () => {
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
      if (reqId !== renderRequestIdRef.current) return

      const pdf = pdfDocRef.current
      if (!pdf || !canvasRef.current) return

      setIsLoading(true)
      let renderTask: pdfjsLib.RenderTask | null = null
      try {
        const page = await pdf.getPage(pageNumber)
        // HiDPI: render at scale × devicePixelRatio (capped at 2x to keep memory safe)
        // and use CSS to display the canvas at the original `scale` size. Without
        // this, mobile (DPR 2-3) upscales the 1x canvas with bilinear filtering,
        // making text and lines look blurry.
        const outputScale = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
        const renderScale = scale * outputScale
        const viewport = page.getViewport({ scale: renderScale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        // Backing store: high-res for sharpness on HiDPI screens
        canvas.height = viewport.height
        canvas.width = viewport.width
        // CSS display size: matches the user's display `scale` (not the render scale)
        canvas.style.width = `${viewport.width / outputScale}px`
        canvas.style.height = `${viewport.height / outputScale}px`

        renderTask = page.render({ canvasContext: context, viewport })
        renderTaskRef.current = renderTask
        await renderTask.promise

        if (reqId !== renderRequestIdRef.current) return

        // Build text layer
        const textLayer = textLayerRef.current
        const pageOcrData = ocrText[pageNumber]
        const textContent = await page.getTextContent()
        const textItems = (textContent.items as any[]).filter((item) => 'str' in item)
        const pageText = pageOcrData
          ? pageOcrData.text
          : textItems.map((item) => item.str).join(' ')
        pageTextCacheRef.current.set(pageNumber, pageText)

        if (textLayer) {
          textLayer.innerHTML = ''
          textLayer.className = 'pdf-text-layer'
          // Text layer uses CSS coordinates (display size), matching the canvas CSS size
          const cssWidth = viewport.width / outputScale
          const cssHeight = viewport.height / outputScale
          textLayer.style.width = `${cssWidth}px`
          textLayer.style.height = `${cssHeight}px`

          if (pageOcrData && pageOcrData.words.length > 0) {
            // OCR words were captured at a fixed reference scale; map them to CSS coords
            const scaleX = cssWidth / pageOcrData.width
            const scaleY = cssHeight / pageOcrData.height
            pageOcrData.words.forEach((word: any) => {
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
            textContent.items.forEach((item: any) => {
              if (!('str' in item) || !item.str) return
              const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
              // `tx` is in backing coordinates; convert to CSS (display) coordinates
              const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]) / outputScale
              const span = document.createElement('span')
              span.textContent = item.str
              span.style.position = 'absolute'
              span.style.left = `${tx[4] / outputScale}px`
              span.style.top = `${(tx[5] - fontSize * outputScale) / outputScale}px`
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
  }, [pageNumber, scale, searchQuery, searchResults, currentSearchIndex, ocrText, pdfDocRef, pageTextCacheRef])

  useEffect(() => {
    if (pdfDocRef.current && pdfReady && isVisible) renderPageCanvas()
  }, [renderPageCanvas, pdfReady, isVisible])

  // Sync drawing canvas size when scale/page changes.
  // Drawing canvas backing is sized to match the PDF canvas's *display* size
  // (not its backing size) so the line-drawing math (`x * scale`) maps 1:1
  // to the displayed PDF. CSS `inset-0` then stretches it across the wrapper.
  useEffect(() => {
    if (
      (annotationMode === 'pen' || annotationMode === 'eraser') &&
      drawingCanvasRef.current &&
      canvasRef.current
    ) {
      const cssW = parseFloat(canvasRef.current.style.width) || canvasRef.current.width
      const cssH = parseFloat(canvasRef.current.style.height) || canvasRef.current.height
      drawingCanvasRef.current.width = cssW
      drawingCanvasRef.current.height = cssH
    }
  }, [annotationMode, scale, pageNumber, isVisible])

  // Eraser helper: erase drawing stroke near (px, py)
  const eraseDrawingAtPoint = useCallback(
    (px: number, py: number) => {
      const pageAnns = annotations.filter(
        (a) => a.pageNumber === pageNumber && a.type === 'drawing'
      )

      const isPointNearLine = (
        px: number,
        py: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        threshold = 8
      ) => {
        const A = px - x1
        const B = py - y1
        const C = x2 - x1
        const D = y2 - y1
        const dot = A * C + B * D
        const lenSq = C * C + D * D
        let param = -1
        if (lenSq !== 0) param = dot / lenSq
        let xx, yy
        if (param < 0) { xx = x1; yy = y1 }
        else if (param > 1) { xx = x2; yy = y2 }
        else { xx = x1 + param * C; yy = y1 + param * D }
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
    },
    [annotations, pageNumber, removeAnnotation, deleteAnnotationFromDb, scale]
  )

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
        pageNumber,
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

  // Sticky note placement click
  const handleNotePlacement = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    const newId = `ann-${Date.now()}-${Math.random()}`
    const newNote = {
      id: newId,
      pdfFileName: pdfFileName || 'unknown',
      pageNumber,
      type: 'note' as const,
      color: '#F59E0B',
      noteText: '',
      x,
      y,
      timestamp: Date.now(),
    }
    addAnnotation(newNote)
    saveAnnotationToDb(newNote)
    usePDFStore.getState().setAnnotationMode('select')
  }

  // Mouse up selection handler (text selection → word meaning)
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
          pageNumber,
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
    const pageText = await getPageText(pageNumber)
    const sentence = extractSentence(pageText, selectedText)
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const position = { x: rect.left + rect.width / 2, y: rect.top - 10 }
    onWordPicked(word, sentence, pageNumber, position)
  }, [
    annotationMode,
    highlightColor,
    pdfFileName,
    pageNumber,
    scale,
    addAnnotation,
    saveAnnotationToDb,
    getPageText,
    onWordPicked,
  ])

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      if (annotationMode !== 'select') return
      const target = e.target as HTMLElement
      if (target.tagName !== 'SPAN' || !target.textContent) return
      const textLayer = textLayerRef.current
      if (!textLayer || !textLayer.contains(target)) return

      const word = getWordAtPoint(target, e.clientX, e.clientY)
      if (!word || word.length < 2) return

      // Select the word visually
      const sel = window.getSelection()
      if (sel && 'caretRangeFromPoint' in (document as any)) {
        const range = (document as any).caretRangeFromPoint(e.clientX, e.clientY)
        if (range && range.startContainer) {
          const text = range.startContainer.textContent || ''
          const offset = range.startOffset
          const matchBefore = text.slice(0, offset).match(/(\w['\w-]*)$/)
          const matchAfter = text.slice(offset).match(/^(['\w-]*\w)/)
          const start = matchBefore ? offset - matchBefore[1].length : offset
          const end = offset + (matchAfter ? matchAfter[1].length : 0)
          range.setStart(range.startContainer, start)
          range.setEnd(range.startContainer, end)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }

      const pageText = await getPageText(pageNumber)
      const sentence = extractSentence(pageText, word)
      const rect = target.getBoundingClientRect()
      const position = { x: rect.left + rect.width / 2, y: rect.top - 10 }
      onWordPicked(word, sentence, pageNumber, position)
    },
    [pageNumber, getPageText, annotationMode, onWordPicked]
  )

  // Placeholder (lazy + not yet visible) — render inside the same wrapper to keep ref stable
  return (
    <div
      ref={wrapperRef}
      data-page={pageNumber}
      className={`pdf-page-wrapper relative mx-auto my-3 shadow-xl ${lazy && !isVisible ? 'rounded-md bg-muted/20' : ''}`}
      style={lazy && !isVisible ? { width: '70%', maxWidth: 800, height: placeholderHeight ?? 1000 } : undefined}
      onMouseUp={lazy && !isVisible ? undefined : handleMouseUp}
    >
      {lazy && !isVisible ? (
        <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
          Page {pageNumber}
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <p className="text-[10px] text-muted-foreground/60">Loading page {pageNumber}...</p>
              </div>
            </div>
          )}

          <div className="relative">
            <canvas ref={canvasRef} className="block" />
        <div
          ref={textLayerRef}
          className="pdf-text-layer"
          onClick={handleClick}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Highlights overlay (own) */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {annotations
            .filter((ann) => ann.pageNumber === pageNumber && ann.type === 'highlight' && ann.rects)
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
          {/* Shared highlights (others) */}
          {shareSession &&
            sharedAnnotations
              .filter(
                (ann) =>
                  ann.pageNumber === pageNumber &&
                  ann.type === 'highlight' &&
                  ann.rects &&
                  ann.author !== user?.username
              )
              .map((ann) =>
                ann.rects!.map((rect, idx) => {
                  const member = shareSession.members.find((m) => m.username === ann.author)
                  return (
                    <div
                      key={`shared-${ann.annotationId}-${idx}`}
                      style={{
                        position: 'absolute',
                        left: `${rect.left * scale}px`,
                        top: `${rect.top * scale}px`,
                        width: `${rect.width * scale}px`,
                        height: `${rect.height * scale}px`,
                        backgroundColor: member?.color || ann.color,
                        opacity: 0.55,
                      }}
                      title={`${ann.author}'s highlight`}
                    />
                  )
                })
              )}
        </div>

        {/* Drawing paths (SVG) */}
        <svg
          className="absolute inset-0 pointer-events-none z-10"
          style={{ width: '100%', height: '100%' }}
        >
          {annotations
            .filter((ann) => ann.pageNumber === pageNumber && ann.type === 'drawing' && ann.points)
            .map((ann) => {
              const pathData = ann
                .points!.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`)
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
          {shareSession &&
            sharedAnnotations
              .filter(
                (ann) =>
                  ann.pageNumber === pageNumber &&
                  ann.type === 'drawing' &&
                  ann.points &&
                  ann.author !== user?.username
              )
              .map((ann) => {
                const member = shareSession.members.find((m) => m.username === ann.author)
                const pathData = ann
                  .points!.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`)
                  .join(' ')
                return (
                  <path
                    key={`shared-${ann.annotationId}`}
                    d={pathData}
                    stroke={member?.color || ann.color}
                    strokeWidth={(ann.thickness || 3) * scale}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )
              })}
        </svg>

        {/* Sticky notes */}
        <div className="absolute inset-0 pointer-events-none z-30">
          {annotations
            .filter((ann) => ann.pageNumber === pageNumber && ann.type === 'note')
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
          {shareSession &&
            sharedAnnotations
              .filter(
                (ann) =>
                  ann.pageNumber === pageNumber && ann.type === 'note' && ann.author !== user?.username
              )
              .map((ann) => {
                const member = shareSession.members.find((m) => m.username === ann.author)
                return (
                  <StickyNoteItem
                    key={`shared-${ann.annotationId}`}
                    annotation={{ ...ann, id: ann.annotationId }}
                    scale={scale}
                    readOnly={true}
                    authorName={ann.author}
                    authorColor={member?.color || ann.color}
                  />
                )
              })}
        </div>

        {/* Interactive drawing layer (pen/eraser) */}
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

        {/* Sticky note placement overlay */}
        {annotationMode === 'note' && (
          <div
            className="absolute inset-0 z-20 cursor-copy"
            onClick={handleNotePlacement}
          />
        )}
          </div>

          {/* Page number footer */}
          <div className="mt-2 text-center text-[10px] font-medium text-muted-foreground/40 tabular-nums">
            — {pageNumber} —
          </div>
        </>
      )}
    </div>
  )
}
