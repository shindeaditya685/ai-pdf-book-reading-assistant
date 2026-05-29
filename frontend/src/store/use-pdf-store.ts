import { create } from 'zustand'

export interface WordExplanation {
  word: string
  meaning: string
  pronunciation: string
  translation: string
  simplifiedSentence?: string
}

export interface PopupPosition {
  x: number
  y: number
}

export type TranslationLanguage = 'none' | 'hi' | 'mr' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'pt' | 'ar' | 'ko' | 'ru'

export const LANGUAGE_LABELS: Record<TranslationLanguage, string> = {
  none: 'No Translation',
  hi: 'Hindi',
  mr: 'Marathi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  zh: 'Chinese',
  pt: 'Portuguese',
  ar: 'Arabic',
  ko: 'Korean',
  ru: 'Russian',
}

export interface WordHistoryEntry {
  id: string
  word: string
  meaning: string
  pronunciation: string
  translation: string
  sentence: string
  pageNumber: number
  pdfFileName: string
  timestamp: number
}

export interface Bookmark {
  id: string
  pageNumber: number
  word: string
  meaning: string
  pronunciation: string
  translation: string
  sentence: string
  timestamp: number
  pdfFileName: string
}

export interface OcrWord {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export interface OcrPageData {
  text: string
  words: OcrWord[]
  width: number
  height: number
}

export interface SearchResult {
  pageNumber: number
  text: string
  index: number
}

export interface RecentPdf {
  fileName: string
  timestamp: number
}

interface PDFState {
  // PDF file state
  pdfFile: File | null
  pdfDataUrl: string | null
  pdfFileName: string | null
  totalPages: number
  currentPage: number
  scale: number
  uploadProgress: number

  // Word selection state
  selectedWord: string | null
  selectedSentence: string | null
  selectedPageNumber: number | null
  popupPosition: PopupPosition | null

  // Explanation state
  explanation: WordExplanation | null
  isExplaining: boolean

  // Settings
  translationLanguage: TranslationLanguage
  theme: 'light' | 'dark'

  // Word History
  wordHistory: WordHistoryEntry[]

  // Bookmarks
  bookmarks: Bookmark[]

  // Search
  searchQuery: string
  searchResults: SearchResult[]
  currentSearchIndex: number
  isSearching: boolean

  // Recent PDFs
  recentPdfs: RecentPdf[]

  // OCR state
  ocrEnabled: boolean
  ocrText: Record<number, OcrPageData>
  isOcrProcessing: boolean
  ocrProgress: number

  // UI panels
  showHistory: boolean
  showBookmarks: boolean
  showSearch: boolean

  // Actions
  setPdfFile: (file: File | null) => void
  setPdfFileName: (name: string | null) => void
  setPdfDataUrl: (url: string | null) => void
  setTotalPages: (pages: number) => void
  setCurrentPage: (page: number) => void
  setScale: (scale: number) => void
  setUploadProgress: (progress: number) => void
  setSelectedWord: (word: string | null) => void
  setSelectedSentence: (sentence: string | null) => void
  setSelectedPageNumber: (page: number | null) => void
  setPopupPosition: (pos: PopupPosition | null) => void
  setExplanation: (explanation: WordExplanation | null) => void
  setIsExplaining: (loading: boolean) => void
  setTranslationLanguage: (lang: TranslationLanguage) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  clearSelection: () => void
  reset: () => void

  // History actions
  addToHistory: (entry: WordHistoryEntry) => void
  clearHistory: () => void
  removeHistoryEntry: (id: string) => void

  // Bookmark actions
  addBookmark: (bookmark: Bookmark) => void
  removeBookmark: (id: string) => void
  isPageBookmarked: (page: number) => boolean

  // Recent PDF actions
  addRecentPdf: (pdf: RecentPdf) => void

  // Search actions
  setSearchQuery: (query: string) => void
  setSearchResults: (results: SearchResult[]) => void
  setCurrentSearchIndex: (index: number) => void
  setIsSearching: (searching: boolean) => void
  goToNextSearchResult: () => void
  goToPrevSearchResult: () => void

  // OCR actions
  setOcrEnabled: (enabled: boolean) => void
  setOcrText: (page: number, data: OcrPageData) => void
  clearOcrText: () => void
  setIsOcrProcessing: (processing: boolean) => void
  setOcrProgress: (progress: number) => void

