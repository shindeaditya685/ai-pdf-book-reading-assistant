'use client'

import { useCallback, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePDFStore } from '@/store/use-pdf-store'

export function UploadZone() {
  const { setPdfFile, setPdfDataUrl, pdfFileName } = usePDFStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file')
        return
      }
      setIsLoading(true)
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        setPdfFile(file)
        setPdfDataUrl(dataUrl)
      } catch (err) {
        console.error('Error reading PDF:', err)
        alert('Failed to read PDF file')
      } finally {
        setIsLoading(false)
      }
    },
    [setPdfFile, setPdfDataUrl]
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
    usePDFStore.getState().reset()
  }, [])

  if (pdfFileName) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="max-w-[200px] truncate text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {pdfFileName}
        </span>
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
      <label className="cursor-pointer">
        <span className="text-sm text-muted-foreground">
          {isLoading ? 'Loading...' : 'Drop PDF here or '}
          {!isLoading && (
            <span className="font-medium text-emerald-600 underline decoration-emerald-300 underline-offset-2 dark:text-emerald-400 dark:decoration-emerald-700">
              browse
            </span>
          )}
        </span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="hidden"
          disabled={isLoading}
        />
      </label>
    </div>
  )
}
