const attempts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1, resetIn: windowMs }
  }

  entry.count++
  if (entry.count > maxAttempts) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  return { allowed: true, remaining: maxAttempts - entry.count, resetIn: entry.resetAt - now }
}

// Periodically clear stale entries to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of attempts) {
      if (now > entry.resetAt) attempts.delete(key)
    }
  }, 60000)
}
