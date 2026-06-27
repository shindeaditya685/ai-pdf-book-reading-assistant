export interface WordLabWord {
  id: string
  word: string
  pronunciation: string
  meaning: string
  translation: string
  example: string
  source: 'bookmark' | 'history' | 'ai'
}

export interface TestResult {
  wordId: string
  word: string
  questionType: 'fill-blank' | 'multiple-choice' | 'reverse-recall'
  userAnswer: string
  correctAnswer: string
  correct: boolean
  sentence?: string
}

export interface DailySession {
  date: string
  words: WordLabWord[]
  studiedIds: string[]
  testResults: TestResult[]
  score: number | null
  completedAt: string | null
}

export interface WordLabStats {
  currentStreak: number
  longestStreak: number
  totalWordsLearned: number
  totalTestsTaken: number
  totalCorrect: number
  totalAttempted: number
  dailyLogs: DailySession[]
  masteredWordIds: string[]
  level: 'bronze' | 'silver' | 'gold' | 'diamond'
}

export type LabPhase = 'study' | 'test' | 'results' | 'history' | 'review'

export type QuestionType = 'fill-blank' | 'multiple-choice' | 'reverse-recall'
