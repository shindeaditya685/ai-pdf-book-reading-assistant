import { create } from "zustand";
import { authFetch } from "@/lib/api";
import type { Quote, QuoteConversation, QuoteMessage } from "@/lib/quotes";

export interface WordExplanation {
  word: string;
  meaning: string;
  pronunciation: string;
  translation: string;
  simplifiedSentence?: string;
  example?: string;
}

export interface PopupPosition {
  x: number;
  y: number;
}

export type PronunciationAccent = "en-US" | "en-GB" | "en-AU" | "en-IN";

export const ACCENT_LABELS: Record<PronunciationAccent, string> = {
  "en-US": "American English",
  "en-GB": "British English",
  "en-AU": "Australian English",
  "en-IN": "Indian English",
};

export type TranslationLanguage =
  | "none"
  | "hi"
  | "mr"
  | "bn"
  | "or"
  | "kn"
  | "te"
  | "ta"
  | "pa"
  | "ml"
  | "ur"
  | "gu"
  | "ne"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "nl"
  | "ja"
  | "zh"
  | "ko"
  | "ar"
  | "ru"
  | "tr"
  | "ku"
  | "am"
  | "uz"
  | "vi"
  | "ps"
  | "fa";

export function detectBrowserLanguage(): TranslationLanguage {
  if (typeof window === "undefined") return "none";
  try {
    const raw = navigator.language.split("-")[0].toLowerCase();
    const supported: TranslationLanguage[] = [
      "hi",
      "mr",
      "bn",
      "or",
      "kn",
      "te",
      "ta",
      "pa",
      "ml",
      "ur",
      "gu",
      "ne",
      "es",
      "fr",
      "de",
      "pt",
      "nl",
      "ja",
      "zh",
      "ko",
      "ar",
      "ru",
      "tr",
      "ku",
      "am",
      "uz",
      "vi",
      "ps",
      "fa",
    ];
    return supported.includes(raw as TranslationLanguage)
      ? (raw as TranslationLanguage)
      : "none";
  } catch {
    return "none";
  }
}

const STORAGE_KEY_LANG = "pdf-reader-ai-translation-language";
const STORAGE_KEY_ACCENT = "pdf-reader-ai-accent";

function loadInitialLanguage(): TranslationLanguage {
  if (typeof window === "undefined") return "none";
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LANG);
    if (stored) {
      const supported: TranslationLanguage[] = [
        "none",
        "hi",
        "mr",
        "bn",
        "or",
        "kn",
        "te",
        "ta",
        "pa",
        "ml",
        "ur",
        "gu",
        "ne",
        "es",
        "fr",
        "de",
        "pt",
        "nl",
        "ja",
        "zh",
        "ko",
        "ar",
        "ru",
        "tr",
        "ku",
        "am",
        "uz",
        "vi",
        "ps",
        "fa",
      ];
      if (supported.includes(stored as TranslationLanguage))
        return stored as TranslationLanguage;
    }
  } catch {}
  return detectBrowserLanguage();
}

export const LANGUAGE_LABELS: Record<TranslationLanguage, string> = {
  none: "No Translation",
  hi: "Hindi",
  mr: "Marathi",
  bn: "Bengali",
  or: "Odia",
  kn: "Kannada",
  te: "Telugu",
  ta: "Tamil",
  pa: "Punjabi",
  ml: "Malayalam",
  ur: "Urdu",
  gu: "Gujarati",
  ne: "Nepali",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  nl: "Dutch",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  ar: "Arabic",
  ru: "Russian",
  tr: "Turkish",
  ku: "Kurdish",
  am: "Amharic",
  uz: "Uzbek",
  vi: "Vietnamese",
  ps: "Pashto",
  fa: "Farsi",
};

// Used by API routes to tell the AI which language + script to output
export const LANGUAGE_SCRIPT: Record<string, string> = {
  hi: "Hindi (Devanagari script)",
  mr: "Marathi (Devanagari script)",
  bn: "Bengali (Bangla script)",
  or: "Odia (Odia script)",
  kn: "Kannada (Kannada script)",
  te: "Telugu (Telugu script)",
  ta: "Tamil (Tamil script)",
  pa: "Punjabi (Gurmukhi script)",
  ml: "Malayalam (Malayalam script)",
  ur: "Urdu (Nastaliq script)",
  gu: "Gujarati (Gujarati script)",
  ne: "Nepali (Devanagari script)",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  nl: "Dutch",
  ja: "Japanese",
  zh: "Chinese (Simplified)",
  ko: "Korean",
  ar: "Arabic",
  ru: "Russian",
  tr: "Turkish",
  ku: "Kurdish (Kurmanji)",
  am: "Amharic (Geʻez script)",
  uz: "Uzbek (Latin script)",
  vi: "Vietnamese (Latin script)",
  ps: "Pashto (Naskh script)",
  fa: "Farsi (Perso-Arabic script)",
};

