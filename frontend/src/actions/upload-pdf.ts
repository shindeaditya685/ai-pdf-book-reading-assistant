'use server'

import { GridFSBucket, ObjectId, type MongoClient, type Db } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

const MAX_INLINE_BYTES = 10 * 1024 * 1024 // ≤10MB → stored as base64
const HARD_MAX_BYTES = 50 * 1024 * 1024 // 50MB absolute upload cap
const MAX_PDFS_PER_USER = 50
const MAX_TOTAL_BYTES_PER_USER = 500 * 1024 * 1024 // 500MB

const toPositiveInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(fallback, Math.round(parsed))
}

function getGridFsBucket(conn: { client: MongoClient; db: Db } | null) {
  if (!conn) return null
  return new GridFSBucket(conn.db, { bucketName: 'pdfs' })
}

export async function uploadPdfAction(formData: FormData): Promise<{
  success: boolean
  error?: string
  id?: string
}> {
  // Authenticate via token passed in FormData (Server Actions don't receive custom headers)
  const token = formData.get('token') as string | null
  if (!token) return { success: false, error: 'No auth token provided' }

  const user = verifyToken(token)
  if (!user) return { success: false, error: 'Invalid or expired token' }

  const conn = await connectToDatabase()
  if (!conn) return { success: false, error: 'Database unavailable' }

  try {
    const file = formData.get('file') as File | null
    const fileName = (formData.get('fileName') as string) || (file ? file.name : '')
    const pageCount = Number(formData.get('pageCount')) || 0
    const lastPage = Number(formData.get('lastPage')) || 1

    if (!file || !fileName) {
      return { success: false, error: 'File and fileName required' }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Security fix (S6): hard size cap + per-user quota. Previously a user
    // could upload arbitrarily large / many PDFs and exhaust storage.
    if (buffer.length > HARD_MAX_BYTES) {
      return { success: false, error: 'PDF must be under 50 MB.' }
    }

    const pdfCount = await conn.db.collection('pdfs').countDocuments({ username: user.username })
    if (pdfCount >= MAX_PDFS_PER_USER) {
      return {
        success: false,
        error: `Library limit reached (${MAX_PDFS_PER_USER} PDFs). Delete some to upload more.`,
      }
    }

    // Estimate total bytes already used by this user (inline + GridFS sizes).
    const agg = await conn.db.collection('pdfs').aggregate([
      { $match: { username: user.username } },
      {
        $project: {
          bytes: {
            $ifNull: [
              '$size',
              {
                $cond: [
                  { $ifNull: ['$content', false] },
                  { $multiply: [{ $strLenCP: { $ifNull: ['$content', ''] } }, 0.75] },
                  0,
                ],
              },
            ],
          },
        },
      },
      { $group: { _id: null, total: { $sum: '$bytes' } } },
    ]).toArray()
    const usedBytes = agg[0]?.total ?? 0
    if (usedBytes + buffer.length > MAX_TOTAL_BYTES_PER_USER) {
      return {
        success: false,
        error: 'Storage limit reached (500 MB). Delete some PDFs to free space.',
      }
    }

    let contentBase64ForDb: string | undefined = undefined
    if (buffer.length <= MAX_INLINE_BYTES) {
      contentBase64ForDb = `data:application/pdf;base64,${buffer.toString('base64')}`
    }

    const safePageCount = toPositiveInt(pageCount, 0)
    const safeLastPage = Math.max(1, toPositiveInt(lastPage, 1))

    const existing = await conn.db
      .collection('pdfs')
      .findOne({ fileName, username: user.username })

    // Delete old GridFS file if it exists
    if (existing) {
      const oldGridFsId = (existing as any).gridFsId as string | undefined
      if (oldGridFsId) {
        const bucket = getGridFsBucket(conn)
        if (bucket) {
          await bucket.delete(new ObjectId(oldGridFsId)).catch(() => {})
        }
      }
    }

    if (buffer.length <= MAX_INLINE_BYTES) {
      // Small file: store as base64 inline
      if (existing) {
        const existingPageCount = toPositiveInt(existing.pageCount, 0)
        const existingLastPage = Math.max(1, toPositiveInt(existing.lastPage, 1))
        await conn.db.collection('pdfs').updateOne(
          { _id: existing._id },
          {
            $set: {
              content: contentBase64ForDb,
              size: buffer.length,
              pageCount: Math.max(existingPageCount, safePageCount),
              lastPage: Math.max(existingLastPage, safeLastPage),
              updatedAt: new Date(),
            },
            $unset: { gridFsId: '' },
          }
        )
        return { id: existing._id.toString(), success: true }
      }

      const result = await conn.db.collection('pdfs').insertOne({
        fileName,
        content: contentBase64ForDb,
        size: buffer.length,
        pageCount: safePageCount,
        lastPage: safeLastPage,
        username: user.username,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      return { id: result.insertedId.toString(), success: true }
    }

    // Large file: store via GridFS
    const bucket = getGridFsBucket(conn)
    if (!bucket) return { success: false, error: 'Storage unavailable' }

    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: { username: user.username },
    })
    uploadStream.end(buffer)
    await new Promise<void>((resolve, reject) => {
      uploadStream.on('finish', () => resolve())
      uploadStream.on('error', reject)
    })
    const gridFsId = uploadStream.id.toString()

    if (existing) {
      const existingPageCount = toPositiveInt(existing.pageCount, 0)
      const existingLastPage = Math.max(1, toPositiveInt(existing.lastPage, 1))
      await conn.db.collection('pdfs').updateOne(
        { _id: existing._id },
        {
          $set: {
            gridFsId,
            size: buffer.length,
            pageCount: Math.max(existingPageCount, safePageCount),
            lastPage: Math.max(existingLastPage, safeLastPage),
            updatedAt: new Date(),
          },
          $unset: { content: '' },
        }
      )
      return { id: existing._id.toString(), success: true }
    }

    const result = await conn.db.collection('pdfs').insertOne({
      fileName,
      gridFsId,
      size: buffer.length,
      pageCount: safePageCount,
      lastPage: safeLastPage,
      username: user.username,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return { id: result.insertedId.toString(), success: true }
  } catch (err) {
    console.error('Error in uploadPdfAction:', err)
    return { success: false, error: 'Upload failed — server error' }
  }
}
