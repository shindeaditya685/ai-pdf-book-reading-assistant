const ACTIVE_BOOK_KEY_PREFIX = 'pdf-reader-ai-active-book'
const BOOK_PAGE_KEY_PREFIX = 'pdf-reader-ai-book-page'

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const userKey = (username: string | null | undefined) => encodeURIComponent(username || 'guest')

const bookKey = (username: string | null | undefined, fileName: string) =>
  `${BOOK_PAGE_KEY_PREFIX}:${userKey(username)}:${encodeURIComponent(fileName)}`

export function getActiveBook(username: string | null | undefined) {
  if (!canUseStorage()) return null
  return window.localStorage.getItem(`${ACTIVE_BOOK_KEY_PREFIX}:${userKey(username)}`)
}

export function setActiveBook(username: string | null | undefined, fileName: string) {
  if (!canUseStorage()) return
  window.localStorage.setItem(`${ACTIVE_BOOK_KEY_PREFIX}:${userKey(username)}`, fileName)
}

export function clearActiveBook(username: string | null | undefined) {
  if (!canUseStorage()) return
  window.localStorage.removeItem(`${ACTIVE_BOOK_KEY_PREFIX}:${userKey(username)}`)
}

export function getStoredBookPage(username: string | null | undefined, fileName: string) {
  if (!canUseStorage()) return null
  const value = Number(window.localStorage.getItem(bookKey(username, fileName)))
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

export function setStoredBookPage(
  username: string | null | undefined,
  fileName: string,
  page: number
) {
  if (!canUseStorage()) return
  const safePage = Math.max(1, Math.round(page))
  window.localStorage.setItem(bookKey(username, fileName), String(safePage))
}
