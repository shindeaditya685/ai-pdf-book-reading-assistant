'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePDFStore } from '@/store/use-pdf-store'

/** Convert a hex color to an rgba() string with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(0, 0, 0, ${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Reading aid — follows the mouse cursor over the PDF.
 *
 * Two modes:
 *  - 'line':  a thin guide line at the cursor.
 *  - 'focus': dims everything above and below a clear horizontal band
 *             centered on the cursor (a reading-ruler focus band).
 *
 * Both stay at the last cursor position once the mouse leaves the page and do
 * NOT scroll with the page content.
 */
export function ReaderLine({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const readerAidMode = usePDFStore((s) => s.readerAidMode)
  const readerAidHeight = usePDFStore((s) => s.readerAidHeight)
  const readerAidColor = usePDFStore((s) => s.readerAidColor)
  const readerAidOpacity = usePDFStore((s) => s.readerAidOpacity)

  const [y, setY] = useState(0)

  const setYFromCursor = useCallback(
    (clientY: number) => {
      const el = containerRef.current
      const wrapper = el?.parentElement
      if (!el || !wrapper) return
      const wrapperRect = wrapper.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      // Only follow the cursor while it is over the scroll container
      if (clientY < elRect.top || clientY > elRect.bottom) return
      setY(Math.min(wrapperRect.height, Math.max(0, clientY - wrapperRect.top)))
    },
    [containerRef]
  )

  useEffect(() => {
    if (readerAidMode === 'off') return
    // Place the aid somewhere useful before the first mousemove
    const el = containerRef.current
    const wrapper = el?.parentElement
    if (el && wrapper) setY(wrapper.getBoundingClientRect().height * 0.4)
    const onMove = (e: MouseEvent) => setYFromCursor(e.clientY)
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [readerAidMode, containerRef, setYFromCursor])

  if (readerAidMode === 'off') return null

  const half = readerAidHeight / 2
  const fill = hexToRgba(readerAidColor, readerAidOpacity)

  if (readerAidMode === 'focus') {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        {/* Dim above the band */}
        <div
          className="absolute inset-x-0 top-0"
          style={{ height: y - half, backgroundColor: fill }}
        />
        {/* Dim below the band */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ top: y + half, backgroundColor: fill }}
        />
        {/* Clear focus band */}
        <div
          className="absolute inset-x-0"
          style={{ top: y - half, height: readerAidHeight }}
        >
          <div
            className="h-full w-full"
            style={{
              borderTop: `1px solid ${fill}`,
              borderBottom: `1px solid ${fill}`,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: y - half }}>
      <div
        className="w-full"
        style={{ height: readerAidHeight, backgroundColor: fill }}
      />
    </div>
  )
}
