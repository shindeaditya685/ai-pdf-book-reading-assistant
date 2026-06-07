/**
 * Saved-quote + AI conversation types shared between client and server.
 *
 * Quotes are short passages (1-500 chars) the user marks while reading,
 * with optional context (surrounding paragraph) and a personal note.
 * They are page-anchored and grouped per-book, but conversations can
 * span quotes from multiple books.
 *
 * Mirrors the bookmark pattern: Mongo `_id` is the canonical primary key,
 * surfaced to the client as a string `id`. The conversation/message
 * collections use the same pattern.
 */
export interface QuoteRect {
  left: number
  top: number
  width: number
  height: number
}

export interface Quote {
  /** Mongo `_id` rendered as a string (e.g. `65f1a2b3c4d5e6f7g8h9i0j1`). */
  id: string
  /** The actual quoted passage. */
  text: string
  /** Optional surrounding paragraph / sentence for context. */
  context: string
  /** Optional user note / personal reflection. */
  noteText: string
  pageNumber: number
  pdfFileName: string
  /** Optional in-page highlight rects (normalized to page coords). */
  rects: QuoteRect[]
  /** Optional highlight color (CSS rgba). */
  color: string
  username: string
  /** ms since epoch (matches other per-user items in the store). */
  timestamp: number
}

export interface QuoteConversation {
  id: string
  username: string
  title: string
  /** Books referenced in this conversation (for filter chips). */
  pdfFileNames: string[]
  /** Quote ids pinned to this conversation. */
  quoteIds: string[]
  createdAt: number
  updatedAt: number
}

export type QuoteMessageRole = 'user' | 'assistant' | 'system'

export interface QuoteMessage {
  id: string
  conversationId: string
  username: string
  role: QuoteMessageRole
  content: string
  /**
   * Snapshot of the quotes that were attached to this message at send
   * time. Stored on both user + assistant messages for easy rendering
   * of inline references ("as you noted in [Book, p. N]...").
   */
  quoteRefs: QuoteRefSnapshot[]
  createdAt: number
}

export interface QuoteRefSnapshot {
  quoteId: string
  text: string
  noteText: string
  pageNumber: number
  pdfFileName: string
}

/** Limits enforced by the API and surfaced in the UI. */
export const QUOTE_LIMITS = {
  TEXT_MAX: 500,
  CONTEXT_MAX: 1000,
  NOTE_MAX: 500,
  CHAT_MESSAGE_MAX: 2000,
  CHAT_TITLE_MAX: 120,
  /** Max quotes pinned to a single conversation (oldest dropped). */
  PINNED_QUOTES_MAX: 20,
  /** Max recent messages sent to the LLM per turn (older messages are summarized out). */
  RECENT_MESSAGES_MAX: 10,
} as const

export function makeClientQuoteId(): string {
  return `quote-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function makeClientMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Truncate a string to N characters with an ellipsis. */
export function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length <= n ? s : s.slice(0, n - 1) + '\u2026'
}

/** Strip control characters and normalize whitespace. */
export function cleanText(s: string): string {
  return (s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
}

