import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

interface Pron {
  type: string
  text: string
  tags: string[]
}

interface Sense {
  definition: string
  examples?: string[]
  synonyms?: string[]
  antonyms?: string[]
}

interface Entry {
  language: { code: string; name: string }
  partOfSpeech: string
  pronunciations: Pron[]
  senses: Sense[]
}

interface DictResponse {
  word: string
  entries: Entry[]
}

const ACCENT_TAG_MAP: Record<string, string> = {
  'en-US': 'General American',
  'en-GB': 'Received Pronunciation',
  'en-AU': 'General Australian',
  'en-IN': 'Indian English',
}

export async function GET(req: NextRequest) {
  // Security fix (S13): require auth + rate limit. Previously this was an
  // unauthenticated open proxy to freedictionaryapi.com.
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateCheck = await checkRateLimit(`dict:${user.id}`, 60, 60000)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 })
  }

  const word = req.nextUrl.searchParams.get('word')
  const lang = req.nextUrl.searchParams.get('lang') || 'en'
  const accent = req.nextUrl.searchParams.get('accent') || 'en-US'

  if (!word) {
    return NextResponse.json({ error: 'Word parameter required' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://freedictionaryapi.com/api/v1/entries/${lang}/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'Word not found', notFound: true }, { status: 404 })
      }
      return NextResponse.json({ error: 'Dictionary service unavailable' }, { status: 502 })
    }

    const data: DictResponse = await res.json()
    if (!data || !data.entries || data.entries.length === 0) {
      return NextResponse.json({ error: 'Word not found', notFound: true }, { status: 404 })
    }

    const entry = data.entries[0]
    const sense = entry.senses?.[0]

    // Pick pronunciation matching the user's accent
    const preferredTag = ACCENT_TAG_MAP[accent]
    let pronunciation = ''
    if (preferredTag) {
      const match = entry.pronunciations?.find((p) =>
        p.tags?.some((t) => t.toLowerCase() === preferredTag.toLowerCase())
      )
      if (match) pronunciation = match.text
    }
    if (!pronunciation) {
      const first = entry.pronunciations?.find((p) => p.type === 'ipa')
      if (first) pronunciation = first.text
    }

    const definition = sense?.definition || ''
    const example = sense?.examples?.[0] || ''
    const synonyms = sense?.synonyms?.slice(0, 5).join(', ') || ''
    const antonyms = sense?.antonyms?.slice(0, 5).join(', ') || ''

    return NextResponse.json({
      word: data.word,
      meaning: definition,
      pronunciation,
      partOfSpeech: entry.partOfSpeech || '',
      example,
      synonyms,
      antonyms,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Dictionary API error:', msg)
    return NextResponse.json({ error: 'Failed to fetch definition' }, { status: 500 })
  }
}
