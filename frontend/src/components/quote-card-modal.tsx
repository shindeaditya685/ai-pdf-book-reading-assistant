'use client'

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { X, Download, Loader2 } from 'lucide-react'

interface QuoteCardModalProps {
  text: string
  context: string
  noteText: string
  bookTitle: string
  pageNumber: number
  timestamp: number
  color: string
  onClose: () => void
}

export function QuoteCardModal({
  text,
  context,
  noteText,
  bookTitle,
  pageNumber,
  timestamp,
  color,
  onClose,
}: QuoteCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 0.95, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `quote-${bookTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30)}.png`
      link.href = dataUrl
      link.click()
    } catch { /* ignore */ }
    setDownloading(false)
  }

  const accentColor = color && color !== 'rgba(253, 224, 71, 0.65)' ? color : '#b8860b'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card */}
        <div
          ref={cardRef}
          className="relative w-[400px] overflow-hidden rounded-sm"
          style={{
            backgroundColor: '#f5f0e8',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.06)',
          }}
        >
          {/* Paper texture overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundSize: '100px 100px',
              mixBlendMode: 'multiply',
            }}
          />

          {/* Decorative top border */}
          <div className="h-[3px] w-full" style={{ backgroundColor: accentColor }} />

          <div className="p-10">
            {/* Decorative opening mark */}
            <div className="mb-6 text-[60px] leading-none opacity-20 select-none" style={{ color: accentColor, fontFamily: 'Georgia, serif' }}>
              &ldquo;
            </div>

            {/* Quote text */}
            <p
              className="text-xl leading-relaxed"
              style={{
                fontFamily: 'var(--font-geist-serif), Georgia, serif',
                color: '#2c2420',
                lineHeight: 1.7,
              }}
            >
              {text}
            </p>

            {/* Context */}
            {context && context !== text && (
              <p
                className="mt-4 text-sm italic leading-relaxed"
                style={{ color: '#6b5c52', fontFamily: 'var(--font-geist-serif), Georgia, serif' }}
              >
                {context}
              </p>
            )}

            {/* Decorative divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 opacity-20" style={{ backgroundColor: accentColor }} />
              <div className="size-1.5 rotate-45 opacity-30" style={{ backgroundColor: accentColor }} />
              <div className="h-px flex-1 opacity-20" style={{ backgroundColor: accentColor }} />
            </div>

            {/* Book info */}
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: accentColor, fontFamily: 'var(--font-geist-mono), monospace' }}
                >
                  {bookTitle.replace(/\.pdf$/i, '')}
                </p>
                <p
                  className="mt-1 text-[10px] opacity-50"
                  style={{ color: '#6b5c52', fontFamily: 'var(--font-geist-mono), monospace' }}
                >
                  Page {pageNumber || '?'} &middot; {new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Note */}
            {noteText && (
              <div
                className="mt-5 border-l-2 pl-3"
                style={{ borderColor: accentColor }}
              >
                <p className="text-[11px] italic leading-relaxed" style={{ color: '#6b5c52' }}>
                  {noteText}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-brand-fg shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {downloading ? 'Downloading\u2026' : 'Save as PNG'}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-white/70 transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