  // Panel actions
  setShowHistory: (show: boolean) => void
  toggleHistory: () => void
  setShowBookmarks: (show: boolean) => void
  toggleBookmarks: () => void
  setShowSearch: (show: boolean) => void
  toggleSearch: () => void
}

export const usePDFStore = create<PDFState>()(
  (set, get) => ({
    pdfFile: null,
      pdfDataUrl: null,
      pdfFileName: null,
      totalPages: 0,
      currentPage: 1,
      scale: 1,
      uploadProgress: 0,

      selectedWord: null,
      selectedSentence: null,
      selectedPageNumber: null,
      popupPosition: null,

      explanation: null,
      isExplaining: false,

      translationLanguage: 'hi',
      theme: 'dark',

      wordHistory: [],
      bookmarks: [],
      recentPdfs: [],
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1,
      isSearching: false,
      ocrEnabled: false,
      ocrText: {},
      isOcrProcessing: false,
      ocrProgress: 0,

      showHistory: false,
      showBookmarks: false,
      showSearch: false,

      setPdfFile: (file) =>
        set({
          pdfFile: file,
          pdfFileName: file?.name ?? null,
        }),

      setPdfFileName: (name) => set({ pdfFileName: name }),

      setPdfDataUrl: (url) => set({ pdfDataUrl: url }),
      setTotalPages: (pages) => set({ totalPages: pages }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setScale: (scale) => set({ scale }),
      setUploadProgress: (progress) => set({ uploadProgress: progress }),

      setSelectedWord: (word) => set({ selectedWord: word }),
      setSelectedSentence: (sentence) => set({ selectedSentence: sentence }),
      setSelectedPageNumber: (page) => set({ selectedPageNumber: page }),
      setPopupPosition: (pos) => set({ popupPosition: pos }),

      setExplanation: (explanation) => set({ explanation }),
      setIsExplaining: (loading) => set({ isExplaining: loading }),
      setTranslationLanguage: (lang) => set({ translationLanguage: lang }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      clearSelection: () =>
        set({
          selectedWord: null,
          selectedSentence: null,
          selectedPageNumber: null,
          popupPosition: null,
          explanation: null,
          isExplaining: false,
        }),

      reset: () =>
        set({
          pdfFile: null,
          pdfDataUrl: null,
          pdfFileName: null,
          totalPages: 0,
          currentPage: 1,
          scale: 1,
          uploadProgress: 0,
          selectedWord: null,
          selectedSentence: null,
          selectedPageNumber: null,
          popupPosition: null,
          explanation: null,
          isExplaining: false,
          searchQuery: '',
          searchResults: [],
          currentSearchIndex: -1,
          isSearching: false,
          showSearch: false,
          ocrEnabled: false,
          ocrText: {},
          isOcrProcessing: false,
          ocrProgress: 0,
        }),

      addToHistory: (entry) =>
        set((s) => ({
          wordHistory: [entry, ...s.wordHistory].slice(0, 100),
        })),
      clearHistory: () => set({ wordHistory: [] }),
      removeHistoryEntry: (id) =>
        set((s) => ({
          wordHistory: s.wordHistory.filter((e) => e.id !== id),
        })),

      addBookmark: (bookmark) =>
        set((s) => ({
          bookmarks: [...s.bookmarks, bookmark],
        })),
      removeBookmark: (id) =>
        set((s) => ({
          bookmarks: s.bookmarks.filter((b) => b.id !== id),
        })),
      isPageBookmarked: (page) => get().bookmarks.some((b) => b.pageNumber === page),

      addRecentPdf: (pdf) =>
        set((s) => ({
          recentPdfs: [pdf, ...s.recentPdfs.filter((p) => p.fileName !== pdf.fileName)].slice(0, 5),
        })),

      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchResults: (results) =>
        set({ searchResults: results, currentSearchIndex: results.length > 0 ? 0 : -1 }),
      setCurrentSearchIndex: (index) => set({ currentSearchIndex: index }),
      setIsSearching: (searching) => set({ isSearching: searching }),
      goToNextSearchResult: () =>
        set((s) => {
          if (s.searchResults.length === 0) return s
          const next = (s.currentSearchIndex + 1) % s.searchResults.length
          return {
            currentSearchIndex: next,
            currentPage: s.searchResults[next].pageNumber,
          }
        }),
      goToPrevSearchResult: () =>
        set((s) => {
          if (s.searchResults.length === 0) return s
          const prev =
            (s.currentSearchIndex - 1 + s.searchResults.length) %
            s.searchResults.length
          return {
            currentSearchIndex: prev,
            currentPage: s.searchResults[prev].pageNumber,
          }
        }),

      setShowHistory: (show) => set({ showHistory: show }),
      toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),
      setShowBookmarks: (show) => set({ showBookmarks: show }),
      toggleBookmarks: () => set((s) => ({ showBookmarks: !s.showBookmarks })),
      setShowSearch: (show) => set({ showSearch: show }),
      toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),

      setOcrEnabled: (enabled) => set({ ocrEnabled: enabled }),
      setOcrText: (page, data) =>
        set((s) => ({ ocrText: { ...s.ocrText, [page]: data } })),
      clearOcrText: () => set({ ocrText: {} }),
      setIsOcrProcessing: (processing) => set({ isOcrProcessing: processing }),
      setOcrProgress: (progress) => set({ ocrProgress: progress }),
  })
)
