import { connectToDatabase } from './db'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
}

/**
 * Mongo-backed sliding-window rate limiter.
 *
 * The previous implementation used an in-memory Map, which is
 * effectively non-functional on serverless (each isolate has its own
 * map, so the 5/min login limit essentially never trips). This version
 * uses an atomic findOneAndUpdate on a per-window bucket document.
 *
 * Requires a TTL index on the rateLimits collection:
 *   db.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
 * (The migration script in scripts/create-indexes.ts sets this up.)
 *
 * Falls back to an in-memory map when the DB is unavailable, so the
 * app still functions during a DB outage.
 */

const memoryBuckets = new Map<string, { count: number; resetAt: number }>()

export async function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60000,
): Promise<RateLimitResult> {
  const now = Date.now()
  const bucketId = `${key}:${Math.floor(now / windowMs)}`
  const resetIn = windowMs - (now % windowMs)

  const conn = await connectToDatabase()
  if (!conn) {
    // DB unavailable — fall back to in-memory so we don't fail open entirely.
    const entry = memoryBuckets.get(bucketId)
    if (!entry) {
      memoryBuckets.set(bucketId, { count: 1, resetAt: now + windowMs })
      return { allowed: true, remaining: maxAttempts - 1, resetIn }
    }
    entry.count++
    if (entry.count > maxAttempts) {
      return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
    }
    return { allowed: true, remaining: maxAttempts - entry.count, resetIn: entry.resetAt - now }
  }

  try {
    const res = await (conn.db.collection('rateLimits') as any).findOneAndUpdate(
      { _id: bucketId },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(now + windowMs + 5000) },
      },
      { upsert: true, returnDocument: 'after' },
    )
    const count = res?.count ?? 1
    return {
      allowed: count <= maxAttempts,
      remaining: Math.max(0, maxAttempts - count),
      resetIn,
    }
  } catch {
    // DB error — fail open (allow) but log.
    console.warn('[rate-limit] DB error, failing open for', key)
    return { allowed: true, remaining: maxAttempts - 1, resetIn }
  }
}

// Periodically clear stale in-memory entries (dev fallback only).
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryBuckets) {
      if (now > entry.resetAt) memoryBuckets.delete(key)
    }
  }, 60000)
}
