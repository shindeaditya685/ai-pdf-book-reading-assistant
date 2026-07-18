'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Trash2, BookOpen, Search, Plus, Pencil, Check, X, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { useAuth } from '@/context/auth-context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Book {
  fileName: string
  pageCount: number
  lastPage: number
  coverImage: string | null
  category: string
}

interface Category {
  name: string
  count: number
}

function titleOf(fileName: string) {
  return (fileName.split('/').pop() || fileName).replace(/\.pdf$/i, '')
}

export default function ManageBooksPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<string | null>(null)
  const [movingBook, setMovingBook] = useState<string | null>(null)
  const [assignCategory, setAssignCategory] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadAll()
  }, [user, authLoading, router])

  const loadAll = async () => {
    await Promise.all([loadBooks(), loadCategories()])
    setLoading(false)
  }

  const loadBooks = async () => {
    try {
      const res = await authFetch('/api/library')
      if (res.ok) {
        const data = await res.json()
        setBooks(data.books || [])
      }
    } catch { /* ignore */ }
  }

  const loadCategories = async () => {
    try {
      const res = await authFetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch { /* ignore */ }
  }

  const handleDeleteBook = async () => {
    const fileName = deleteTarget
    if (!fileName) return
    setDeleteTarget(null)
    setDeleting(fileName)
    try {
      const res = await authFetch(`/api/db/pdf?fileName=${encodeURIComponent(fileName)}`, { method: 'DELETE' })
      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.fileName !== fileName))
      }
    } catch { /* ignore */ }
    setDeleting(null)
  }

  const handleAssignCategory = async (fileName: string, category: string) => {
    setMovingBook(fileName)
    try {
      await authFetch('/api/db/pdf', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, category }),
      })
      setBooks((prev) => prev.map((b) => b.fileName === fileName ? { ...b, category } : b))
      await loadCategories()
    } catch { /* ignore */ }
    setMovingBook(null)
    setAssignCategory(null)
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    if (assignCategory) {
      await handleAssignCategory(assignCategory, name)
    }
    setNewCategoryName('')
    setShowNewCategory(false)
  }

  const handleRenameCategory = async () => {
    const oldName = renaming
    const newName = renameValue.trim()
    if (!oldName || !newName || oldName === newName) {
      setRenaming(null)
      return
    }
    try {
      await authFetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', name: oldName, newName }),
      })
      setBooks((prev) => prev.map((b) => b.category === oldName ? { ...b, category: newName } : b))
      await loadCategories()
    } catch { /* ignore */ }
    setRenaming(null)
  }

  const handleDeleteCategory = async () => {
    const name = deleteCategoryTarget
    if (!name) return
    setDeleteCategoryTarget(null)
    try {
      await authFetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', name }),
      })
      setBooks((prev) => prev.map((b) => b.category === name ? { ...b, category: '' } : b))
      await loadCategories()
    } catch { /* ignore */ }
  }

  const getCategoryBooks = (catName: string) =>
    books.filter((b) => b.category === catName)

  const uncategorized = books.filter((b) => !b.category)

  const groupedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name))

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  const renderBookRow = (book: Book) => {
    const progress = book.pageCount > 0
      ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100))
      : 0
    const title = titleOf(book.fileName)

    return (
      <div
        key={book.fileName}
        className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 transition-all hover:border-stone-300 dark:border-stone-700/50 dark:bg-stone-900/60 dark:hover:border-stone-600"
      >
        {book.coverImage ? (
          <img src={book.coverImage} alt="" className="h-10 w-8 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded bg-stone-200 text-[8px] font-bold uppercase text-stone-400 dark:bg-stone-800 dark:text-stone-500">
            {title.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-900 dark:text-white">{title}</p>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            {book.lastPage > 0 ? `Page ${book.lastPage} of ${book.pageCount} · ${progress}%` : `${book.pageCount} pages`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {movingBook === book.fileName ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
          ) : (
            <select
              value={book.category || ''}
              onChange={(e) => handleAssignCategory(book.fileName, e.target.value)}
              className="max-w-[130px] truncate rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 outline-none transition-all focus:border-amber-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400"
            >
              <option value="">No category</option>
              {groupedCategories.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
              <option value="__new__">+ New category...</option>
            </select>
          )}
          <button
            onClick={() => setDeleteTarget(book.fileName)}
            disabled={deleting === book.fileName}
            className="flex size-7 shrink-0 items-center justify-center rounded text-stone-400 transition-all hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-rose-950/20"
          >
            {deleting === book.fileName ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="mt-4 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Manage Books
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {books.length} books · {categories.length} categories
          </p>
          {/* UX fix (U14): the `search` state existed but was never wired to
              an input, so the search-results block below was dead code. */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search books by title..."
            className="mt-4 h-9 w-full max-w-sm rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-amber-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
          />
        </div>

        {/* ── Categories Section ── */}
        <div className="mb-8 space-y-2">
          {groupedCategories.map((cat) => {
            const catBooks = getCategoryBooks(cat.name)
            const isExpanded = expandedCategory === cat.name
            return (
              <div key={cat.name} className="rounded-xl border border-stone-200 bg-white dark:border-stone-700/50 dark:bg-stone-900/60">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/50"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />}
                  <span className="flex-1 text-sm font-semibold text-stone-900 dark:text-white">{cat.name}</span>
                  <span className="mr-2 text-xs text-stone-400">{catBooks.length} {catBooks.length === 1 ? 'book' : 'books'}</span>
                  
                  {renaming === cat.name ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(); if (e.key === 'Escape') setRenaming(null) }}
                        className="h-7 w-32 rounded border border-stone-300 px-2 text-xs outline-none focus:border-amber-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
                        autoFocus
                      />
                      <div onClick={handleRenameCategory} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory() }} className="flex size-6 cursor-pointer items-center justify-center rounded text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"><Check className="h-3 w-3" /></div>
                      <div onClick={() => setRenaming(null)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setRenaming(null) }} className="flex size-6 cursor-pointer items-center justify-center rounded text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"><X className="h-3 w-3" /></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <div
                        onClick={() => { setRenaming(cat.name); setRenameValue(cat.name) }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setRenaming(cat.name); setRenameValue(cat.name) } }}
                        className="flex size-7 cursor-pointer items-center justify-center rounded text-stone-400 transition-all hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
                      >
                        <Pencil className="h-3 w-3" />
                      </div>
                      <div
                        onClick={() => setDeleteCategoryTarget(cat.name)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') setDeleteCategoryTarget(cat.name) }}
                        className="flex size-7 cursor-pointer items-center justify-center rounded text-stone-400 transition-all hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </button>
                {isExpanded && (
                  <div className="space-y-1.5 border-t border-stone-100 px-4 py-3 dark:border-stone-800">
                    {catBooks.length === 0 ? (
                      <p className="py-4 text-center text-xs text-stone-400">No books in this category</p>
                    ) : (
                      catBooks.map(renderBookRow)
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Uncategorized Section ── */}
        {uncategorized.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 px-1 mb-3">
              <BookOpen className="h-4 w-4 text-stone-400" />
              <span className="text-sm font-semibold text-stone-600 dark:text-stone-400">Uncategorized</span>
              <span className="text-xs text-stone-400">{uncategorized.length}</span>
            </div>
            <div className="space-y-1.5">{uncategorized.map(renderBookRow)}</div>
          </div>
        )}

        {/* ── Search & Delete All ── */}
        <div className="space-y-1.5">
          {search.trim() && books.filter((b) => titleOf(b.fileName).toLowerCase().includes(search.toLowerCase().trim())).map(renderBookRow)}
        </div>
      </div>

      {/* Delete book confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete book?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget ? titleOf(deleteTarget) : ''}&rdquo; and its annotations and notes. Bookmarked words, flashcards, and passages for this book will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBook} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete category confirmation */}
      <AlertDialog open={!!deleteCategoryTarget} onOpenChange={(open) => { if (!open) setDeleteCategoryTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Books in &ldquo;{deleteCategoryTarget}&rdquo; will be moved to Uncategorized. The category itself will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-rose-600 hover:bg-rose-700">Delete Category</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