export interface WordHistoryEntry {
  id: string;
  word: string;
  meaning: string;
  pronunciation: string;
  translation: string;
  sentence: string;
  pageNumber: number;
  pdfFileName: string;
  timestamp: number;
}

export interface Bookmark {
  id: string;
  pageNumber: number;
  word: string;
  meaning: string;
  pronunciation: string;
  translation: string;
  sentence: string;
  timestamp: number;
  pdfFileName: string;
}

export interface Annotation {
  id: string;
  pdfFileName: string;
  pageNumber: number;
  type: "highlight" | "drawing" | "note";
  color: string;
  rects?: { left: number; top: number; width: number; height: number }[];
  points?: { x: number; y: number }[];
  thickness?: number;
  noteText?: string;
  x?: number;
  y?: number;
  timestamp?: number;
}

export interface AnnotationAction {
  type: "add" | "delete" | "update";
  annotation: Annotation;
  prevAnnotation?: Annotation;
}

export interface OcrWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrPageData {
  text: string;
  words: OcrWord[];
  width: number;
  height: number;
}

export interface SearchResult {
  pageNumber: number;
  text: string;
  index: number;
}

export interface Flashcard {
  _id?: string;
  id?: string;
  bookmarkId: string;
  word: string;
  meaning: string;
  pronunciation: string;
  translation: string;
  sentence: string;
  pageNumber: number;
  pdfFileName: string;
  ef: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  lastReview: string | null;
  totalReviews: number;
  createdAt: string;
}

export interface RecentPdf {
  fileName: string;
  timestamp: number;
  pageCount?: number;
  lastPage?: number;
  wordCount?: number;
  bookmarkCount?: number;
}

export interface SessionMember {
  username: string;
  color: string;
  joinedAt: string;
}

export interface ShareSession {
  _id: string;
  name: string;
  inviteCode: string;
  pdfFileName: string;
  createdBy: string;
  members: SessionMember[];
  createdAt: string;
  updatedAt: string;
}

export interface SharedComment {
  id: string;
  author: string;
  text: string;
  mentions: string[];
  createdAt: string;
}

export interface SharedAnnotation {
  annotationId: string;
  sessionId: string;
  pdfFileName: string;
  pageNumber: number;
  type: "highlight" | "drawing" | "note";
  author: string;
  color: string;
  rects?: { left: number; top: number; width: number; height: number }[];
  points?: { x: number; y: number }[];
  thickness?: number;
  noteText?: string;
  comments: SharedComment[];
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SharedBookmark {
  bookmarkId: string;
  sessionId: string;
  word: string;
  meaning: string;
  pronunciation: string;
  translation: string;
  sentence: string;
  pageNumber: number;
  pdfFileName: string;
  author: string;
  timestamp: string;
}

export interface SharedFlashcard {
  flashcardId: string;
  sessionId: string;
  word: string;
  meaning: string;
  pronunciation: string;
  translation: string;
  sentence: string;
  pageNumber: number;
  pdfFileName: string;
  author: string;
  createdAt: string;
}

interface PDFState {
  // PDF file state
  pdfFile: File | null;
  pdfDataUrl: string | null;
  pdfFileName: string | null;
  totalPages: number;
  currentPage: number;
  scale: number;
  uploadProgress: number;

  // Word selection state
  selectedWord: string | null;
  selectedSentence: string | null;
  selectedPageNumber: number | null;
  popupPosition: PopupPosition | null;

  // Explanation state
  explanation: WordExplanation | null;
  isExplaining: boolean;
  isOfflineResult: boolean;

  // Settings
  translationLanguage: TranslationLanguage;
  accent: PronunciationAccent;
  scrollMode: boolean;
  theme: "light" | "dark";
  themeAccent: "emerald" | "violet" | "amber" | "rose" | "blue";

  // Word History
  wordHistory: WordHistoryEntry[];

  // Bookmarks
  bookmarks: Bookmark[];

  // Saved Quotes
  quotes: Quote[];
  showQuotes: boolean;
  /** Conversation list (sidebar / page). */
  quoteConversations: QuoteConversation[];
  /** Currently open conversation's messages (chat page). */
  quoteMessages: QuoteMessage[];
  /** Loading state for the chat send request. */
  quoteChatLoading: boolean;

  // Search
  searchQuery: string;
  searchResults: SearchResult[];
  currentSearchIndex: number;
  isSearching: boolean;

  // Recent PDFs
  recentPdfs: RecentPdf[];

