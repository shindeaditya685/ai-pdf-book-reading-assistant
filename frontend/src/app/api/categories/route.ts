import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ categories: [] })

  try {
    const pdfs = await conn.db
      .collection('pdfs')
      .find(
        { username: user.username, category: { $exists: true, $ne: '' } },
        { projection: { category: 1 } }
      )
      .toArray()

    const countMap = new Map<string, number>()
    for (const pdf of pdfs) {
      const cat = (pdf.category || '').trim()
      if (cat) countMap.set(cat, (countMap.get(cat) || 0) + 1)
    }

    const categories = Array.from(countMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ categories })
  } catch {
    return NextResponse.json({ categories: [] })
  }
}

export async function PATCH(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { action, name, newName } = body

    if (!action || !name) {
      return NextResponse.json({ error: 'action and name are required' }, { status: 400 })
    }

    if (action === 'rename') {
      if (!newName || !newName.trim()) {
        return NextResponse.json({ error: 'newName is required' }, { status: 400 })
      }
      await conn.db.collection('pdfs').updateMany(
        { username: user.username, category: name },
        { $set: { category: newName.trim(), updatedAt: new Date() } }
      )
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      await conn.db.collection('pdfs').updateMany(
        { username: user.username, category: name },
        { $set: { category: '', updatedAt: new Date() } }
      )
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ success: false })
  }
}
