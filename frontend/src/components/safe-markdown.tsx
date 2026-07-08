'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Safe ReactMarkdown wrapper.
 *
 * Security fix (S10): ReactMarkdown renders AI output (quote-chat messages)
 * and by default does NOT sanitize link URLs — a malicious AI response like
 * `[click](javascript:alert(1))` would render a clickable XSS link.
 *
 * `urlTransform` is the built-in, dependency-free way to allowlist URL
 * schemes. We permit only http(s) and mailto; everything else (javascript:,
 * data:, vbscript:, file:) is dropped to '#'.
 */
const SAFE_URL = /^(https?:|mailto:)/i

function safeUrlTransform(url: string, key: string, node: any): string | null {
  if (!url) return null
  // Allow relative URLs (e.g. /api/...) and anchors.
  if (url.startsWith('/') || url.startsWith('#') || url.startsWith('?')) return url
  if (SAFE_URL.test(url)) return url
  return '#'
}

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={safeUrlTransform}
    >
      {children}
    </ReactMarkdown>
  )
}
