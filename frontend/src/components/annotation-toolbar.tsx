'use client'

import { useState } from 'react'
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

// Pastel selection highlights
const HIGHLIGHT_COLORS = [
  { value: 'rgba(254, 240, 138, 0.45)', label: 'Yellow', tailwind: 'bg-yellow-200' },
  { value: 'rgba(187, 247, 208, 0.45)', label: 'Green', tailwind: 'bg-green-200' },
  { value: 'rgba(251, 207, 232, 0.45)', label: 'Pink', tailwind: 'bg-pink-200' },
  { value: 'rgba(191, 219, 254, 0.45)', label: 'Blue', tailwind: 'bg-blue-200' },
]

// Drawing pen colors
const PEN_COLORS = [
  { value: '#EF4444', tailwind: 'bg-red-500', label: 'Red' },
  { value: '#3B82F6', tailwind: 'bg-blue-500', label: 'Blue' },
  { value: '#10B981', tailwind: 'bg-emerald-500', label: 'Green' },
  { value: '#F59E0B', tailwind: 'bg-amber-500', label: 'Yellow' },
  { value: '#8B5CF6', tailwind: 'bg-purple-500', label: 'Purple' },
]

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

  if (!pdfFileName) return null

  return (
    <div className="absolute left-4 top-1/2 z-40 -translate-y-1/2 flex items-center gap-2 pointer-events-auto select-none">
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6 rounded-full bg-background/95 shadow-md border hover:bg-muted"
        onClick={() => setIsMinimized(!isMinimized)}
        title={isMinimized ? "Show Toolbar" : "Hide Toolbar"}
      >
        {isMinimized ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-background/90 p-2 shadow-2xl backdrop-blur-md"
          >
            {/* 1. SELECT MODE */}
            <Button
              variant={annotationMode === 'select' ? 'default' : 'ghost'}
              size="icon"
              className={`h-9 w-9 rounded-xl transition-all ${
                annotationMode === 'select'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => setAnnotationMode('select')}
              title="Text Selection / Dictionary Mode"
            >
              <MousePointer className="h-4 w-4" />
            </Button>

            {/* 2. HIGHLIGHT MODE */}
            <div className="relative group">
              <Button
                variant={annotationMode === 'highlight' ? 'default' : 'ghost'}
                size="icon"
                className={`h-9 w-9 rounded-xl transition-all ${
                  annotationMode === 'highlight'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                    : 'text-muted-foreground hover:bg-muted/80'
                }`}
                onClick={() => setAnnotationMode('highlight')}
                title="Highlight Mode"
              >
                <Highlighter className="h-4 w-4" />
              </Button>

              {/* Color choices on hover */}
              <div className="absolute left-12 top-0 hidden group-hover:flex items-center gap-1.5 rounded-xl border bg-background/95 p-1.5 shadow-lg backdrop-blur-md">
                {HIGHLIGHT_COLORS.map((color) => {
                  const isActive = highlightColor === color.value
                  return (
                    <button
                      key={color.value}
                      onClick={() => {
                        setHighlightColor(color.value)
                        setAnnotationMode('highlight')
                      }}
                      className={`h-5 w-5 rounded-full ${
                        color.tailwind
                      } transition-all hover:scale-125 border ${
                        isActive ? 'ring-2 ring-emerald-500 border-white' : 'border-border'
                      }`}
                      title={color.label}
                    />
                  )
                })}
              </div>
            </div>

            {/* 3. PEN MODE */}
            <div className="relative group">
              <Button
                variant={annotationMode === 'pen' ? 'default' : 'ghost'}
                size="icon"
                className={`h-9 w-9 rounded-xl transition-all ${
                  annotationMode === 'pen'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                    : 'text-muted-foreground hover:bg-muted/80'
                }`}
                onClick={() => setAnnotationMode('pen')}
                title="Freehand Drawing Pen"
              >
                <PenTool className="h-4 w-4" />
              </Button>

              {/* Color & Size adjustments on hover */}
              <div className="absolute left-12 top-0 hidden group-hover:flex flex-col gap-2 rounded-xl border bg-background/95 p-2.5 shadow-lg backdrop-blur-md w-36">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pen Color</span>
                <div className="flex gap-1.5">
                  {PEN_COLORS.map((color) => {
                    const isActive = penColor === color.value
                    return (
                      <button
                        key={color.value}
                        onClick={() => {
                          setPenColor(color.value)
                          setAnnotationMode('pen')
                        }}
                        className={`h-4.5 w-4.5 rounded-full ${
                          color.tailwind
                        } transition-all hover:scale-125 border ${
                          isActive ? 'ring-2 ring-emerald-500 border-white' : 'border-border'
                        }`}
                        title={color.label}
                      />
                    )
                  })}
                </div>
                <div className="border-t border-border my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Thickness: {penWidth}px
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={penWidth}
                  onChange={(e) => setPenWidth(Number(e.target.value))}
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            {/* 4. ERASER MODE */}
            <Button
              variant={annotationMode === 'eraser' ? 'default' : 'ghost'}
              size="icon"
              className={`h-9 w-9 rounded-xl transition-all ${
                annotationMode === 'eraser'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => setAnnotationMode('eraser')}
              title="Eraser (Drawings)"
            >
              <Eraser className="h-4 w-4" />
            </Button>

            {/* 5. STICKY NOTE MODE */}
            <Button
              variant={annotationMode === 'note' ? 'default' : 'ghost'}
              size="icon"
              className={`h-9 w-9 rounded-xl transition-all ${
                annotationMode === 'note'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
              onClick={() => setAnnotationMode('note')}
              title="Add Sticky Note Comment"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>

            <div className="border-t border-border/80 my-1" />

            {/* 6. CLEAR ALL ANNOTATIONS */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-all active:scale-95"
              onClick={onClearAll}
              title="Clear all page annotations"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