  // Annotations state
  annotationMode: "select" | "highlight" | "pen" | "eraser" | "note";
  highlightColor: string;
  penColor: string;
  penWidth: number;
  annotations: Annotation[];
  undoStack: AnnotationAction[];
  redoStack: AnnotationAction[];

  // OCR state
  ocrEnabled: boolean;
  ocrText: Record<number, OcrPageData>;
  isOcrProcessing: boolean;
  ocrProgress: number;

  // Flashcards
  flashcards: Flashcard[];
  showFlashcards: boolean;
  flashcardsLoading: boolean;

  // Reading stats
  todayPages: number;
  todayMinutes: number;
  streakCount: number;
  dailyGoalEnabled: boolean;
  dailyGoalPages: number;
  dailyGoalMinutes: number;
  showReadingStats: boolean;
  showReadingAnalytics: boolean;

  // UI panels
  showHistory: boolean;
  showBookmarks: boolean;
  showSearch: boolean;
  showQuestionGenerator: boolean;
  showSummarizer: boolean;
  focusMode: boolean;

  // New summary state
  summaryLoading: boolean;
  summaryContent: string | null;
  summaryError: string | null;
  savedSummaries: { content: string; timestamp: number }[];

  // Share session state
  showSharePanel: boolean;
  shareSession: ShareSession | null;
  sharedAnnotations: SharedAnnotation[];
  sharedBookmarks: SharedBookmark[];
  sharedFlashcards: SharedFlashcard[];
  shareSessions: ShareSession[];

  // Real-time collaboration
  remoteCursors: Record<string, { username: string; color: string; pageNumber: number; x: number; y: number }>;
  remotePages: Record<string, number>;
  mouseX: number;
  mouseY: number;

  // Session chat
  sessionChat: { id: string; username: string; color: string; text: string; createdAt: string }[];

  // Follow mode
  followMode: boolean;

  // Shared timer
  sharedTimer: { isRunning: boolean; mode: string; totalMs: number; startedAt: string | null } | null;

  // Shared TTS
  sharedTts: { username: string; color: string; playing: boolean; paused: boolean; pageNumber: number; wordIndex: number | null; speed: number } | null;

  // TTS state
  ttsPlaying: boolean;
  ttsPaused: boolean;
  ttsSpeed: number;
  ttsVoiceURI: string | null;
  ttsHighlightIndex: number | null;
  ttsTotalWords: number;

  // Actions
  setPdfFile: (file: File | null) => void;
  setPdfFileName: (name: string | null) => void;
  setPdfDataUrl: (url: string | null) => void;
  setTotalPages: (pages: number) => void;
  setCurrentPage: (page: number) => void;
  setScale: (scale: number) => void;
  setUploadProgress: (progress: number) => void;
  setSelectedWord: (word: string | null) => void;
  setSelectedSentence: (sentence: string | null) => void;
  setSelectedPageNumber: (page: number | null) => void;
  setPopupPosition: (pos: PopupPosition | null) => void;
  setExplanation: (explanation: WordExplanation | null) => void;
  setIsExplaining: (loading: boolean) => void;
  setIsOfflineResult: (offline: boolean) => void;
  setTranslationLanguage: (lang: TranslationLanguage) => void;
  setAccent: (accent: PronunciationAccent) => void;
  setScrollMode: (mode: boolean) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setThemeAccent: (accent: "emerald" | "violet" | "amber" | "rose" | "blue") => void;
  clearSelection: () => void;
  reset: () => void;

  // History actions
  addToHistory: (entry: WordHistoryEntry) => void;
  clearHistory: () => void;
  removeHistoryEntry: (id: string) => void;

  // Bookmark actions
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (id: string) => void;
  isPageBookmarked: (page: number) => boolean;

  // Quote actions
  setQuotes: (quotes: Quote[]) => void;
  addQuote: (quote: Quote) => void;
  updateQuote: (id: string, patch: Partial<Quote>) => void;
  removeQuote: (id: string) => void;
  setShowQuotes: (show: boolean) => void;
  toggleQuotes: () => void;
  /** Remove all quotes tied to a deleted book. */
  removeQuotesForFile: (pdfFileName: string) => void;

  // Quote conversation actions
  setQuoteConversations: (convs: QuoteConversation[]) => void;
  addQuoteConversation: (conv: QuoteConversation) => void;
  updateQuoteConversation: (id: string, patch: Partial<QuoteConversation>) => void;
  removeQuoteConversation: (id: string) => void;
  setQuoteMessages: (messages: QuoteMessage[]) => void;
  appendQuoteMessage: (message: QuoteMessage) => void;
  setQuoteChatLoading: (loading: boolean) => void;

