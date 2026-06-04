'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OpenPdfPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-emerald-500" />
    </div>
  )
}
