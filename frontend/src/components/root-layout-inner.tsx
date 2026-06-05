'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AuthProvider, useAuth } from '@/context/auth-context'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isPublicPage = pathname === '/' || pathname === '/about' || pathname === '/terms' || pathname === '/privacy' || pathname.startsWith('/_not-found')

  useEffect(() => {
    if (isLoading) return
    if (!user && !isAuthPage && !isPublicPage) router.push('/login')
    if (user && isAuthPage) router.push('/dashboard')
  }, [user, isLoading, isAuthPage, isPublicPage, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-emerald-500" />
      </div>
    )
  }

  if (!user && !isAuthPage && !isPublicPage) return null

  return <>{children}</>
}

export function RootLayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  )
}
