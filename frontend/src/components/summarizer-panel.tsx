'use client'

import { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, AlertCircle, RefreshCw, FileText, Download, Check, Play, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker source
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
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

  // Sync start/end page with currentPage when panel is opened or page changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (showSummarizer && scope === 'current') {
      setStartPage(currentPage || 1)
      setEndPage(currentPage || 1)
    }
  }, [currentPage, showSummarizer, scope])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Helper to extract text from a range of pages
  const extractText = async (start: number, end: number): Promise<string> => {
    if (!pdfDataUrl) return ''
    
    setLoadingStep('Initializing PDF engine...')
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
      } else if (res.status === 429) {
        window.dispatchEvent(new CustomEvent('ai-quota-exceeded', { detail: { feature: 'summary' } }))
      }

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || 'Failed to generate summary. Please try again.')
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setSummary(data.summary || '')
      setKeyTakeaways(data.keyTakeaways || [])
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
          title="AI Summarizer"
          onClose={() => setShowSummarizer(false)}
        />
      }
    >
      {/* Content Area */}
      <div className="flex h-full min-h-0 flex-col p-4 space-y-4 overflow-y-auto">
          {error && (
            <div className="flex gap-2 items-start rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Summarization Failed</p>
                <p className="mt-0.5 opacity-90">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            /* LOADING STATE */
            <div className="flex h-full flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-muted border-t-emerald-500 animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-emerald-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">AI Summary Active</h3>
                <p className="text-xs text-muted-foreground/75 mt-1 font-medium">{loadingStep}</p>
              </div>
            </div>
          ) : !summary && keyTakeaways.length === 0 ? (
            /* SETUP CONFIG SCREEN */
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3.5">
                {/* 1. Scope selection */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Scope</label>
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      onClick={() => setScope('current')}
                      className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                        scope === 'current' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Current Page ({currentPage})
                    </button>
                    <button
                      onClick={() => setScope('range')}
                      className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                        scope === 'range' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Custom Range
                    </button>
                  </div>
                </div>

                {/* Range inputs if scope is range */}
                {scope === 'range' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex gap-2 items-center pt-1"
                  >
                    <div className="flex-1">
                      <label className="text-[9px] text-muted-foreground">Start Page</label>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={startPage}
                        onChange={(e) => setStartPage(Math.min(totalPages, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-muted-foreground">End Page</label>
                      <input
                        type="number"
                        min={startPage}
                        max={totalPages}
                        value={endPage}
                        onChange={(e) => setEndPage(Math.min(totalPages, Math.max(startPage, Number(e.target.value) || 1)))}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 2. Format Selection */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Summary Style</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['bullets', 'concise', 'detailed'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setFormat(style)}
                      className={`rounded-lg py-2 text-[10px] font-semibold border capitalize transition-colors ${
                        format === style ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {style === 'bullets' ? 'Bullets' : style === 'concise' ? 'Concise' : 'Detailed'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleSummarize}
                disabled={!pdfFileName}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-semibold text-white hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-500/10 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                <Play className="h-4 w-4 fill-white" />
                Generate Summary
              </button>
            </div>
          ) : (
            /* SUMMARY OUTPUT DISPLAY */
            <div className="space-y-4 pb-6 animate-fade-in">
              {/* Summary Paragraph */}
              {summary && (
                <div className="rounded-xl border border-border bg-background p-3.5 shadow-sm space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-emerald-500" />
                    Overview
                  </span>
                  <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                    {summary}
                  </p>
                </div>
              )}

              {/* Key Takeaways revision lists */}
              {keyTakeaways.length > 0 && (
                <div className="rounded-xl border border-border bg-background p-3.5 shadow-sm space-y-2.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Key Takeaways & Revision Notes
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
                            isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-border bg-background group-hover:border-emerald-500'
                          }`}>
                            {isChecked && <Check className="h-3 w-3 text-white stroke-[3px]" />}
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
              <div className="flex gap-2 border-t border-border/60 pt-4">
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  New Summary
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
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
