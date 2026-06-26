import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { generateWords } from '@/lib/word-lab-generate'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })

  try {
    const date = todayStr()

    // Check for existing session
    const existing = await conn.db.collection('word-lab').findOne({
      username: user.username,
      date,
    })

    if (existing) {
      return NextResponse.json({
        words: existing.words || [],
        studiedIds: existing.studiedIds || [],
        testResults: existing.testResults || [],
        completed: !!existing.completedAt,
        score: existing.score ?? null,
      })
    }

    // Collect all already-used word IDs from past sessions
    const usedWordIds = new Set<string>()
    const pastSessions = await conn.db.collection('word-lab')
      .find({ username: user.username })
      .project({ 'words.id': 1 })
      .toArray()
    for (const s of pastSessions) {
      for (const w of (s.words || [])) {
        if (w.id) usedWordIds.add(w.id)
      }
    }

    // Priority 1: bookmarks not yet used
    const bookmarks = await conn.db.collection('bookmarks')
      .find({ username: user.username })
      .sort({ timestamp: -1 })
      .toArray()

    const candidates: any[] = []
    for (const b of bookmarks) {
      if (candidates.length >= 10) break
      const wid = `bookmark-${b._id.toString()}`
      if (usedWordIds.has(wid)) continue
      candidates.push({
        id: wid,
        word: b.word,
        pronunciation: b.pronunciation || '',
        meaning: b.meaning || '',
        translation: b.translation || '',
        example: b.sentence || '',
        source: 'bookmark' as const,
      })
    }

    // Priority 2: word history not yet used
    if (candidates.length < 10) {
      const historyEntries = await conn.db.collection('history')
        .find({ username: user.username })
        .sort({ timestamp: -1 })
        .toArray()

      for (const h of historyEntries) {
        if (candidates.length >= 10) break
        const wid = `history-${h._id.toString()}`
        if (usedWordIds.has(wid)) continue
        if (candidates.some((c) => c.word.toLowerCase() === h.word?.toLowerCase())) continue
        candidates.push({
          id: wid,
          word: h.word,
          pronunciation: h.pronunciation || '',
          meaning: h.meaning || '',
          translation: h.translation || '',
          example: h.sentence || '',
          source: 'history' as const,
        })
      }
    }

    // Priority 3: AI-generated words
    if (candidates.length < 10) {
      try {
        const aiWords = await generateWords(10 - candidates.length, candidates.map((c) => c.word))
        for (const w of aiWords) {
          if (candidates.length >= 10) break
          candidates.push({
            id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            word: w.word,
            pronunciation: w.pronunciation || '',
            meaning: w.meaning || '',
            translation: w.translation || '',
            example: w.example || '',
            source: 'ai' as const,
          })
        }
      } catch {
        // AI generation is optional
      }
    }

    // Create session if we have words
    if (candidates.length > 0) {
      const session = {
        username: user.username,
        date,
        words: candidates.slice(0, 10),
        studiedIds: [] as string[],
        testResults: [] as any[],
        score: null as number | null,
        completedAt: null as string | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await conn.db.collection('word-lab').insertOne(session)

      return NextResponse.json({
        words: session.words,
        studiedIds: [],
        testResults: [],
        completed: false,
      })
    }

    // No words available at all
    return NextResponse.json({ words: [], studiedIds: [], testResults: [], completed: false })
  } catch (error) {
    console.error('Word Lab today error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
