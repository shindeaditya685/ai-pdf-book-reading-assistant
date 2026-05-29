export function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  return token ? { authorization: `Bearer ${token}` } : {}
}

export function authFetch(url: string, options: RequestInit = {}) {
  const headers = { ...options.headers, ...authHeaders() } as Record<string, string>
  return fetch(url, { ...options, headers })
}
