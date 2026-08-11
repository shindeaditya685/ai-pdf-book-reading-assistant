import { NextResponse } from 'next/server'
import { GridFSBucket, ObjectId } from 'mongodb'
import { Readable } from 'stream'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getPdfObject } from '@/lib/storage'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get('fileName')
  if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 400 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  try {
    const pdf = await conn.db.collection('pdfs').findOne({ fileName, username: user.username })
    if (!pdf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const pdfHeaders = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
    }

    // R2 (PDF binaries stored in Cloudflare R2)
    const r2Key = (pdf as any).r2Key as string | undefined
    if (r2Key) {
      const stream = await getPdfObject(r2Key)
      const body = Readable.toWeb(stream) as unknown as ReadableStream
      return new NextResponse(body, { headers: pdfHeaders })
    }

    // GridFS (large files)
    const gridFsId = (pdf as any).gridFsId as string | undefined
    if (gridFsId) {
      const bucket = new GridFSBucket(conn.db, { bucketName: 'pdfs' })
      const downloadStream = bucket.openDownloadStream(new ObjectId(gridFsId))
      const chunks: Buffer[] = []
      for await (const chunk of downloadStream) {
        chunks.push(chunk as Buffer)
      }
      const buffer = Buffer.concat(chunks)
      return new NextResponse(buffer, { headers: pdfHeaders })
    }

    // Base64 inline (small files + legacy)
    const content = (pdf as any).content as string | undefined
    if (content) {
      const base64 = content.includes('base64,') ? content.split('base64,')[1] : content
      const buffer = Buffer.from(base64, 'base64')
      return new NextResponse(buffer, { headers: pdfHeaders })
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
