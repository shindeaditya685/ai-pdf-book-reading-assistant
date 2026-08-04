'use client'

import { useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface ResponsivePanelProps {
  open: boolean
  onClose: () => void
  /** Header content (icon + title + count + actions). Body is rendered separately. */
  header: ReactNode
  /** Scrollable body content. */
  children: ReactNode
  /** Optional footer (sticky at bottom of panel). */
  footer?: ReactNode
  /** Optional aria-label for the panel. */
  ariaLabel?: string
  /** Optional className for the panel container. */
  className?: string
}

/**
 * Wrapper that renders a right-side panel on desktop and a bottom sheet on
 * mobile, with consistent animations, focus management, and Escape-to-close.
 *
 * Replaces the previous `fixed right-0 top-0 w-80` pattern that overflowed on
 * phone screens (375px width).
 */
export function ResponsivePanel({
  open,
  onClose,
  header,
  children,
  footer,
  ariaLabel,
  className,
}: ResponsivePanelProps) {
  const isMobile = useIsMobile()

  // Lock body scroll when the mobile sheet is open
  useEffect(() => {
    if (!open || !isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isMobile])

  // Escape closes the panel
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label={ariaLabel}>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 400) onClose()
              }}
              className={cn(
                'relative mt-auto flex h-[88vh] max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border-t bg-background shadow-2xl',
                // Safe area for notched devices
                'pb-[env(safe-area-inset-bottom)]',
                className
              )}
            >
              <div className="flex items-center justify-center pt-2 pb-1">
                <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
              </div>
              {header}
              <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
              {footer}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l bg-background shadow-2xl',
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {header}
          <div className="flex-1 overflow-y-auto">{children}</div>
          {footer}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface PanelHeaderProps {
  icon?: React.ComponentType<{ className?: string }>
  iconClassName?: string
  title: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  onClose: () => void
  closeLabel?: string
}

export function PanelHeader({
  icon: Icon,
  iconClassName,
  title,
  badge,
  actions,
  onClose,
  closeLabel = 'Close',
}: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', iconClassName ?? 'text-brand')} />}
        <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        {badge}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
