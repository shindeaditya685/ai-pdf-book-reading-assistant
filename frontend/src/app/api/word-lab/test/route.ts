import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json({ success: false, stats: null })

  try {
    const body = await request.json()
    const { results } = body
    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ success: false, error: 'Invalid results' })
    }

    const correct = results.filter((r: any) => r.correct).length
    const total = results.length
    const score = total > 0 ? correct : 0

    const now = new Date()
    const date = todayStr()

    await conn.db.collection('word-lab').updateOne(
      { username: user.username, date },
      {
        $set: {
          testResults: results,
          score,
          completedAt: now.toISOString(),
          updatedAt: now,
        },
      }
    )

    // Build aggregated stats
    const allSessions = await conn.db.collection('word-lab')
      .find({ username: user.username, completedAt: { $ne: null } })
      .sort({ date: 1 })
      .toArray()

    const totalCorrect = allSessions.reduce((sum, s) => sum + (s.score || 0), 0)
    const totalAttempted = allSessions.reduce((sum, s) => sum + ((s.testResults || []).length), 0)
    const totalWordsLearned = allSessions.reduce((sum, s) => sum + (s.words?.length || 0), 0)

    // Calculate streak
    let currentStreak = 0
    const sortedDates = allSessions.map((s) => s.date).sort().reverse()
    const checkDate = new Date()
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date(checkDate)
      expected.setDate(expected.getDate() - i)
      const expectedStr = expected.toISOString().slice(0, 10)
      if (sortedDates[i] === expectedStr) {
        currentStreak++
      } else {
        break
      }
    }

    // Find longest streak
    let longestStreak = 0
    let tempStreak = 0
    if (sortedDates.length > 0) {
      const allDates = [...new Set(sortedDates)].sort()
      for (let i = 0; i < allDates.length; i++) {
        if (i === 0) {
          tempStreak = 1
        } else {
          const prev = new Date(allDates[i - 1])
          const curr = new Date(allDates[i])
          const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays === 1) {
            tempStreak++
          } else {
            tempStreak = 1
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak)
      }
    }

    // Determine level
    const sessionCount = allSessions.length
    const avgAccuracy = totalAttempted > 0 ? totalCorrect / totalAttempted : 0
    let level: 'bronze' | 'silver' | 'gold' | 'diamond' = 'bronze'
    if (sessionCount >= 60 && avgAccuracy >= 0.9) level = 'diamond'
    else if (sessionCount >= 30 && avgAccuracy >= 0.85) level = 'gold'
    else if (sessionCount >= 15) level = 'silver'

    // Get mastered words (correct on first attempt across sessions)
    const masteredWordIds = new Set<string>()
    for (const s of allSessions) {
      for (const r of (s.testResults || [])) {
        if (r.correct) masteredWordIds.add(r.wordId)
      }
    }

    const stats = {
      currentStreak,
      longestStreak,
      totalWordsLearned,
      totalTestsTaken: allSessions.length,
      totalCorrect,
      totalAttempted,
      dailyLogs: allSessions.map((s) => ({
        date: s.date,
        words: s.words || [],
        studiedIds: s.studiedIds || [],
        testResults: s.testResults || [],
        score: s.score,
        completedAt: s.completedAt,
      })),
      masteredWordIds: [...masteredWordIds],
      level,
    }

    return NextResponse.json({ success: true, stats })
  } catch {
    return NextResponse.json({ success: false, stats: null })
  }
}
