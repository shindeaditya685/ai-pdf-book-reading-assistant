'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { usePDFStore } from '@/store/use-pdf-store'

export function SearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    currentSearchIndex,
    isSearching,
    goToNextSearchResult,
    goToPrevSearchResult,
    setShowSearch,
  } = usePDFStore()

  const inputRef = useRef<HTMLInputElement>(null)
  const [localQuery, setLocalQuery] = useState(searchQuery)

  // Performance fix (P5): debounce the store update so we don't re-render
  // every visible PdfPage on every keystroke. The local input stays
  // responsive (controlled by localQuery); the store (and the expensive
  // text-layer rebuild across pages) only updates 250ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery !== localQuery) setSearchQuery(localQuery.trim())
    }, 250)
    return () => clearTimeout(t)
  }, [localQuery, searchQuery, setSearchQuery])

  const handleSearch = useCallback(
    (query: string) => {
      setLocalQuery(query)
    },
    []
  )

  const handleClear = useCallback(() => {
    setLocalQuery('')
    setSearchQuery('')
    setShowSearch(false)
  }, [setSearchQuery, setShowSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          goToPrevSearchResult()
        } else {
          goToNextSearchResult()
        }
      }
      if (e.key === 'Escape') {
        handleClear()
      }
    },
    [goToNextSearchResult, goToPrevSearchResult, handleClear]
  )

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1">
      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search in PDF..."
        value={localQuery}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 w-[180px] border-0 p-0 text-xs shadow-none focus-visible:ring-0"
        autoFocus
      />
      {isSearching ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : searchResults.length > 0 ? (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {currentSearchIndex + 1}/{searchResults.length}
        </span>
      ) : localQuery ? (
        <span className="text-[10px] text-muted-foreground">No results</span>
      ) : null}
      {searchResults.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={goToPrevSearchResult}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={goToNextSearchResult}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-muted-foreground hover:text-foreground"
        onClick={handleClear}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
