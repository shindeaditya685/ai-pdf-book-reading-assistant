'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, FileText, X, Scan } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/context/auth-context'
import { clearActiveBook, setActiveBook, setStoredBookPage } from '@/lib/reading-progress'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'

export function UploadZone() {
  const {
    setPdfFile,
    setPdfDataUrl,
    setCurrentPage,
    pdfFileName,
    addRecentPdf,
    ocrEnabled,
    setOcrEnabled,
    clearOcrText,
  } = usePDFStore()
  const { user } = useAuth()
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file')
        return
      }
      setIsLoading(true)
      setProgress(0)

      progressIntervalRef.current = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 20, 90))
      }, 200)

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 90))
            }
          }
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        setProgress(100)
        setCurrentPage(1)
        setPdfFile(file)
        setPdfDataUrl(dataUrl)
        addRecentPdf({ fileName: file.name, timestamp: Date.now(), lastPage: 1, pageCount: 0 })
        setActiveBook(user?.username, file.name)
        setStoredBookPage(user?.username, file.name, 1)
        clearOcrText()
        // Save PDF to MongoDB
        authFetch('/api/db/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, content: dataUrl, pageCount: 0, lastPage: 1 }),
        }).catch(() => {})
      } catch (err) {
        console.error('Error reading PDF:', err)
        alert('Failed to read PDF file')
      } finally {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
        setTimeout(() => {
          setIsLoading(false)
          setProgress(0)
        }, 500)
      }
    },
    [addRecentPdf, clearOcrText, setCurrentPage, setPdfDataUrl, setPdfFile, user?.username]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleClear = useCallback(() => {
    clearActiveBook(user?.username)
    usePDFStore.getState().reset()
  }, [user?.username])

  if (pdfFileName) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="max-w-[200px] truncate text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {pdfFileName}
        </span>
        {isLoading && (
          <Progress value={progress} className="h-1.5 w-16" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-1 h-6 w-6 text-emerald-600 hover:bg-emerald-100 hover:text-red-500 dark:text-emerald-400 dark:hover:bg-emerald-900"
          onClick={handleClear}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-2.5 transition-all duration-200 ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30'
            : 'border-muted-foreground/25 bg-background hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20'
        }`}
      >
        <Upload
          className={`h-4 w-4 transition-colors ${
            isDragging
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground'
          }`}
        />
        {isLoading ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Loading...</span>
            <Progress value={progress} className="h-1.5 w-28" />
          </div>
        ) : (
          <label className="cursor-pointer">
            <span className="text-sm text-muted-foreground">
              Drop PDF here or{' '}
              <span className="font-medium text-emerald-600 underline decoration-emerald-300 underline-offset-2 dark:text-emerald-400 dark:decoration-emerald-700">
                browse
              </span>
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleInputChange}
              className="hidden"
              disabled={isLoading}
            />
          </label>
        )}
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2">
        <Scan className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">OCR</span>
        <Switch
          checked={ocrEnabled}
          onCheckedChange={setOcrEnabled}
          className="scale-75"
        />
      </div>
    </div>
  )
}
