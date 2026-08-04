'use client'

import { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, AlertCircle, RefreshCw, FileText, Download, Check, Play, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { SectionLabel } from '@/components/panel-primitives'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

// Performance fix (P13): previously `import * as pdfjsLib from 'pdfjs-dist'`
// was at module top level, pulling the entire pdfjs library into the
// dashboard bundle even when the summarizer panel was never opened. Now we
// lazy-load it inside extractText and set the worker source only once.
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null
async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((lib) => {
      if (typeof window !== 'undefined' && !lib.GlobalWorkerOptions.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
      }
      return lib
    })
  }
  return pdfjsLibPromise
}

export function SummarizerPanel() {
  const {
    pdfDataUrl,
    pdfFileName,
    currentPage,
    totalPages,
    ocrText,
    showSummarizer,
    setShowSummarizer,
  } = usePDFStore()

  // Panel settings
  const [scope, setScope] = useState<'current' | 'range'>('current')
  const [startPage, setStartPage] = useState<number>(currentPage || 1)
  const [endPage, setEndPage] = useState<number>(currentPage || 1)
  const [format, setFormat] = useState<'bullets' | 'concise' | 'detailed'>('concise')

  // UI state
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // Results
  const [summary, setSummary] = useState<string>('')
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([])
  
  // Checklist for revision
  const [checkedTakeaways, setCheckedTakeaways] = useState<Record<number, boolean>>({})

  // Retry state
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [retryTimer, setRetryTimer] = useState<number>(0)

  useEffect(() => {
    if (!retryAfter || retryTimer <= 0) return
    const id = setInterval(() => {
      setRetryTimer((t) => {
        if (t <= 1) { clearInterval(id); setRetryAfter(null); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [retryAfter, retryTimer])

  // Sync start/end page with currentPage when panel is opened or page changes
   
  useEffect(() => {
    if (showSummarizer && scope === 'current') {
      setStartPage(currentPage || 1)
      setEndPage(currentPage || 1)
    }
  }, [currentPage, showSummarizer, scope])
   

  // Helper to extract text from a range of pages
  const extractText = async (start: number, end: number): Promise<string> => {
    if (!pdfDataUrl) return ''
    
    setLoadingStep('Initializing PDF engine...')
    const pdfjsLib = await getPdfjs()
    const loadingTask = pdfjsLib.getDocument(pdfDataUrl)
    const pdf = await loadingTask.promise
    
    let text = ''
    for (let pageNum = start; pageNum <= end; pageNum++) {
      if (pageNum < 1 || pageNum > pdf.numPages) continue
      
      setLoadingStep(`Reading page ${pageNum}...`)
      // Check OCR first
      if (ocrText && ocrText[pageNum]?.text) {
        text += ocrText[pageNum].text + '\n'
        continue
      }

      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const items = textContent.items.filter((item: any) => 'str' in item)
        const pageText = items.map((item: any) => item.str).join(' ')
        text += pageText + '\n'
      } catch (err) {
        console.error(`Error reading page ${pageNum}`, err)
      }
    }
    return text.trim()
  }

  const handleSummarize = async () => {
    if (!pdfDataUrl) return
    setLoading(true)
    setError(null)
    setSummary('')
    setKeyTakeaways([])
    setCheckedTakeaways({})
    setRetryAfter(null)
    setRetryTimer(0)

    try {
      const start = scope === 'current' ? (currentPage || 1) : Math.min(Math.max(1, startPage), totalPages)
      const end = scope === 'current' ? (currentPage || 1) : Math.min(Math.max(startPage, endPage), totalPages)

      const extractedText = await extractText(start, end)
      if (!extractedText || extractedText.length < 50) {
        throw new Error('Not enough text content found on selected page(s). If this page is scanned, please wait for OCR to complete.')
      }

      setLoadingStep('AI is summarizing content...')
      const res = await authFetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedText.substring(0, 15000), // Safety cap on tokens
          format,
        }),
      })

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('ai-quota-changed'))
      } else {
        const errBody = await res.json().catch(() => ({}))
        if (errBody.retryAfter) {
          setRetryAfter(errBody.retryAfter)
          setRetryTimer(errBody.retryAfter)
        }
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('ai-quota-exceeded', { detail: { feature: 'summary' } }))
        }
        throw new Error(errBody.error || 'Failed to generate summary. Please try again.')
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setSummary(data.summary || '')
      setKeyTakeaways(data.keyTakeaways || [])
      setRetryAfter(null)
      setRetryTimer(0)
    } catch (err: any) {
      setError(err.message || 'An error occurred during summarization.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportMarkdown = () => {
    if (!summary && keyTakeaways.length === 0) return

    const start = scope === 'current' ? (currentPage || 1) : startPage
    const end = scope === 'current' ? (currentPage || 1) : endPage

    let content = `# Study Guide & Summary\n\n`
    content += `**Document**: ${pdfFileName || 'Unknown Document'}\n`
    content += `**Scope**: Page ${start} to ${end}\n`
    content += `**Date**: ${new Date().toLocaleDateString()}\n\n`
    content += `## Summary\n\n${summary}\n\n`
    
    if (keyTakeaways.length > 0) {
      content += `## Key Takeaways & Revision Notes\n\n`
      keyTakeaways.forEach((item) => {
        content += `- [ ] ${item}\n`
      })
    }

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const cleanFileName = (pdfFileName || 'notes').replace(/\.pdf$/i, '')
    a.download = `${cleanFileName}-summary-pg-${start}-${end}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleToggleCheck = (index: number) => {
    setCheckedTakeaways((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const handleReset = () => {
    setSummary('')
    setKeyTakeaways([])
    setCheckedTakeaways({})
    setError(null)
    setRetryAfter(null)
    setRetryTimer(0)
  }

  if (!showSummarizer) return null

  return (
    <ResponsivePanel
      open={showSummarizer}
      onClose={() => setShowSummarizer(false)}
      ariaLabel="AI Summarizer"
      header={
        <PanelHeader
          icon={Sparkles}
          eyebrow="Reading aid"
          title="Summarizer"
          onClose={() => setShowSummarizer(false)}
        />
      }
    >
      {/* Content Area */}
      <div className="flex h-full min-h-0 flex-col p-4 space-y-4 overflow-y-auto">
          {error && (
            <div className="flex gap-2 items-start rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Summarization Failed</p>
                <p className="mt-0.5 opacity-90">{error}</p>
                {retryAfter && (
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        setRetryAfter(null)
                        setRetryTimer(0)
                        handleSummarize()
                      }}
                      disabled={retryTimer > 0}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {retryTimer > 0 ? (
                        <><RefreshCw className="h-3 w-3 animate-spin" /> Retry in {retryTimer}s</>
                      ) : (
                        <><RefreshCw className="h-3 w-3" /> Retry Now</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            /* LOADING STATE */
            <div className="flex h-full flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-muted border-t-brand animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-brand animate-pulse" />
              </div>
              <div>
                <h3 className="font-serif text-sm font-semibold text-foreground">Reading the page</h3>
                <p className="text-xs text-muted-foreground/75 mt-1 font-medium">{loadingStep}</p>
              </div>
            </div>
          ) : !summary && keyTakeaways.length === 0 ? (
            /* SETUP CONFIG SCREEN */
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 space-y-3.5">
                <SectionLabel>Select scope</SectionLabel>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setScope('current')}
                    className={cn(
                      'flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors',
                      scope === 'current' ? 'bg-brand-soft border-brand/30 text-brand' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Current page ({currentPage})
                  </button>
                  <button
                    onClick={() => setScope('range')}
                    className={cn(
                      'flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors',
                      scope === 'range' ? 'bg-brand-soft border-brand/30 text-brand' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Custom range
                  </button>
                </div>

                {/* Range inputs if scope is range */}
                {scope === 'range' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex gap-2 items-center pt-1"
                  >
                    <div className="flex-1">
                      <label className="text-[9px] text-muted-foreground">Start page</label>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={startPage}
                        onChange={(e) => setStartPage(Math.min(totalPages, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-muted-foreground">End page</label>
                      <input
                        type="number"
                        min={startPage}
                        max={totalPages}
                        value={endPage}
                        onChange={(e) => setEndPage(Math.min(totalPages, Math.max(startPage, Number(e.target.value) || 1)))}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 space-y-3">
                <SectionLabel>Summary style</SectionLabel>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['bullets', 'concise', 'detailed'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setFormat(style)}
                      className={cn(
                        'rounded-lg py-2 text-[10px] font-semibold border transition-colors capitalize',
                        format === style ? 'bg-brand-soft border-brand/30 text-brand' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {style === 'bullets' ? 'Bullets' : style === 'concise' ? 'Concise' : 'Detailed'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSummarize}
                disabled={!pdfFileName}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-fg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                <Play className="h-4 w-4 fill-current" />
                Generate summary
              </button>
            </div>
          ) : (
            /* SUMMARY OUTPUT DISPLAY */
            <div className="space-y-4 pb-6 animate-fade-in">
              {/* Summary Paragraph */}
              {summary && (
                <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 space-y-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-brand" />
                    Overview
                  </span>
                  <p className="font-serif text-[13px] leading-relaxed text-foreground/90">
                    {summary}
                  </p>
                </div>
              )}

              {/* Key Takeaways revision lists */}
              {keyTakeaways.length > 0 && (
                <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 space-y-2.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Key takeaways & revision notes
                  </span>
                  <div className="space-y-2">
                    {keyTakeaways.map((point, index) => {
                      const isChecked = !!checkedTakeaways[index]
                      return (
                        <div
                          key={index}
                          onClick={() => handleToggleCheck(index)}
                          className="flex items-start gap-2.5 group cursor-pointer"
                        >
                          <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-all ${
                            isChecked ? 'bg-brand border-brand' : 'border-border bg-background group-hover:border-brand/60'
                          }`}>
                            {isChecked && <Check className="h-3 w-3 text-brand-fg stroke-[3px]" />}
                          </div>
                          <span className={`text-[11px] leading-relaxed transition-all select-none ${
                            isChecked ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground group-hover:text-foreground'
                          }`}>
                            {point}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 border-t border-border/40 pt-4">
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  New summary
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-xs font-semibold text-brand-fg transition-opacity hover:opacity-90"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export .MD
                </button>
              </div>
            </div>
          )}
      </div>
    </ResponsivePanel>
  )
}
