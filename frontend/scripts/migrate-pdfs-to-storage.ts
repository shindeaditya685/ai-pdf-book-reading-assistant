/**
 * One-off migration: moves existing PDF binaries out of MongoDB (inline base64
 * `content` and GridFS) into S3-compatible object storage (Supabase Storage or
 * Cloudflare R2). Metadata stays in Mongo.
 *
 * Run with: npx tsx --env-file=.env.local scripts/migrate-pdfs-to-storage.ts
 * (requires DATABASE_URL and the S3_* variables)
 *
 * Idempotent — safe to re-run after an interruption. On Render you can instead
 * trigger POST /api/db/migrate-to-s3 with an admin Bearer token.
 */
import { connectToDatabase } from '../src/lib/db'
import { migratePdfsToStorage } from '../src/lib/migrate-pdfs'

async function main() {
  const conn = await connectToDatabase()
  if (!conn) {
    console.error('[migrate] Database unavailable, aborting.')
    process.exit(1)
  }

  console.log('[migrate] Starting...')
  const result = await migratePdfsToStorage(conn, (msg) => console.log(msg))

  console.log(`\n[migrate] Done. Total: ${result.total}, Migrated: ${result.migrated}, Skipped: ${result.skipped}, Failed: ${result.failed}`)
  if (result.errors.length) {
    console.log('Errors:')
    for (const e of result.errors) console.log('  ' + e)
  }
  process.exit(result.failed ? 1 : 0)
}

main()