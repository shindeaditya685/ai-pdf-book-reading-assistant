import { GridFSBucket, ObjectId, type MongoClient, type Db } from 'mongodb'
import { isStorageConfigured, putPdfObject, pdfKey } from './storage'

export interface MigrationResult {
  total: number
  migrated: number
  skipped: number
  failed: number
  errors: string[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) await sleep(1500 * (i + 1))
    }
  }
  throw lastErr
}

async function downloadGridFs(conn: { db: Db }, gridFsId: string): Promise<Buffer> {
  const bucket = new GridFSBucket(conn.db, { bucketName: 'pdfs' })
  const downloadStream = bucket.openDownloadStream(new ObjectId(gridFsId))
  const chunks: Buffer[] = []
  for await (const chunk of downloadStream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

/**
 * Moves PDF binaries stored in MongoDB (inline base64 `content` or GridFS) to
 * S3-compatible object storage. Idempotent — docs that already have an
 * `r2Key`/`s3Key` are skipped — so it is safe to re-run after interruptions.
 * `onProgress` is called per file for logging.
 */
export async function migratePdfsToStorage(
  conn: { client: MongoClient; db: Db },
  onProgress?: (msg: string) => void
): Promise<MigrationResult> {
  const result: MigrationResult = { total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] }

  if (!isStorageConfigured()) throw new Error('Object storage is not configured')

  const docs = await conn.db
    .collection('pdfs')
    .find(
      { $or: [{ content: { $exists: true } }, { gridFsId: { $exists: true } }] },
      { projection: { fileName: 1, username: 1, content: 1, gridFsId: 1, r2Key: 1, s3Key: 1 } }
    )
    .toArray()

  result.total = docs.length

  let cursor = 0
  async function worker() {
    while (cursor < docs.length) {
      const doc = docs[cursor++]
      const label = `${doc.username}/${doc.fileName}`
      try {
        if (doc.r2Key || doc.s3Key) {
          result.skipped += 1
          continue
        }
        if (!doc.username || !doc.fileName) {
          result.skipped += 1
          continue
        }

        let buffer: Buffer
        if (doc.content) {
          const base64 = doc.content.includes('base64,') ? doc.content.split('base64,')[1] : doc.content
          buffer = Buffer.from(base64, 'base64')
        } else if (doc.gridFsId) {
          buffer = await downloadGridFs(conn, doc.gridFsId)
        } else {
          result.skipped += 1
          continue
        }

        const key = pdfKey(doc.username, doc.fileName)
        await retry(() => putPdfObject(key, buffer))

        await conn.db.collection('pdfs').updateOne(
          { _id: doc._id },
          {
            $set: { r2Key: key, size: buffer.length },
            $unset: { content: '', gridFsId: '' },
          }
        )

        if (doc.gridFsId) {
          const bucket = new GridFSBucket(conn.db, { bucketName: 'pdfs' })
          await bucket.delete(new ObjectId(doc.gridFsId)).catch(() => {})
        }

        result.migrated += 1
        onProgress?.(`✓ ${label}`)
      } catch (err: any) {
        result.failed += 1
        result.errors.push(`${label}: ${err?.message || err}`)
        onProgress?.(`✗ ${label}: ${err?.message || err}`)
      }
    }
  }

  await Promise.all(Array.from({ length: 1 }, worker))
  return result
}