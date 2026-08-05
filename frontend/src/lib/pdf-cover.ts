import { authFetch } from '@/lib/api'

export async function generateFirstPageCover(fileName: string, dataUrl: string): Promise<void> {
  const pdfjsLib = await import('pdfjs-dist')
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
  }
  const pdf = await pdfjsLib.getDocument(dataUrl).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 0.3 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  await page.render({ canvasContext: ctx, viewport }).promise
  const coverDataUrl = canvas.toDataURL('image/jpeg', 0.8)
  await authFetch('/api/cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, coverImage: coverDataUrl }),
  })
}
