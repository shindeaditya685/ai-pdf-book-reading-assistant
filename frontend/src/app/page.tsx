'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { BookOpen, Brain, Sparkles } from 'lucide-react'
import { UploadZone } from '@/components/upload-zone'
import { WordPopup } from '@/components/word-popup'
import { SettingsPanel } from '@/components/settings-panel'
import { usePDFStore } from '@/store/use-pdf-store'

// Dynamically import PDFViewer to avoid loading pdfjs-dist in the initial bundle
const PDFViewer = dynamic(
  () => import('@/components/pdf-viewer').then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-emerald-500" />
          <p className="text-sm text-muted-foreground">Loading PDF engine...</p>
        </div>
      </div>
    ),
  }
)

export default function Home() {
  const { pdfDataUrl, clearSelection } = usePDFStore()

  // Close popup on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection])

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">
              PDF Reader AI
            </h1>
            <p className="text-[10px] leading-tight text-muted-foreground">
              Click any word to understand it instantly
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SettingsPanel />
          <UploadZone />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1 overflow-hidden">
        <PDFViewer />
        <WordPopup />
      </main>

      {/* Footer - only visible when no PDF */}
      {!pdfDataUrl && (
        <footer className="border-t bg-muted/30 px-4 py-6">
          <div className="mx-auto max-w-3xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Context-Aware AI
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Understands word meanings based on how they are used in the
                    sentence, not just dictionary definitions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                  <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Instant Popups
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Click or select any word to get its meaning, pronunciation,
                    and translation right beside it.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Multi-Language
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Get translations in Hindi, Marathi, Spanish, French, and
                    many more languages.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
