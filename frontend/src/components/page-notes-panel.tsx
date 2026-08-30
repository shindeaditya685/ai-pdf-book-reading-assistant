'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { StickyNote, Trash2, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { CountBadge, EmptyState } from '@/components/panel-primitives'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'

export function PageNotesPanel() {
  const {
    pageNotes,
    showPageNotes,
    setShowPageNotes,
    setPageNotes,
    addPageNote,
    updatePageNote,
    removePageNote,
    currentPage,
    pdfFileName,
  } = usePDFStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const filteredNotes = pageNotes.filter(
    (n) => !pdfFileName || n.pdfFileName === pdfFileName
  )

  // Fetch notes when panel opens
  useEffect(() => {
    if (!showPageNotes || !pdfFileName) return
    let cancelled = false
    setLoading(true)
    authFetch(`/api/db/page-notes?pdfFileName=${encodeURIComponent(pdfFileName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setPageNotes(
            data.map((n: any) => ({
              _id: n._id,
              pageNumber: n.pageNumber,
              content: n.content,
              pdfFileName: n.pdfFileName,
              timestamp: new Date(n.timestamp).getTime(),
              updatedAt: new Date(n.updatedAt).getTime(),
            }))
          )
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [showPageNotes, pdfFileName, setPageNotes])

  const handleAddNote = useCallback(async () => {
    if (!newNoteContent.trim() || !pdfFileName) return
    setIsSaving(true)
    try {
      const res = await authFetch('/api/db/page-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageNumber: currentPage,
          content: newNoteContent.trim(),
          pdfFileName,
        }),
      })
      const data = await res.json()
      if (data.success && data.id) {
        addPageNote({
          _id: data.id,
          pageNumber: currentPage,
          content: newNoteContent.trim(),
          pdfFileName,
          timestamp: Date.now(),
          updatedAt: Date.now(),
        })
        setNewNoteContent('')
      }
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setIsSaving(false)
    }
  }, [newNoteContent, currentPage, pdfFileName, addPageNote])

  const handleUpdateNote = useCallback(async (id: string) => {
    if (!editContent.trim()) return
    setIsSaving(true)
    try {
      await authFetch('/api/db/page-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent.trim() }),
      })
      updatePageNote(id, editContent.trim())
      setEditingId(null)
      setEditContent('')
    } catch (err) {
      console.error('Failed to update note:', err)
    } finally {
      setIsSaving(false)
    }
  }, [editContent, updatePageNote])

  const handleDeleteNote = useCallback(async (id: string) => {
    removePageNote(id)
    try {
      await authFetch(`/api/db/page-notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }, [removePageNote])

  const handleGoToPage = useCallback((page: number) => {
    usePDFStore.getState().setCurrentPage(page)
    setShowPageNotes(false)
  }, [setShowPageNotes])

  return (
    <ResponsivePanel
      open={showPageNotes}
      onClose={() => setShowPageNotes(false)}
      ariaLabel="Page Notes"
      header={
        <PanelHeader
          icon={StickyNote}
          title="Page Notes"
          badge={<CountBadge count={filteredNotes.length} />}
          actions={
            <Link
              href="/notes"
              className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand transition-colors hover:bg-brand/20"
              onClick={() => setShowPageNotes(false)}
            >
              View All
            </Link>
          }
          onClose={() => setShowPageNotes(false)}
        />
      }
    >
      {/* Add note for current page */}
      <div className="border-b border-border/60 p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Note for page {currentPage}
        </p>
        <div className="flex gap-2">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Write a note..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleAddNote()
              }
            }}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={!newNoteContent.trim() || isSaving}
            className="gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground/60">
          Tip: Ctrl+Enter to save quickly
        </p>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            hint="Write your first note above. Notes are saved per page."
          />
        </div>
      ) : (
        <div className="space-y-2.5 p-4">
          {filteredNotes.map((note) => {
            const id = note._id || note.id || ''
            const isEditing = editingId === id

            return (
              <div
                key={id}
                className="group relative rounded-xl border border-border/60 bg-card/60 p-3 transition-colors hover:border-brand/25 hover:bg-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => handleGoToPage(note.pageNumber)}
                  >
                    <span className="font-mono text-[10px] font-medium tabular-nums text-brand">
                      Page {note.pageNumber}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                      onClick={() => {
                        setEditingId(id)
                        setEditContent(note.content)
                      }}
                      aria-label="Edit note"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      onClick={() => handleDeleteNote(id)}
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
                      autoFocus
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingId(null); setEditContent('') }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateNote(id)}
                        disabled={!editContent.trim() || isSaving}
                      >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {note.content}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </ResponsivePanel>
  )
}
