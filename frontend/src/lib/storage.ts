import { Upload } from '@aws-sdk/lib-storage'
import { S3Client, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

// S3-compatible object storage. Works with Supabase Storage (endpoint
// `https://<project-ref>.supabase.co/storage/v1/s3`), Cloudflare R2
// (`https://<account-id>.r2.cloudflarestorage.com`), or any S3 endpoint.
const endpoint = process.env.S3_ENDPOINT || ''
const region = process.env.S3_REGION || 'auto'
const accessKeyId = process.env.S3_ACCESS_KEY_ID || ''
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || ''
const bucket = process.env.S3_BUCKET_NAME || ''
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false'

let cachedClient: S3Client | null = null

export function isStorageConfigured() {
  return Boolean(endpoint && accessKeyId && secretAccessKey && bucket)
}

function storageClient(): S3Client {
  if (!isStorageConfigured()) throw new Error('Object storage (S3/Supabase) is not configured')
  if (!cachedClient) {
    cachedClient = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    })
  }
  return cachedClient
}

export function pdfKey(username: string, fileName: string) {
  // Supabase Storage rejects object keys with URL-reserved characters (#, ?, %,
  // [, ], etc.) or non-ASCII text (e.g. curly apostrophes). Keep the key
  // deterministic so uploads, GETs and DELETEs always agree.
  const safe = fileName.replace(/[^\w .+()~'/-]/g, '_')
  return `pdfs/${username}/${safe}`
}

export async function putPdfObject(key: string, buffer: Buffer) {
  // Multipart upload (5MB parts) so large PDFs survive slow/limited connections —
  // a single PUT of a >~30MB file trips CloudFront's 100s timeout on Supabase.
  const upload = new Upload({
    client: storageClient(),
    params: {
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    },
    partSize: 5 * 1024 * 1024,
    queueSize: 1,
  })
  await upload.done()
}

export async function getPdfObject(key: string): Promise<Readable> {
  const res = await storageClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return res.Body as Readable
}

export async function deleteStorageObject(key: string) {
  if (!key) return
  try {
    await storageClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch {
    // Non-critical — object may not exist
  }
}

export async function listStorageKeys(): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined
  do {
    const res = await storageClient().send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 })
    )
    for (const obj of res.Contents || []) {
      if (obj.Key) keys.push(obj.Key)
    }
    token = res.NextContinuationToken
  } while (token)
  return keys
}
