import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileName, coverImage } = await request.json()
  if (!fileName || !coverImage) {
    return NextResponse.json({ error: 'fileName and coverImage are required' }, { status: 400 })
  }

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  try {
    await conn.db.collection('pdfs').updateOne(
      { fileName, username: user.username },
      { $set: { coverImage } }
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save cover' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get('fileName')
  if (!fileName) return NextResponse.json({ error: 'fileName is required' }, { status: 400 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ coverImage: null })

  try {
    const pdf = await conn.db.collection('pdfs').findOne(
      { fileName, username: user.username },
      { projection: { coverImage: 1 } }
    )
    return NextResponse.json({ coverImage: pdf?.coverImage || null })
  } catch {
    return NextResponse.json({ coverImage: null })
  }
}
