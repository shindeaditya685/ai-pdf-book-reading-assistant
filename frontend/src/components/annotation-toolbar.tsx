'use client'

import { useState, useRef, useEffect } from 'react'
import {
  MousePointer,
  Highlighter,
  PenTool,
  Eraser,
  MessageSquarePlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { usePDFStore } from '@/store/use-pdf-store'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

const HIGHLIGHT_COLORS = [
  { value: 'rgba(254, 240, 138, 0.45)', label: 'Yellow', tailwind: 'bg-yellow-300 border-yellow-400' },
  { value: 'rgba(187, 247, 208, 0.45)', label: 'Green',  tailwind: 'bg-green-300 border-green-400' },
  { value: 'rgba(251, 207, 232, 0.45)', label: 'Pink',   tailwind: 'bg-pink-300 border-pink-400' },
  { value: 'rgba(191, 219, 254, 0.45)', label: 'Blue',   tailwind: 'bg-blue-300 border-blue-400' },
]

const PEN_COLORS = [
  { value: '#EF4444', tailwind: 'bg-red-500',     label: 'Red' },
  { value: '#3B82F6', tailwind: 'bg-blue-500',    label: 'Blue' },
  { value: '#10B981', tailwind: 'bg-emerald-500', label: 'Green' },
  { value: '#F59E0B', tailwind: 'bg-amber-500',   label: 'Yellow' },
  { value: '#8B5CF6', tailwind: 'bg-purple-500',  label: 'Purple' },
  { value: '#1F2937', tailwind: 'bg-gray-800',    label: 'Black' },
]

type OpenPanel = 'highlight' | 'pen' | null

export function AnnotationToolbar({ onClearAll }: { onClearAll: () => void }) {
  const {
    annotationMode,
    setAnnotationMode,
    highlightColor,
    setHighlightColor,
    penColor,
    setPenColor,
    penWidth,
    setPenWidth,
    pdfFileName,
  } = usePDFStore()

  const [isMinimized, setIsMinimized] = useState(false)
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside the toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenPanel(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const togglePanel = (panel: OpenPanel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }

  if (!pdfFileName) return null

  return (
    <div
      ref={toolbarRef}
      className="absolute left-3 top-1/2 z-40 -translate-y-1/2 flex items-start gap-2 pointer-events-auto select-none"
    >
      {/* Collapse Toggle */}
      <div className="flex flex-col items-center gap-1 mt-1">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 rounded-full bg-background/95 shadow-md border hover:bg-muted"
          onClick={() => { setIsMinimized(!isMinimized); setOpenPanel(null) }}
          title={isMinimized ? 'Show Toolbar' : 'Hide Toolbar'}
        >
          {isMinimized ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, x: -16, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -16, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-background/95 p-1.5 shadow-2xl backdrop-blur-md"
          >
            {/* ── 1. SELECT ── */}
            <ToolBtn
              active={annotationMode === 'select'}
              onClick={() => { setAnnotationMode('select'); setOpenPanel(null) }}
              title="Select / Dictionary Mode"
            >
              <MousePointer className="h-4 w-4" />
            </ToolBtn>

            {/* ── 2. HIGHLIGHT ── */}
            <div className="relative">
              <ToolBtn
                active={annotationMode === 'highlight'}
                panelOpen={openPanel === 'highlight'}
                onClick={() => {
                  setAnnotationMode('highlight')
                  togglePanel('highlight')
                }}
                title="Highlight (click for colours)"
              >
                <Highlighter className="h-4 w-4" />
              </ToolBtn>

              <AnimatePresence>
                {openPanel === 'highlight' && (
                  <Popover>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Highlight colour
                    </p>
                    <div className="flex gap-2">
                      {HIGHLIGHT_COLORS.map((c) => (
                        <ColorSwatch
                          key={c.value}
                          tailwind={c.tailwind}
                          label={c.label}
                          active={highlightColor === c.value}
                          onClick={() => {
                            setHighlightColor(c.value)
                            setAnnotationMode('highlight')
                            setOpenPanel(null)
                          }}
                        />
                      ))}
                    </div>
                  </Popover>
                )}
              </AnimatePresence>
            </div>

            {/* ── 3. PEN ── */}
            <div className="relative">
              <ToolBtn
                active={annotationMode === 'pen'}
                panelOpen={openPanel === 'pen'}
                onClick={() => {
                  setAnnotationMode('pen')
                  togglePanel('pen')
                }}
                title="Freehand Pen (click for options)"
              >
                <PenTool className="h-4 w-4" />
              </ToolBtn>

              <AnimatePresence>
                {openPanel === 'pen' && (
                  <Popover wide>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Pen colour
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {PEN_COLORS.map((c) => (
                        <ColorSwatch
                          key={c.value}
                          tailwind={c.tailwind}
                          label={c.label}
                          active={penColor === c.value}
                          onClick={() => {
                            setPenColor(c.value)
                            setAnnotationMode('pen')
                          }}
                        />
                      ))}
                    </div>
                    <div className="border-t border-border pt-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          Thickness
                        </p>
                        <span className="text-[10px] font-semibold text-emerald-500">{penWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={penWidth}
                        onChange={(e) => setPenWidth(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-muted"
                      />
                    </div>
                  </Popover>
                )}
              </AnimatePresence>
            </div>

            {/* ── 4. ERASER ── */}
            <ToolBtn
              active={annotationMode === 'eraser'}
              onClick={() => { setAnnotationMode('eraser'); setOpenPanel(null) }}
              title="Eraser"
            >
              <Eraser className="h-4 w-4" />
            </ToolBtn>

            {/* ── 5. STICKY NOTE ── */}
            <ToolBtn
              active={annotationMode === 'note'}
              onClick={() => { setAnnotationMode('note'); setOpenPanel(null) }}
              title="Add Sticky Note"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </ToolBtn>

            <div className="my-0.5 border-t border-border/60" />

            {/* ── 6. CLEAR ALL ── */}
            <button
              onClick={() => { onClearAll(); setOpenPanel(null) }}
              title="Clear all page annotations"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-all active:scale-90"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Small shared sub-components ─────────────────────────────── */

function ToolBtn({
  active,
  panelOpen,
  onClick,
  title,
  children,
}: {
  active: boolean
  panelOpen?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90
        ${active
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
          : panelOpen
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }`}
    >
      {children}
    </button>
  )
}

function Popover({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -6, scale: 0.96 }}
      transition={{ duration: 0.14 }}
      className={`absolute left-[calc(100%+10px)] top-0 z-50 rounded-xl border border-border bg-background/98 p-3 shadow-xl backdrop-blur-md ${wide ? 'w-44' : 'w-auto'}`}
      // Prevent clicks inside the popover from propagating to the PDF canvas
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  )
}

function ColorSwatch({
  tailwind,
  label,
  active,
  onClick,
}: {
  tailwind: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-125 active:scale-95
        ${tailwind}
        ${active ? 'ring-2 ring-emerald-500 ring-offset-1 border-white' : 'border-transparent'}`}
    />
  )
}
