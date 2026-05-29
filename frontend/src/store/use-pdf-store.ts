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

interface PDFState {
  // PDF file state
  pdfFile: File | null
  pdfDataUrl: string | null
  pdfFileName: string | null
  totalPages: number
  currentPage: number
  scale: number

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

  // Actions
  setPdfFile: (file: File | null) => void
  setPdfDataUrl: (url: string | null) => void
  setTotalPages: (pages: number) => void
  setCurrentPage: (page: number) => void
  setScale: (scale: number) => void
  setSelectedWord: (word: string | null) => void
  setSelectedSentence: (sentence: string | null) => void
  setSelectedPageNumber: (page: number | null) => void
  setPopupPosition: (pos: PopupPosition | null) => void
  setExplanation: (explanation: WordExplanation | null) => void
  setIsExplaining: (loading: boolean) => void
  setTranslationLanguage: (lang: TranslationLanguage) => void
  clearSelection: () => void
  reset: () => void
}

export const usePDFStore = create<PDFState>((set) => ({
  pdfFile: null,
  pdfDataUrl: null,
  pdfFileName: null,
  totalPages: 0,
  currentPage: 1,
  scale: 1.5,

  selectedWord: null,
  selectedSentence: null,
  selectedPageNumber: null,
  popupPosition: null,

  explanation: null,
  isExplaining: false,

  translationLanguage: 'hi',

  setPdfFile: (file) =>
    set({
      pdfFile: file,
      pdfFileName: file?.name ?? null,
    }),

  setPdfDataUrl: (url) => set({ pdfDataUrl: url }),

  setTotalPages: (pages) => set({ totalPages: pages }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setScale: (scale) => set({ scale }),

  setSelectedWord: (word) => set({ selectedWord: word }),
  setSelectedSentence: (sentence) => set({ selectedSentence: sentence }),
  setSelectedPageNumber: (page) => set({ selectedPageNumber: page }),
  setPopupPosition: (pos) => set({ popupPosition: pos }),

  setExplanation: (explanation) => set({ explanation }),
  setIsExplaining: (loading) => set({ isExplaining: loading }),
  setTranslationLanguage: (lang) => set({ translationLanguage: lang }),

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
      scale: 1.5,
      selectedWord: null,
      selectedSentence: null,
      selectedPageNumber: null,
      popupPosition: null,
      explanation: null,
      isExplaining: false,
    }),
}))
