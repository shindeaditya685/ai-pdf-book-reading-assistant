'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Trash2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StickyNoteItemProps {
  annotation: any
  scale: number
  onUpdate: (text: string) => void
  onDelete: () => void
}

export function StickyNoteItem({ annotation, scale, onUpdate, onDelete }: StickyNoteItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState(annotation.noteText || '')
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText(annotation.noteText || '')
  }, [annotation.noteText])

  // Close popup if clicked outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSave = () => {
    onUpdate(text)
    setIsOpen(false)
  }

  // Position is stored unscaled, so we multiply by the current viewport scale
  const left = annotation.x * scale
  const top = annotation.y * scale

  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Note Pin Icon */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md hover:bg-amber-600 transition-all hover:scale-110 active:scale-95 border border-white/20"
        style={{ backgroundColor: annotation.color || '#F59E0B' }}
        title="View sticky note"
      >
        <MessageSquare className="h-3.5 w-3.5 fill-white/20" />
      </button>

      {/* Note Edit Popover Card */}
      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 bottom-8 z-40 w-64 -translate-x-1/2 rounded-xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <span className="text-xs font-bold text-muted-foreground">Sticky Note</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                title="Delete note"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-20 resize-none rounded-lg border border-border bg-background/50 px-2 py-1.5 text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            placeholder="Type comment here..."
            autoFocus
          />
          <div className="flex justify-end gap-1.5 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-[10px] bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleSave}
            >
              <Check className="h-2.5 w-2.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
