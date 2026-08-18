import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/lib/db'
import { gateAiRequest, refundIfFailed } from '@/lib/ai-gate'
import { QUOTE_LIMITS, cleanText } from '@/lib/quotes'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function getGroqClients(): Groq[] {
  const keyEnv = process.env.GROQ_API_KEY || ''
  if (!keyEnv || keyEnv === 'your_groq_api_key_here') return []
  const keys = keyEnv.split(',').map((k) => k.trim()).filter(Boolean)
  return keys.map((apiKey) => new Groq({ apiKey }))
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

interface HydratedQuote {
  id: string
  text: string
  noteText: string
  context: string
  pageNumber: number
  pdfFileName: string
  color: string
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Build the system prompt that primes the model with the user's saved quotes
 * as context. The model is instructed to cite quotes inline as
 * `[Book Title, p. N] "excerpt"` so the UI can render them as links.
 */
function buildSystemPrompt(quotes: HydratedQuote[]): string {
  if (quotes.length === 0) {
    return `You are a thoughtful reading companion. The user has not pinned any quotes to this conversation yet, so just answer their question in a clear, friendly way. If they ask you to reference a quote, ask them to pin it first.`
  }
  const quoteList = quotes
    .map((q, i) => {
      const note = q.noteText ? ` — user note: ${q.noteText}` : ''
      const ctx = q.context ? `\n    Surrounding context: ${q.context}` : ''
      return `${i + 1}. From "${q.pdfFileName}", page ${q.pageNumber}:\n    "${q.text}"${note}${ctx}`
    })
    .join('\n\n')
  return `You are a thoughtful reading companion. The user has saved these passages and is asking you to help them reflect on, connect, or recall them.

PINNED QUOTES (these are the user's own saved passages — treat them as the source of truth for citations):

${quoteList}

CITATION RULES:
- When you reference a specific quote, format it inline as: \`[Book Title, p. N] "short excerpt"\` so the UI can link back to the source.
- Never invent quotes that are not in the list above. If the user asks about a quote that is not pinned, ask them to pin it first.
- Use the user's own notes as personal context when answering, but don't repeat them verbatim unless asked.

TONE:
- Be warm, concise, and reflective. The user is reading for personal growth.
- Use markdown for structure (lists, bold, italics) when it improves clarity.
- Reply in the same language the user writes in, unless they ask otherwise.

LENGTH:
- Aim for 2-4 paragraphs unless the user explicitly asks for a long essay.`
}

/**
 * Build the chat history that we'll send to the model. We send only the
 * most recent N messages to stay within reasonable context windows.
 */
function buildHistory(messages: HistoryMessage[]): HistoryMessage[] {
  return messages.slice(-QUOTE_LIMITS.RECENT_MESSAGES_MAX)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await gateAiRequest(request, 'quote_chat')
    if (gate.kind !== 'allow') return gate.response

    try {
      const { id } = await params
      const body = await request.json()
      const userMessage = cleanText(String(body.content ?? ''))
      if (!userMessage) {
        await refundIfFailed(gate.userId, 'quote_chat')
        return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
      }
      if (userMessage.length > QUOTE_LIMITS.CHAT_MESSAGE_MAX) {
        await refundIfFailed(gate.userId, 'quote_chat')
        return NextResponse.json(
          { error: `Message must be \u2264 ${QUOTE_LIMITS.CHAT_MESSAGE_MAX} characters` },
          { status: 400 }
        )
      }
      // Optionally attach a fresh set of quote refs to this message.
      const refsIn = Array.isArray(body.quoteRefs) ? body.quoteRefs : []
      const quoteRefs = refsIn
        .filter((r: unknown) => r && typeof r === 'object')
        .slice(0, QUOTE_LIMITS.PINNED_QUOTES_MAX)
        .map((r: { quoteId?: unknown; text?: unknown; noteText?: unknown; pageNumber?: unknown; pdfFileName?: unknown }) => ({
          quoteId: typeof r.quoteId === 'string' ? r.quoteId : '',
          text: typeof r.text === 'string' ? r.text : '',
          noteText: typeof r.noteText === 'string' ? r.noteText : '',
          pageNumber: Number.isFinite(r.pageNumber) ? Math.max(0, Math.floor(r.pageNumber as number)) : 0,
          pdfFileName: typeof r.pdfFileName === 'string' ? r.pdfFileName : '',
        }))

      const conn = await connectToDatabase()
      if (!conn) {
        await refundIfFailed(gate.userId, 'quote_chat')
        return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
      }
      if (!id || !ObjectId.isValid(id)) {
        await refundIfFailed(gate.userId, 'quote_chat')
        return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 })
      }

      const conv = await conn.db.collection('quoteConversations').findOne({
        _id: new ObjectId(id),
        username: gate.userId,
      })
      // Resolve username from the conversation doc (gate uses userId, not username)
      const user = await conn.db.collection('users').findOne(
        { _id: new ObjectId(gate.userId) },
        { projection: { username: 1 } }
      )
      if (!user) {
        await refundIfFailed(gate.userId, 'quote_chat')
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const username = user.username as string
      const convForUser = await conn.db.collection('quoteConversations').findOne({
        _id: new ObjectId(id),
        username,
      })
      if (!convForUser) {
        await refundIfFailed(gate.userId, 'quote_chat')
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }

      // Hydrate the quotes that the conversation has pinned. The client
      // may have just attached additional refs in this turn — we merge
      // them in so the model has the most complete picture.
      const pinnedIds = Array.isArray(convForUser.quoteIds) ? (convForUser.quoteIds as string[]) : []
      const idsToHydrate = Array.from(new Set([
        ...pinnedIds,
        ...quoteRefs.map((r) => r.quoteId).filter((s) => typeof s === 'string' && s.length > 0),
      ]))
      const objectIds = idsToHydrate
        .filter((qid) => ObjectId.isValid(qid))
        .map((qid) => new ObjectId(qid))
      const hydrated: HydratedQuote[] = objectIds.length > 0
        ? (await conn.db
            .collection('quotes')
            .find({ _id: { $in: objectIds }, username }, {
              projection: { _id: 1, text: 1, noteText: 1, pageNumber: 1, pdfFileName: 1, context: 1, color: 1 },
            })
            .toArray()).map((q) => ({
              id: (q._id as ObjectId).toString(),
              text: (q.text as string) || '',
              noteText: (q.noteText as string) || '',
              context: (q.context as string) || '',
              pageNumber: (q.pageNumber as number) || 0,
              pdfFileName: (q.pdfFileName as string) || '',
              color: (q.color as string) || 'rgba(253, 224, 71, 0.65)',
            }))
        : []

      // Persist the user message
      const now = new Date()
      const userMessageDoc = {
        conversationId: id,
        username,
        role: 'user' as const,
        content: userMessage,
        quoteRefs,
        createdAt: now,
      }
      const userInsert = await conn.db.collection('quoteMessages').insertOne(userMessageDoc)

      // Pull history (excluding the message we just inserted — we'll prepend it explicitly)
      const historyDocs = await conn.db
        .collection('quoteMessages')
        .find({ conversationId: id, role: { $in: ['user', 'assistant'] } })
        .sort({ createdAt: 1 })
        .toArray()
      const history: HistoryMessage[] = historyDocs
        .filter((m) => (m._id as ObjectId).toString() !== userInsert.insertedId.toString())
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: (m.content as string) || '' }))

      const systemPrompt = buildSystemPrompt(hydrated)
      const recent = buildHistory(history)
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
        ...recent.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ]

      let content = ''
      let lastError = ''

      // Try Groq first with multi-key failover
      const clients = shuffleArray(getGroqClients())
      if (clients.length > 0) {
        for (let i = 0; i < clients.length; i++) {
          const client = clients[i]
          try {
            const completion = await client.chat.completions.create({
              messages,
              model: 'openai/gpt-oss-120b',
              temperature: 0.6,
            })
            content = completion.choices?.[0]?.message?.content || ''
            if (content) break
          } catch (e) {
            lastError = e instanceof Error ? e.message : 'Groq request failed'
            console.warn(`[quote-chat] Groq key index ${i} failed:`, lastError)
          }
        }
      }

      // Fallback to Gemini
      if (!content) {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
          await refundIfFailed(gate.userId, 'quote_chat')
          return NextResponse.json(
            { error: `No AI service available. GROQ_API_KEY may be invalid: ${lastError || 'unknown error'}` },
            { status: 500 }
          )
        }
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })
          // Gemini doesn't take a system role in the same way; merge into first user turn.
          const mergedMessages = messages[0].role === 'system'
            ? [{ role: 'user' as const, content: `${messages[0].content}\n\n---\n\n${messages[1]?.content || ''}` }, ...messages.slice(2)]
            : messages
          const result = await model.generateContent({
            contents: mergedMessages
              .filter((m) => m.role !== 'system')
              .map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
              })),
            systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
          })
          content = result.response.text()
        } catch (e) {
          await refundIfFailed(gate.userId, 'quote_chat')
          return NextResponse.json({
            error: `Groq failed: ${lastError || 'unknown error'}. Gemini also failed: ${e instanceof Error ? e.message : 'unknown error'}`,
          }, { status: 500 })
        }
      }

      if (!content) {
        await refundIfFailed(gate.userId, 'quote_chat')
        return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 })
      }

      // Persist the assistant message and bump the conversation's updatedAt.
      const assistantDoc = {
        conversationId: id,
        username,
        role: 'assistant' as const,
        content,
        quoteRefs: [],
        createdAt: new Date(),
      }
      const assistantInsert = await conn.db.collection('quoteMessages').insertOne(assistantDoc)
      await conn.db.collection('quoteConversations').updateOne(
        { _id: new ObjectId(id) },
        { $set: { updatedAt: new Date() } }
      )

      return NextResponse.json({
        userMessage: {
          id: userInsert.insertedId.toString(),
          conversationId: id,
          username,
          role: 'user',
          content: userMessage,
          quoteRefs,
          createdAt: now.getTime(),
        },
        assistantMessage: {
          id: assistantInsert.insertedId.toString(),
          conversationId: id,
          username,
          role: 'assistant',
          content,
          quoteRefs: [],
          createdAt: new Date().getTime(),
        },
      })
    } catch (innerErr) {
      await refundIfFailed(gate.userId, 'quote_chat')
      throw innerErr
    }
  } catch (error: unknown) {
    console.error('[quote-chat] error:', error)
    const message = error instanceof Error ? error.message : 'Failed to get AI response'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'quote-chat' })
}
