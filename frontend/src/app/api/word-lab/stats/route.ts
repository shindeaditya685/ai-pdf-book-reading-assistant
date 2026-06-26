import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await connectToDatabase()
  if (!conn) return NextResponse.json(null)

  try {
    const allSessions = await conn.db.collection('word-lab')
      .find({ username: user.username, completedAt: { $ne: null } })
      .sort({ date: 1 })
      .toArray()

    if (allSessions.length === 0) {
      return NextResponse.json({
        currentStreak: 0,
        longestStreak: 0,
        totalWordsLearned: 0,
        totalTestsTaken: 0,
        totalCorrect: 0,
        totalAttempted: 0,
        dailyLogs: [],
        masteredWordIds: [],
        level: 'bronze',
      })
    }

    const totalCorrect = allSessions.reduce((sum, s) => sum + (s.score || 0), 0)
    const totalAttempted = allSessions.reduce((sum, s) => sum + ((s.testResults || []).length), 0)
    const totalWordsLearned = allSessions.reduce((sum, s) => sum + (s.words?.length || 0), 0)

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

    const sessionCount = allSessions.length
    const avgAccuracy = totalAttempted > 0 ? totalCorrect / totalAttempted : 0
    let level: 'bronze' | 'silver' | 'gold' | 'diamond' = 'bronze'
    if (sessionCount >= 60 && avgAccuracy >= 0.9) level = 'diamond'
    else if (sessionCount >= 30 && avgAccuracy >= 0.85) level = 'gold'
    else if (sessionCount >= 15) level = 'silver'

    const masteredWordIds = new Set<string>()
    for (const s of allSessions) {
      for (const r of (s.testResults || [])) {
        if (r.correct) masteredWordIds.add(r.wordId)
      }
    }

    return NextResponse.json({
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
    })
  } catch {
    return NextResponse.json(null)
  }
}
