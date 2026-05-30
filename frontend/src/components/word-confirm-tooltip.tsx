'use client'

import { useEffect, useRef } from 'react'
import { BookOpen, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  word: string
  position: { x: number; y: number }
  onConfirm: () => void
  onDismiss: () => void
}

export function WordConfirmTooltip({ word, position, onConfirm, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onDismiss])

  // Clamp to viewport
  const tipWidth = 200
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  let left = position.x - tipWidth / 2
  left = Math.max(8, Math.min(left, vw - tipWidth - 8))
  const top = Math.max(8, position.y - 56)

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        data-popup
        className="fixed z-50"
        style={{ left, top, width: tipWidth }}
        initial={{ opacity: 0, y: 6, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.94 }}
        transition={{ duration: 0.13, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background/98 px-2.5 py-2 shadow-xl backdrop-blur-md">
          {/* Word label */}
          <span className="flex-1 truncate text-sm font-semibold text-foreground">
            {word}
          </span>

          {/* Confirm button */}
          <button
            onClick={(e) => { e.stopPropagation(); onConfirm() }}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95"
            title="Get meaning"
          >
            <BookOpen className="h-3 w-3" />
            Meaning
          </button>

          {/* Dismiss button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Downward arrow */}
        <div className="flex justify-center">
          <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-border" />
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
