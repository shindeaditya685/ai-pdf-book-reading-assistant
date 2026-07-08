/**
 * Database index migration script.
 *
 * Run once after deploy (and re-run any time the schema evolves —
 * createIndex is idempotent). The SSE poller and all the per-user queries
 * depend on these indexes; without them the poller does 9 collection scans
 * every 500ms per connected client.
 *
 *   npx tsx scripts/create-indexes.ts
 *   # or: npx ts-node scripts/create-indexes.ts
 *
 * Requires DATABASE_URL in the environment.
 */
import { MongoClient } from 'mongodb'

const uri = process.env.DATABASE_URL
if (!uri) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

async function main() {
  const client = new MongoClient(uri as string, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  })
  await client.connect()
  const db = client.db()
  console.log(`[migrate] connected to ${db.databaseName}`)

  const ops: Promise<string>[] = []

  // Auth & users
  ops.push(db.collection('users').createIndex({ username: 1 }, { unique: true }))

  // PDFs
  ops.push(db.collection('pdfs').createIndex({ username: 1, fileName: 1 }, { unique: true }))
  ops.push(db.collection('pdfs').createIndex({ username: 1, updatedAt: -1 }))

  // Bookmarks / word history / annotations / quotes (per-user)
  ops.push(db.collection('bookmarks').createIndex({ username: 1, pdfFileName: 1, timestamp: -1 }))
  ops.push(db.collection('wordHistory').createIndex({ username: 1, pdfFileName: 1 }))
  ops.push(db.collection('annotations').createIndex({ annotationId: 1, username: 1 }, { unique: true }))
  ops.push(db.collection('annotations').createIndex({ username: 1, pdfFileName: 1 }))
  ops.push(db.collection('quotes').createIndex({ username: 1, pdfFileName: 1, timestamp: -1 }))

  // Quote chat
  ops.push(db.collection('quoteConversations').createIndex({ username: 1, updatedAt: -1 }))
  ops.push(db.collection('quoteMessages').createIndex({ conversationId: 1, createdAt: 1 }))

  // Share sessions
  ops.push(db.collection('shareSessions').createIndex({ inviteCode: 1 }, { unique: true }))
  ops.push(db.collection('shareSessions').createIndex({ 'members.username': 1 }))
  ops.push(db.collection('shareSessions').createIndex({ _id: 1, updatedAt: 1 }))

  // Shared resources (all keyed by sessionId + updatedAt for the SSE poller)
  ops.push(db.collection('sharedAnnotations').createIndex({ annotationId: 1, sessionId: 1 }, { unique: true }))
  ops.push(db.collection('sharedAnnotations').createIndex({ sessionId: 1, updatedAt: -1 }))
  ops.push(db.collection('sharedBookmarks').createIndex({ bookmarkId: 1, sessionId: 1 }, { unique: true }))
  ops.push(db.collection('sharedBookmarks').createIndex({ sessionId: 1, updatedAt: -1 }))
  ops.push(db.collection('sharedFlashcards').createIndex({ flashcardId: 1, sessionId: 1 }, { unique: true }))
  ops.push(db.collection('sharedFlashcards').createIndex({ sessionId: 1, updatedAt: -1 }))
  ops.push(db.collection('sharedQuotes').createIndex({ quoteId: 1, sessionId: 1 }, { unique: true }))
  ops.push(db.collection('sharedQuotes').createIndex({ sessionId: 1, updatedAt: -1 }))

  // Session realtime collections
  ops.push(db.collection('sessionChat').createIndex({ sessionId: 1, createdAt: 1 }))
  ops.push(db.collection('sessionEvents').createIndex({ sessionId: 1, createdAt: 1 }))
  ops.push(db.collection('sessionTimers').createIndex({ sessionId: 1 }, { unique: true }))
  ops.push(db.collection('sessionTts').createIndex({ sessionId: 1 }, { unique: true }))
  ops.push(db.collection('sessionPresence').createIndex({ sessionId: 1, username: 1 }, { unique: true }))
  ops.push(db.collection('sessionPresence').createIndex({ sessionId: 1, lastSeen: 1 }))

  // Grants & access requests & admin
  ops.push(db.collection('grants').createIndex({ username: 1, active: 1, expiresAt: 1 }))
  ops.push(db.collection('accessRequests').createIndex({ userId: 1, status: 1 }))
  ops.push(db.collection('accessRequests').createIndex({ status: 1, createdAt: -1 }))
  ops.push(db.collection('auditLog').createIndex({ createdAt: -1 }))
  ops.push(db.collection('announcements').createIndex({ active: 1, expiresAt: 1 }))

  // Rate limiter — TTL index so bucket docs auto-expire
  ops.push(db.collection('rateLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }))

  const results = await Promise.allSettled(ops)
  let ok = 0
  let failed = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok++
    else {
      failed++
      console.error(`[migrate] index ${i} failed:`, r.reason)
    }
  })
  console.log(`[migrate] done: ${ok} succeeded, ${failed} failed`)

  // Backfill: set `size` on pdfs that predate the size field (best-effort).
  const pdfsMissingSize = await db.collection('pdfs').find({ size: { $exists: false } }).toArray()
  for (const pdf of pdfsMissingSize) {
    let size = 0
    if (pdf.content) {
      // base64 → bytes (~0.75 ratio), minus the data URL prefix
      const b64 = String(pdf.content).split(',')[1] || ''
      size = Math.round(b64.length * 0.75)
    } else if (pdf.gridFsId) {
      try {
        const file = await db.collection('pdfs.files').findOne({ _id: new (require('mongodb').ObjectId)(pdf.gridFsId) })
        size = file?.length ?? 0
      } catch { size = 0 }
    }
    await db.collection('pdfs').updateOne({ _id: pdf._id }, { $set: { size } })
  }
  if (pdfsMissingSize.length > 0) {
    console.log(`[migrate] backfilled size on ${pdfsMissingSize.length} pdfs`)
  }

  await client.close()
  console.log('[migrate] connection closed')
}

main().catch((err) => {
  console.error('[migrate] fatal:', err)
  process.exit(1)
})