  // Recent PDF actions
  addRecentPdf: (pdf: RecentPdf) => void;
  removeRecentPdf: (fileName: string) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setCurrentSearchIndex: (index: number) => void;
  setIsSearching: (searching: boolean) => void;
  goToNextSearchResult: () => void;
  goToPrevSearchResult: () => void;

  // OCR actions
  setOcrEnabled: (enabled: boolean) => void;
  setOcrText: (page: number, data: OcrPageData) => void;
  clearOcrText: () => void;
  setIsOcrProcessing: (processing: boolean) => void;
  setOcrProgress: (progress: number) => void;

  // Panel actions
  setShowHistory: (show: boolean) => void;
  toggleHistory: () => void;
  setShowBookmarks: (show: boolean) => void;
  toggleBookmarks: () => void;
  setShowSearch: (show: boolean) => void;
  toggleSearch: () => void;
  setShowQuestionGenerator: (show: boolean) => void;
  toggleQuestionGenerator: () => void;
  setShowSummarizer: (show: boolean) => void;
  toggleSummarizer: () => void;

  // New summary actions
  generateSummaryStart: () => void;
  generateSummarySuccess: (content: string) => void;
  generateSummaryError: (error: string) => void;
  addSavedSummary: (content: string) => void;
  clearSummary: () => void;

  // Annotation actions
  setAnnotationMode: (
    mode: "select" | "highlight" | "pen" | "eraser" | "note",
  ) => void;
  setHighlightColor: (color: string) => void;
  setPenColor: (color: string) => void;
  setPenWidth: (width: number) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, text: string) => void;
  removeAnnotation: (id: string) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // Reading stats actions
  setTodayStats: (pages: number, minutes: number) => void;
  setStreakCount: (count: number) => void;
  setDailyGoal: (enabled: boolean, pages: number, minutes: number) => void;
  setShowReadingStats: (show: boolean) => void;
  toggleReadingStats: () => void;
  setShowReadingAnalytics: (show: boolean) => void;

  // Flashcard actions
  setFlashcards: (flashcards: Flashcard[]) => void;
  addFlashcard: (flashcard: Flashcard) => void;
  removeFlashcard: (id: string) => void;
  updateFlashcard: (id: string, data: Partial<Flashcard>) => void;
  setShowFlashcards: (show: boolean) => void;
  toggleFlashcards: () => void;

  // Focus mode
  setFocusMode: (mode: boolean) => void;
  toggleFocusMode: () => void;

  // Share session actions
  setShowSharePanel: (show: boolean) => void;
  toggleSharePanel: () => void;
  setShareSession: (session: ShareSession | null) => void;
  setSharedAnnotations: (annotations: SharedAnnotation[]) => void;
  addSharedAnnotation: (annotation: SharedAnnotation) => void;
  removeSharedAnnotation: (annotationId: string) => void;
  addSharedComment: (annotationId: string, comment: SharedComment) => void;
  setSharedBookmarks: (bookmarks: SharedBookmark[]) => void;
  addSharedBookmark: (bookmark: SharedBookmark) => void;
  removeSharedBookmark: (bookmarkId: string) => void;
  setSharedFlashcards: (flashcards: SharedFlashcard[]) => void;
  addSharedFlashcard: (flashcard: SharedFlashcard) => void;
  removeSharedFlashcard: (flashcardId: string) => void;
  setShareSessions: (sessions: ShareSession[]) => void;
  clearShareState: () => void;

  // Real-time collaboration actions
  addRemoteCursor: (username: string, cursor: { username: string; color: string; pageNumber: number; x: number; y: number }) => void;
  removeRemoteCursor: (username: string) => void;
  setRemotePage: (username: string, page: number) => void;
  setMousePosition: (x: number, y: number) => void;

  // Chat actions
  addSessionChatMessage: (msg: { id: string; username: string; color: string; text: string; createdAt: string }) => void;
  setSessionChatMessages: (msgs: { id: string; username: string; color: string; text: string; createdAt: string }[]) => void;

  // Follow mode actions
  setFollowMode: (enabled: boolean) => void;

  // Timer actions
  setSharedTimer: (timer: { isRunning: boolean; mode: string; totalMs: number; startedAt: string | null } | null) => void;

  // Shared TTS actions
  setSharedTts: (tts: { username: string; color: string; playing: boolean; paused: boolean; pageNumber: number; wordIndex: number | null; speed: number } | null) => void;

  // TTS actions
  setTtsPlaying: (playing: boolean) => void;
  setTtsPaused: (paused: boolean) => void;
  setTtsSpeed: (speed: number) => void;
  setTtsVoiceURI: (uri: string | null) => void;
  setTtsHighlightIndex: (index: number | null) => void;
  setTtsTotalWords: (total: number) => void;
}

