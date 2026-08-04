import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ words: [], totalWords: 0, totalBooks: 0 })

  try {
    const { searchParams } = new URL(request.url)
    const pdfFileName = searchParams.get('pdfFileName')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'freq'
    const order = searchParams.get('order') || 'desc'

    const match: any = { username: user.username }
    if (pdfFileName) match.pdfFileName = pdfFileName
    if (search) match.word = { $regex: search, $options: 'i' }

    const pipeline: any[] = [
      { $match: match },
      { $addFields: { word: { $toLower: '$word' } } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$word',
          frequency: { $sum: 1 },
          meaning: { $first: '$meaning' },
          pronunciation: { $first: '$pronunciation' },
          translation: { $first: '$translation' },
          sentence: { $first: '$sentence' },
          firstSeen: { $min: '$timestamp' },
          lastSeen: { $max: '$timestamp' },
          pdfs: { $addToSet: '$pdfFileName' },
        },
      },
      {
        $project: {
          _id: 0,
          word: '$_id',
          frequency: 1,
          meaning: 1,
          pronunciation: 1,
          translation: 1,
          sentence: 1,
          firstSeen: 1,
          lastSeen: 1,
          pdfs: 1,
        },
      },
    ]

    const sortDir = order === 'asc' ? 1 : -1
    if (sort === 'freq') pipeline.push({ $sort: { frequency: sortDir, word: 1 } })
    else if (sort === 'alpha') pipeline.push({ $sort: { word: sortDir } })
    else pipeline.push({ $sort: { lastSeen: sortDir, word: 1 } })

    const words = await conn.db.collection('bookmarks').aggregate(pipeline).toArray()

    const pdfs = await conn.db.collection('bookmarks').distinct('pdfFileName', { username: user.username })

    return NextResponse.json({ words, totalWords: words.length, totalBooks: pdfs.length, pdfs })
  } catch {
    return NextResponse.json({ words: [], totalWords: 0, totalBooks: 0, pdfs: [] })
  }
}

export async function DELETE(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const word = searchParams.get('word')
  if (!word) return NextResponse.json({ error: 'word required' }, { status: 400 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false })

  try {
    const deleteWord = word.trim()
    const wordRegex = { $regex: `^${deleteWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    
    // Delete from everywhere else that matches this word for this user
    // 1. bookmarks
    const result = await conn.db.collection('bookmarks').deleteMany({ word: wordRegex, username: user.username })
    
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

    return NextResponse.json({ success: true, deletedCount: result.deletedCount })
  } catch (err) {
    console.error('Error deleting vocabulary word:', err)
    return NextResponse.json({ success: false })
  }
}
