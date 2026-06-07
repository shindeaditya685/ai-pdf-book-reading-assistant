import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { QUOTE_LIMITS, cleanText } from '@/lib/quotes'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    if (!id || !ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
    const body = await request.json()

    const update: Record<string, unknown> = {}
    if (typeof body.noteText === 'string') {
      update.noteText = cleanText(body.noteText).slice(0, QUOTE_LIMITS.NOTE_MAX)
    }
    if (typeof body.context === 'string') {
      update.context = cleanText(body.context).slice(0, QUOTE_LIMITS.CONTEXT_MAX)
    }
    if (typeof body.text === 'string') {
      const t = cleanText(body.text)
      if (!t) return NextResponse.json({ success: false, error: 'Quote text cannot be empty' }, { status: 400 })
      if (t.length > QUOTE_LIMITS.TEXT_MAX) {
        return NextResponse.json({ success: false, error: `Quote must be \u2264 ${QUOTE_LIMITS.TEXT_MAX} characters` }, { status: 400 })
      }
      update.text = t
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: 'No updatable fields provided' }, { status: 400 })
    }

    const result = await conn.db.collection('quotes').updateOne(
      { _id: new ObjectId(id), username: user.username },
      { $set: update }
    )
    return NextResponse.json({ success: true, modified: result.modifiedCount })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update quote' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 })

  try {
    const { id } = await params
    if (!id || !ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })

    const objectId = new ObjectId(id)
    const result = await conn.db.collection('quotes').deleteOne({ _id: objectId, username: user.username })
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Quote not found' }, { status: 404 })
    }

    // Detach this quote id from any conversations that reference it.
    await conn.db.collection('quoteConversations').updateMany(
      { username: user.username, quoteIds: id },
       
      { $pull: { quoteIds: id } as any }
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete quote' }, { status: 500 })
  }
}