const saveAnnotationToDb = async (ann: Annotation) => {
  try {
    await authFetch("/api/db/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ann),
    });
  } catch (err) {
    console.error("Failed to sync annotation to db:", err);
  }
};

const deleteAnnotationFromDb = async (id: string) => {
  try {
    await authFetch(`/api/db/annotations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.error("Failed to delete annotation from db:", err);
  }
};

export const usePDFStore = create<PDFState>()((set, get) => ({
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
  isOfflineResult: false,

  translationLanguage: loadInitialLanguage(),
  accent: (() => {
    if (typeof window === "undefined") return "en-US";
    try {
      return (
        (localStorage.getItem(STORAGE_KEY_ACCENT) as PronunciationAccent) ||
        "en-US"
      );
    } catch {
      return "en-US";
    }
  })(),
  scrollMode: true,
  theme: "dark",
  themeAccent: (() => {
    if (typeof window === "undefined") return "emerald";
    try {
      return (localStorage.getItem("pdf-reader-ai-theme-accent") as any) || "emerald";
    } catch { return "emerald"; }
  })(),

  wordHistory: [],
  bookmarks: [],
  quotes: [],
  showQuotes: false,
  quoteConversations: [],
  quoteMessages: [],
  quoteChatLoading: false,
  recentPdfs: [],
  searchQuery: "",
  searchResults: [],
  currentSearchIndex: -1,
  isSearching: false,
  ocrEnabled: false,
  ocrText: {},
  isOcrProcessing: false,
  ocrProgress: 0,

  flashcards: [],
  showFlashcards: false,
  flashcardsLoading: false,

  todayPages: 0,
  todayMinutes: 0,
  streakCount: 0,
  dailyGoalEnabled: false,
  dailyGoalPages: 10,
  dailyGoalMinutes: 30,
  showReadingStats: false,
  showReadingAnalytics: false,

  showHistory: false,
  showBookmarks: false,
  showSearch: false,
  showQuestionGenerator: false,
  showSummarizer: false,
  summaryLoading: false,
  summaryContent: null,
  summaryError: null,
  savedSummaries: [],
  focusMode: false,

  showSharePanel: false,
  shareSession: null,
  sharedAnnotations: [],
  sharedBookmarks: [],
  sharedFlashcards: [],
  shareSessions: [],
  remoteCursors: {},
  remotePages: {},
  mouseX: 0,
  mouseY: 0,
  sessionChat: [],
  followMode: false,
  sharedTimer: null,
  sharedTts: null,

  ttsPlaying: false,
  ttsPaused: false,
  ttsSpeed: 1,
  ttsVoiceURI: null,
  ttsHighlightIndex: null,
  ttsTotalWords: 0,

  annotationMode: "select",
  highlightColor: "rgba(253, 224, 71, 0.65)",
  penColor: "#EF4444",
  penWidth: 3,
  annotations: [],
  undoStack: [],
  redoStack: [],

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
  setIsOfflineResult: (offline) => set({ isOfflineResult: offline }),
  setTranslationLanguage: (lang) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
    }
    set({ translationLanguage: lang });
  },
  setAccent: (accent) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ACCENT, accent);
    }
    set({ accent });
  },
  setScrollMode: (mode) => set({ scrollMode: mode }),
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("pdf-reader-ai-theme", theme);
    }
    set({ theme });
  },
  toggleTheme: () => {
    if (typeof window !== "undefined") {
      const root = document.documentElement;
      const isDark = root.classList.contains("dark");
      root.classList.toggle("dark", !isDark);
      localStorage.setItem("pdf-reader-ai-theme", isDark ? "light" : "dark");
    }
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" }));
  },
  setThemeAccent: (accent) => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove("accent-emerald", "accent-violet", "accent-amber", "accent-rose", "accent-blue");
      document.documentElement.classList.add(`accent-${accent}`);
      localStorage.setItem("pdf-reader-ai-theme-accent", accent);
    }
    set({ themeAccent: accent });
  },

  clearSelection: () =>
    set({
      selectedWord: null,
      selectedSentence: null,
      selectedPageNumber: null,
      popupPosition: null,
      explanation: null,
      isExplaining: false,
      isOfflineResult: false,
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
      scrollMode: true,
      searchQuery: "",
      searchResults: [],
      currentSearchIndex: -1,
      isSearching: false,
      showSearch: false,
      showQuestionGenerator: false,
      showSummarizer: false,
      focusMode: false,
      ocrEnabled: false,
      ocrText: {},
      isOcrProcessing: false,
      ocrProgress: 0,
      annotationMode: "select",
      annotations: [],
      undoStack: [],
      redoStack: [],
      ttsPlaying: false,
      ttsPaused: false,
      ttsSpeed: 1,
      ttsVoiceURI: null,
      ttsHighlightIndex: null,
      ttsTotalWords: 0,
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
  isPageBookmarked: (page) =>
    get().bookmarks.some((b) => b.pageNumber === page),

  setQuotes: (quotes) => set({ quotes }),
  addQuote: (quote) => set((s) => ({ quotes: [quote, ...s.quotes] })),
  updateQuote: (id, patch) =>
    set((s) => ({
      quotes: s.quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    })),
  removeQuote: (id) =>
    set((s) => ({
      quotes: s.quotes.filter((q) => q.id !== id),
    })),
  setShowQuotes: (show) => set({ showQuotes: show }),
  toggleQuotes: () => set((s) => ({ showQuotes: !s.showQuotes })),
  removeQuotesForFile: (pdfFileName) =>
    set((s) => ({
      quotes: s.quotes.filter((q) => q.pdfFileName !== pdfFileName),
    })),

  setQuoteConversations: (quoteConversations) => set({ quoteConversations }),
  addQuoteConversation: (conv) => set((s) => ({ quoteConversations: [conv, ...s.quoteConversations] })),
  updateQuoteConversation: (id, patch) =>
    set((s) => ({
      quoteConversations: s.quoteConversations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  removeQuoteConversation: (id) =>
    set((s) => ({
      quoteConversations: s.quoteConversations.filter((c) => c.id !== id),
    })),
  setQuoteMessages: (quoteMessages) => set({ quoteMessages }),
  appendQuoteMessage: (message) => set((s) => ({ quoteMessages: [...s.quoteMessages, message] })),
  setQuoteChatLoading: (quoteChatLoading) => set({ quoteChatLoading }),

  addRecentPdf: (pdf) =>
    set((s) => ({
      recentPdfs: [
        {
          ...s.recentPdfs.find((p) => p.fileName === pdf.fileName),
          ...pdf,
        },
        ...s.recentPdfs.filter((p) => p.fileName !== pdf.fileName),
      ].slice(0, 10),
    })),
  removeRecentPdf: (fileName) =>
    set((s) => ({
      recentPdfs: s.recentPdfs.filter((p) => p.fileName !== fileName),
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) =>
    set({
      searchResults: results,
      currentSearchIndex: results.length > 0 ? 0 : -1,
    }),
  setCurrentSearchIndex: (index) => set({ currentSearchIndex: index }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  goToNextSearchResult: () =>
    set((s) => {
      if (s.searchResults.length === 0) return s;
      const next = (s.currentSearchIndex + 1) % s.searchResults.length;
      return {
        currentSearchIndex: next,
        currentPage: s.searchResults[next].pageNumber,
      };
    }),
  goToPrevSearchResult: () =>
    set((s) => {
      if (s.searchResults.length === 0) return s;
      const prev =
        (s.currentSearchIndex - 1 + s.searchResults.length) %
        s.searchResults.length;
      return {
        currentSearchIndex: prev,
        currentPage: s.searchResults[prev].pageNumber,
      };
    }),

  setShowHistory: (show) => set({ showHistory: show }),
  toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),
  setShowBookmarks: (show) => set({ showBookmarks: show }),
  toggleBookmarks: () => set((s) => ({ showBookmarks: !s.showBookmarks })),
  setShowSearch: (show) => set({ showSearch: show }),
  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),
  setShowQuestionGenerator: (show) => set({ showQuestionGenerator: show }),
  toggleQuestionGenerator: () =>
    set((s) => ({
      showQuestionGenerator: !s.showQuestionGenerator,
      showSummarizer: false,
      showBookmarks: false,
      showHistory: false,
      showSharePanel: false,
      showReadingStats: false,
      showFlashcards: false,
    })),
  setShowSummarizer: (show) => set({ showSummarizer: show }),
  toggleSummarizer: () =>
    set((s) => ({
      showSummarizer: !s.showSummarizer,
      showQuestionGenerator: false,
      showBookmarks: false,
      showHistory: false,
      showSharePanel: false,
      showReadingStats: false,
      showFlashcards: false,
    })),

  generateSummaryStart: () =>
    set({ summaryLoading: true, summaryContent: null, summaryError: null }),
  generateSummarySuccess: (content) =>
    set({ summaryLoading: false, summaryContent: content, summaryError: null }),
  generateSummaryError: (error) =>
    set({ summaryLoading: false, summaryContent: null, summaryError: error }),
  addSavedSummary: (content) =>
    set((s) => ({
      savedSummaries: [
        { content, timestamp: Date.now() },
        ...s.savedSummaries,
      ].slice(0, 50),
    })),
  clearSummary: () =>
    set({ summaryLoading: false, summaryContent: null, summaryError: null }),

  setTodayStats: (pages, minutes) =>
    set({ todayPages: pages, todayMinutes: minutes }),
  setStreakCount: (count) => set({ streakCount: count }),
  setDailyGoal: (enabled, pages, minutes) =>
    set({
      dailyGoalEnabled: enabled,
      dailyGoalPages: pages,
      dailyGoalMinutes: minutes,
    }),
  setShowReadingStats: (show) => set({ showReadingStats: show }),
  toggleReadingStats: () =>
    set((s) => ({ showReadingStats: !s.showReadingStats })),
  setShowReadingAnalytics: (show) => set({ showReadingAnalytics: show }),

  setFlashcards: (flashcards) => set({ flashcards }),
  addFlashcard: (flashcard) =>
    set((s) => ({
      flashcards: [
        ...s.flashcards.filter(
          (f) =>
            f.word !== flashcard.word ||
            f.pdfFileName !== flashcard.pdfFileName,
        ),
        flashcard,
      ],
    })),
  removeFlashcard: (id) =>
    set((s) => ({
      flashcards: s.flashcards.filter((f) => (f._id || f.id) !== id),
    })),
  updateFlashcard: (id, data) =>
    set((s) => ({
      flashcards: s.flashcards.map((f) =>
        (f._id || f.id) === id ? { ...f, ...data } : f,
      ),
    })),
  setShowFlashcards: (show) => set({ showFlashcards: show }),
  toggleFlashcards: () => set((s) => ({ showFlashcards: !s.showFlashcards })),

  setFocusMode: (mode) => set({ focusMode: mode }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  setShowSharePanel: (show) => set({ showSharePanel: show }),
  toggleSharePanel: () => set((s) => ({ showSharePanel: !s.showSharePanel })),
  setShareSession: (session) => set({ shareSession: session }),
  setSharedAnnotations: (annotations) =>
    set({ sharedAnnotations: annotations }),
  addSharedAnnotation: (annotation) =>
    set((s) => ({
      sharedAnnotations: [
        annotation,
        ...s.sharedAnnotations.filter(
          (a) => a.annotationId !== annotation.annotationId,
        ),
      ],
    })),
  removeSharedAnnotation: (annotationId) =>
    set((s) => ({
      sharedAnnotations: s.sharedAnnotations.filter(
        (a) => a.annotationId !== annotationId,
      ),
    })),
  addSharedComment: (annotationId, comment) =>
    set((s) => ({
      sharedAnnotations: s.sharedAnnotations.map((a) =>
        a.annotationId === annotationId
          ? {
              ...a,
              comments: [...a.comments, comment],
              updatedAt: comment.createdAt,
            }
          : a,
      ),
    })),
  setSharedBookmarks: (bookmarks) => set({ sharedBookmarks: bookmarks }),
  addSharedBookmark: (bookmark) =>
    set((s) => ({
      sharedBookmarks: [
        bookmark,
        ...s.sharedBookmarks.filter(
          (b) => b.bookmarkId !== bookmark.bookmarkId,
        ),
      ],
    })),
  removeSharedBookmark: (bookmarkId) =>
    set((s) => ({
      sharedBookmarks: s.sharedBookmarks.filter(
        (b) => b.bookmarkId !== bookmarkId,
      ),
    })),
  setSharedFlashcards: (flashcards) => set({ sharedFlashcards: flashcards }),
  addSharedFlashcard: (flashcard) =>
    set((s) => ({
      sharedFlashcards: [
        flashcard,
        ...s.sharedFlashcards.filter(
          (f) => f.flashcardId !== flashcard.flashcardId,
        ),
      ],
    })),
  removeSharedFlashcard: (flashcardId) =>
    set((s) => ({
      sharedFlashcards: s.sharedFlashcards.filter(
        (f) => f.flashcardId !== flashcardId,
      ),
    })),
  setShareSessions: (sessions) => set({ shareSessions: sessions }),
  clearShareState: () =>
    set({
      showSharePanel: false,
      shareSession: null,
      sharedAnnotations: [],
      sharedBookmarks: [],
      sharedFlashcards: [],
      shareSessions: [],
      remoteCursors: {},
      remotePages: {},
      sessionChat: [],
      followMode: false,
      sharedTimer: null,
      sharedTts: null,
    }),

  addRemoteCursor: (username, cursor) =>
    set((s) => ({ remoteCursors: { ...s.remoteCursors, [username]: cursor } })),
  removeRemoteCursor: (username) =>
    set((s) => { const n = { ...s.remoteCursors }; delete n[username]; return { remoteCursors: n } }),
  setRemotePage: (username, page) =>
    set((s) => ({ remotePages: { ...s.remotePages, [username]: page } })),
  setMousePosition: (x, y) => set({ mouseX: x, mouseY: y }),

  addSessionChatMessage: (msg) =>
    set((s) => {
      if (s.sessionChat.some((m) => m.id === msg.id)) return s
      return { sessionChat: [...s.sessionChat, msg] }
    }),
  setSessionChatMessages: (msgs) =>
    set((s) => {
      const seen = new Set(s.sessionChat.map((m) => m.id))
      const merged = [...s.sessionChat]
      for (const m of msgs) if (!seen.has(m.id)) merged.push(m)
      return { sessionChat: merged }
    }),

  setFollowMode: (enabled) => set({ followMode: enabled }),

  setSharedTimer: (timer) => set({ sharedTimer: timer }),
  setSharedTts: (tts) => set({ sharedTts: tts }),

  setTtsPlaying: (playing) => set({ ttsPlaying: playing }),
  setTtsPaused: (paused) => set({ ttsPaused: paused }),
  setTtsSpeed: (speed) => set({ ttsSpeed: speed }),
  setTtsVoiceURI: (uri) => set({ ttsVoiceURI: uri }),
  setTtsHighlightIndex: (index) => set({ ttsHighlightIndex: index }),
  setTtsTotalWords: (total) => set({ ttsTotalWords: total }),

  setAnnotationMode: (mode) => set({ annotationMode: mode }),
  setHighlightColor: (color) => set({ highlightColor: color }),
  setPenColor: (color) => set({ penColor: color }),
  setPenWidth: (width) => set({ penWidth: width }),
  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (ann) =>
    set((s) => ({
      annotations: [...s.annotations, ann],
      undoStack: [...s.undoStack, { type: "add", annotation: ann }],
      redoStack: [],
    })),
  updateAnnotation: (id, text) =>
    set((s) => {
      const prev = s.annotations.find((a) => a.id === id);
      if (!prev) return {};
      const updated = { ...prev, noteText: text };
      return {
        annotations: s.annotations.map((a) => (a.id === id ? updated : a)),
        undoStack: [
          ...s.undoStack,
          { type: "update", annotation: updated, prevAnnotation: prev },
        ],
        redoStack: [],
      };
    }),
  removeAnnotation: (id) =>
    set((s) => {
      const prev = s.annotations.find((a) => a.id === id);
      if (!prev) return {};
      return {
        annotations: s.annotations.filter((a) => a.id !== id),
        undoStack: [...s.undoStack, { type: "delete", annotation: prev }],
        redoStack: [],
      };
    }),
  undo: async () => {
    const { undoStack, redoStack, annotations } = get();
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = [...redoStack, action];

    let newAnnotations = [...annotations];

    if (action.type === "add") {
      newAnnotations = newAnnotations.filter(
        (a) => a.id !== action.annotation.id,
      );
      await deleteAnnotationFromDb(action.annotation.id);
    } else if (action.type === "delete") {
      newAnnotations = [...newAnnotations, action.annotation];
      await saveAnnotationToDb(action.annotation);
    } else if (action.type === "update") {
      if (action.prevAnnotation) {
        newAnnotations = newAnnotations.map((a) =>
          a.id === action.annotation.id ? action.prevAnnotation! : a,
        );
        await saveAnnotationToDb(action.prevAnnotation);
      }
    }

    set({
      annotations: newAnnotations,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },
  redo: async () => {
    const { undoStack, redoStack, annotations } = get();
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const newUndoStack = [...undoStack, action];

    let newAnnotations = [...annotations];

    if (action.type === "add") {
      newAnnotations = [...newAnnotations, action.annotation];
      await saveAnnotationToDb(action.annotation);
    } else if (action.type === "delete") {
      newAnnotations = newAnnotations.filter(
        (a) => a.id !== action.annotation.id,
      );
      await deleteAnnotationFromDb(action.annotation.id);
    } else if (action.type === "update") {
      newAnnotations = newAnnotations.map((a) =>
        a.id === action.annotation.id ? action.annotation : a,
      );
      await saveAnnotationToDb(action.annotation);
    }

    set({
      annotations: newAnnotations,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },

  setOcrEnabled: (enabled) => set({ ocrEnabled: enabled }),
  setOcrText: (page, data) =>
    set((s) => ({ ocrText: { ...s.ocrText, [page]: data } })),
  clearOcrText: () => set({ ocrText: {} }),
  setIsOcrProcessing: (processing) => set({ isOcrProcessing: processing }),
  setOcrProgress: (progress) => set({ ocrProgress: progress }),
}));
