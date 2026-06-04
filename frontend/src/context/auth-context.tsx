'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

interface User {
  id: string
  username: string
  isAdmin?: boolean
}

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<string | null>
  register: (username: string, password: string) => Promise<string | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('auth-token')
    if (!stored) { setIsLoading(false); return }

    fetch('/api/auth/me', { headers: { authorization: `Bearer ${stored}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setToken(stored)
          setUser(data.user)
        } else {
          localStorage.removeItem('auth-token')
        }
      })
      .catch(() => localStorage.removeItem('auth-token'))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) return data.error || 'Login failed'
    localStorage.setItem('auth-token', data.token)
    setToken(data.token)
    setUser(data.user)
    return null
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) return data.error || 'Registration failed'
    localStorage.setItem('auth-token', data.token)
    setToken(data.token)
    setUser(data.user)
    return null
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth-token')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
