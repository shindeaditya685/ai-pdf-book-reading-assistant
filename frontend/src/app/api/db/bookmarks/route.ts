import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pdfFileName = searchParams.get('pdfFileName')

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json([])

  try {
    const filter: any = { username: user.username }
    if (pdfFileName) filter.pdfFileName = pdfFileName
    const bookmarks = await conn.db
      .collection('bookmarks')
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray()
    return NextResponse.json(bookmarks)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const body = await request.json()
    const { word, meaning, pronunciation, translation, sentence, pageNumber, pdfFileName, partOfSpeech, example } = body

    if (!word || !pdfFileName) {
      return NextResponse.json({ success: false })
    }

    // Allow single words AND multi-word phrases (removed single-word
    // restriction so users can bookmark selected phrases/lines).
    if (word.length > 200) {
      return NextResponse.json({ success: false, error: 'word too long' }, { status: 400 })
    }

    const normalizedWord = word.trim().toLowerCase()

    // Check for duplicates globally for this user
    const existing = await conn.db.collection('bookmarks').findOne({
      username: user.username,
      word: normalizedWord,
    })

    if (existing) {
      return NextResponse.json({ id: existing._id.toString(), success: true, alreadyExists: true })
    }

    const doc = {
      word: normalizedWord,
      meaning: meaning || '',
      pronunciation: pronunciation || '',
      translation: translation || '',
      sentence: sentence || '',
      pageNumber: pageNumber || 0,
      pdfFileName,
      partOfSpeech: partOfSpeech || '',
      example: example || '',
      username: user.username,
      timestamp: new Date(),
    }
    const result = await conn.db.collection('bookmarks').insertOne(doc)

    return NextResponse.json({ id: result.insertedId.toString(), success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}

export async function DELETE(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const word = searchParams.get('word')
    
    let deleteWord = ''

    if (id) {
      const { ObjectId } = await import('mongodb')
      const bookmark = await conn.db.collection('bookmarks').findOne({ _id: new ObjectId(id), username: user.username })
      if (bookmark) {
        deleteWord = bookmark.word
        await conn.db.collection('bookmarks').deleteOne({ _id: new ObjectId(id), username: user.username })
      }
    } else if (word) {
      deleteWord = word
    }

    if (deleteWord) {
      const wordRegex = { $regex: `^${deleteWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
      
      // Delete from everywhere else that matches this word for this user
      // 1. bookmarks (delete all case variations)
      await conn.db.collection('bookmarks').deleteMany({ word: wordRegex, username: user.username })
      
      // 2. flashcards
      await conn.db.collection('flashcards').deleteMany({ word: wordRegex, username: user.username })
      
      // 3. wordHistory
      await conn.db.collection('wordHistory').deleteMany({ word: wordRegex, username: user.username })
      
      // 4. word-lists
      await conn.db.collection('word-lists').updateMany(
        { username: user.username },
        { $pull: { words: { word: wordRegex } } as any, $set: { updatedAt: new Date() } }
      )
      
      // 5. collections (need to update words and decrement wordCount correctly)
      const matchingCollections = await conn.db.collection('collections').find({
        username: user.username,
        "words.word": wordRegex
      }).toArray()
      
      for (const coll of matchingCollections) {
        const regexObj = new RegExp('^' + deleteWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
        const beforeCount = coll.words?.length || 0
        const newWords = (coll.words || []).filter((w: any) => !regexObj.test(w.word))
        const afterCount = newWords.length
        const removedCount = beforeCount - afterCount
        if (removedCount > 0) {
          await conn.db.collection('collections').updateOne(
            { _id: coll._id },
            {
              $set: { words: newWords, updatedAt: new Date() },
              $inc: { wordCount: -removedCount }
            }
          )
        }
      }

      // 6. sharedBookmarks
      await conn.db.collection('sharedBookmarks').deleteMany({ word: wordRegex, author: user.username })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting bookmark:', err)
    return NextResponse.json({ success: false })
  }
}
