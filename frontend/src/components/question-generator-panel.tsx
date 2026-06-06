'use client'

import { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, Check, Play, BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker source
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
}

interface Question {
  id: string
  type: 'multiple-choice' | 'short-answer'
  question: string
  options?: string[]
  answer: string
  explanation: string
}

export function QuestionGeneratorPanel() {
  const {
    pdfDataUrl,
    pdfFileName,
    currentPage,
    totalPages,
    ocrText,
    showQuestionGenerator,
    setShowQuestionGenerator,
  } = usePDFStore()

  // Panel settings
  const [scope, setScope] = useState<'current' | 'range'>('current')
  const [startPage, setStartPage] = useState<number>(currentPage || 1)
  const [endPage, setEndPage] = useState<number>(currentPage || 1)
  const [quizType, setQuizType] = useState<'multiple-choice' | 'short-answer' | 'mix'>('mix')
  const [questionCount, setQuestionCount] = useState<number>(3)

  // Quiz state
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [quizStep, setQuizStep] = useState<'setup' | 'quiz' | 'results'>('setup')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  // Student answers
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [gradedAnswers, setGradedAnswers] = useState<Record<string, 'correct' | 'incorrect'>>({})
  const [showExplanation, setShowExplanation] = useState(false)
  const [shortAnswerInput, setShortAnswerInput] = useState('')

  // Sync start/end page with currentPage when panel is opened or page changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (showQuestionGenerator && scope === 'current') {
      setStartPage(currentPage || 1)
      setEndPage(currentPage || 1)
    }
  }, [currentPage, showQuestionGenerator, scope])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Helper to extract text from a range of pages
  const extractText = async (start: number, end: number): Promise<string> => {
    if (!pdfDataUrl) return ''
    
    setLoadingStep('Initializing PDF engine...')
    const loadingTask = pdfjsLib.getDocument(pdfDataUrl)
    const pdf = await loadingTask.promise
    
    let text = ''
    for (let pageNum = start; pageNum <= end; pageNum++) {
      if (pageNum < 1 || pageNum > pdf.numPages) continue
      
      setLoadingStep(`Reading page ${pageNum}...`)
      // Check OCR first
      if (ocrText && ocrText[pageNum]?.text) {
        text += ocrText[pageNum].text + '\n'
        continue
      }

      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const items = textContent.items.filter((item: any) => 'str' in item)
        const pageText = items.map((item: any) => item.str).join(' ')
        text += pageText + '\n'
      } catch (err) {
        console.error(`Error reading page ${pageNum}`, err)
      }
    }
    return text.trim()
  }

  const handleGenerate = async () => {
    if (!pdfDataUrl) return
    setLoading(true)
    setError(null)
    setQuestions([])
    setCurrentQuestionIndex(0)
    setAnswers({})
    setGradedAnswers({})
    setShowExplanation(false)
    setShortAnswerInput('')

    try {
      const start = scope === 'current' ? (currentPage || 1) : Math.min(Math.max(1, startPage), totalPages)
      const end = scope === 'current' ? (currentPage || 1) : Math.min(Math.max(startPage, endPage), totalPages)

      const extractedText = await extractText(start, end)
      if (!extractedText || extractedText.length < 50) {
        throw new Error('Not enough text content found on selected page(s). If this page is scanned, please wait for OCR to complete.')
      }

      setLoadingStep('Generating questions...')
      const res = await authFetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedText.substring(0, 12000), // Safety cap on tokens
          type: quizType,
          count: questionCount,
        }),
      })

      if (res.ok) {
        window.dispatchEvent(new CustomEvent('ai-quota-changed'))
      } else if (res.status === 429) {
        window.dispatchEvent(new CustomEvent('ai-quota-exceeded', { detail: { feature: 'question' } }))
      }

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || 'Failed to generate questions. Please try again.')
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error('AI could not formulate questions. Try a different range.')
      }

      setQuestions(data.questions)
      setQuizStep('quiz')
    } catch (err: any) {
      setError(err.message || 'An error occurred during question generation.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOption = (questionId: string, option: string) => {
    if (showExplanation) return // Answer already locked in
    const letter = option.charAt(0) // Extracts 'A', 'B', 'C', 'D'
    setAnswers((prev) => ({ ...prev, [questionId]: letter }))
    
    // Auto-grade multiple choice questions
    const currentQ = questions[currentQuestionIndex]
    const isCorrect = letter.toUpperCase() === currentQ.answer.trim().toUpperCase()
    setGradedAnswers((prev) => ({
      ...prev,
      [questionId]: isCorrect ? 'correct' : 'incorrect',
    }))
    setShowExplanation(true)
  }

  const handleShortAnswerSubmit = () => {
    if (!shortAnswerInput.trim()) return
    setAnswers((prev) => ({ ...prev, [questions[currentQuestionIndex].id]: shortAnswerInput }))
    setShowExplanation(true)
  }

  const handleSelfGradeShortAnswer = (grade: 'correct' | 'incorrect') => {
    const qId = questions[currentQuestionIndex].id
    setGradedAnswers((prev) => ({ ...prev, [qId]: grade }))
    
    // Proceed to next question or results
    handleNextQuestion()
  }

  const handleNextQuestion = () => {
    setShowExplanation(false)
    setShortAnswerInput('')
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    } else {
      setQuizStep('results')
    }
  }

  const handleRestartQuiz = () => {
    setQuestions([])
    setAnswers({})
    setGradedAnswers({})
    setShowExplanation(false)
    setShortAnswerInput('')
    setCurrentQuestionIndex(0)
    setQuizStep('setup')
  }

  if (!showQuestionGenerator) return null

  // Calculate score for multiple choice & self-graded short answer
  const correctAnswersCount = Object.values(gradedAnswers).filter((g) => g === 'correct').length

  const activeQuestion = questions[currentQuestionIndex]

  return (
    <ResponsivePanel
      open={showQuestionGenerator}
      onClose={() => setShowQuestionGenerator(false)}
      ariaLabel="AI Question Generator"
      header={
        <PanelHeader
          icon={HelpCircle}
          title="AI Question Generator"
          onClose={() => setShowQuestionGenerator(false)}
        />
      }
    >
      {/* Content Area */}
      <div className="flex h-full min-h-0 flex-col p-4 space-y-4 overflow-y-auto">
          {error && (
            <div className="flex gap-2 items-start rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Generation Failed</p>
                <p className="mt-0.5 opacity-90">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            /* LOADING STATE */
            <div className="flex h-full flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-muted border-t-emerald-500 animate-spin" />
                <HelpCircle className="absolute inset-0 m-auto h-5 w-5 text-emerald-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">AI Generator Active</h3>
                <p className="text-xs text-muted-foreground/75 mt-1 font-medium">{loadingStep}</p>
              </div>
            </div>
          ) : quizStep === 'setup' ? (
            /* SETUP CONFIG SCREEN */
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3.5">
                {/* 1. Scope selection */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Scope</label>
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      onClick={() => setScope('current')}
                      className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                        scope === 'current' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Current Page ({currentPage})
                    </button>
                    <button
                      onClick={() => setScope('range')}
                      className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                        scope === 'range' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Custom Range
                    </button>
                  </div>
                </div>

                {/* Range inputs if scope is range */}
                {scope === 'range' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex gap-2 items-center pt-1"
                  >
                    <div className="flex-1">
                      <label className="text-[9px] text-muted-foreground">Start Page</label>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={startPage}
                        onChange={(e) => setStartPage(Math.min(totalPages, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-muted-foreground">End Page</label>
                      <input
                        type="number"
                        min={startPage}
                        max={totalPages}
                        value={endPage}
                        onChange={(e) => setEndPage(Math.min(totalPages, Math.max(startPage, Number(e.target.value) || 1)))}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 2. Quiz type selection */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Question Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['multiple-choice', 'short-answer', 'mix'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setQuizType(type)}
                      className={`rounded-lg py-2 text-[10px] font-semibold border capitalize transition-colors ${
                        quizType === type ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type === 'mix' ? 'Mixed' : type === 'multiple-choice' ? 'MCQs' : 'Short'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Question Count selection */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Number of Questions</label>
                <div className="flex gap-2">
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setQuestionCount(num)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-semibold border transition-colors ${
                        questionCount === num ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Generation Action */}
              <button
                onClick={handleGenerate}
                disabled={!pdfFileName}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-semibold text-white hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-500/10 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                <Play className="h-4 w-4 fill-white" />
                Generate Quiz
              </button>
            </div>
          ) : quizStep === 'quiz' && activeQuestion ? (
            /* ACTIVE QUIZ SCREEN */
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase">
                  <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                  <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Text */}
              <div className="rounded-xl border border-border/80 bg-background/50 p-3.5 shadow-sm">
                <p className="text-xs font-bold leading-relaxed text-foreground">
                  {activeQuestion.question}
                </p>
                <span className="inline-block mt-2 rounded bg-muted/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                  {activeQuestion.type === 'multiple-choice' ? 'Multiple Choice' : 'Short Answer'}
                </span>
              </div>

              {/* Input Options / Form fields based on question type */}
              {activeQuestion.type === 'multiple-choice' ? (
                /* MCQs rendering */
                <div className="space-y-2">
                  {activeQuestion.options?.map((option) => {
                    const letter = option.charAt(0) // A, B, C, D
                    const isSelected = answers[activeQuestion.id] === letter
                    const isCorrect = activeQuestion.answer.trim().toUpperCase() === letter
                    
                    let cardStyle = 'border-border bg-background text-foreground hover:bg-muted/40'
                    if (showExplanation) {
                      if (isCorrect) {
                        cardStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
                      } else if (isSelected) {
                        cardStyle = 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400'
                      } else {
                        cardStyle = 'border-border/40 opacity-50 bg-background text-muted-foreground'
                      }
                    }

                    return (
                      <button
                        key={option}
                        onClick={() => handleSelectOption(activeQuestion.id, option)}
                        disabled={showExplanation}
                        className={`w-full text-left p-3 text-xs rounded-xl border flex items-center justify-between gap-3 transition-all duration-150 ${cardStyle}`}
                      >
                        <span className="leading-snug">{option}</span>
                        {showExplanation && isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                        {showExplanation && isSelected && !isCorrect && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
                      </button>
                    )
                  })}
                </div>
              ) : (
                /* Short answer rendering */
                <div className="space-y-2">
                  <textarea
                    placeholder="Type your answer here..."
                    value={shortAnswerInput}
                    onChange={(e) => setShortAnswerInput(e.target.value)}
                    disabled={showExplanation}
                    rows={4}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-emerald-500 disabled:opacity-70 disabled:bg-muted/20"
                  />
                  {!showExplanation && (
                    <button
                      onClick={handleShortAnswerSubmit}
                      disabled={!shortAnswerInput.trim()}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      Submit Answer
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Explanation & Short Answer Self-Grading */}
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-2.5"
                >
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      {activeQuestion.type === 'multiple-choice' ? 'Correct Answer' : 'Model Answer'}
                    </span>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {activeQuestion.type === 'multiple-choice' 
                        ? `Option ${activeQuestion.answer.trim().toUpperCase()}`
                        : activeQuestion.answer
                      }
                    </p>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Explanation</span>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      {activeQuestion.explanation}
                    </p>
                  </div>

                  {activeQuestion.type === 'short-answer' ? (
                    /* Self grade actions for short answers */
                    <div className="border-t border-border/60 pt-2.5 mt-1">
                      <p className="text-[10px] font-bold text-center text-muted-foreground uppercase mb-2">
                        Grade your answer based on key points:
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSelfGradeShortAnswer('incorrect')}
                          className="flex-1 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100/50 transition-colors"
                        >
                          Missed points
                        </button>
                        <button
                          onClick={() => handleSelfGradeShortAnswer('correct')}
                          className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/50 transition-colors"
                        >
                          Covered details
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* MCQ next button */
                    <button
                      onClick={handleNextQuestion}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors mt-2"
                    >
                      {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </motion.div>
              )}
            </div>
          ) : quizStep === 'results' ? (
            /* RESULTS SUMMARY SCREEN */
            <div className="space-y-5 text-center py-6">
              {/* Score circle */}
              <div className="relative mx-auto h-28 w-28 flex items-center justify-center rounded-full bg-emerald-500/10 border-4 border-emerald-500/20">
                <div className="text-center">
                  <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {Math.round((correctAnswersCount / questions.length) * 100)}%
                  </span>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">SCORE</p>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-foreground">Quiz Completed!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  You scored {correctAnswersCount} out of {questions.length} questions correctly.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3 text-left space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Performance Insight</p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {correctAnswersCount === questions.length 
                    ? 'Excellent job! You have full comprehension of the selected page(s).' 
                    : correctAnswersCount >= questions.length / 2 
                    ? 'Good effort! Review the explanations to consolidate the concepts you missed.' 
                    : 'Consider re-reading this section and trying the quiz again to verify details.'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRestartQuiz}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try Again
                </button>
                <button
                  onClick={handleRestartQuiz}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
                >
                  Configure New
                </button>
              </div>
            </div>
          ) : null}
      </div>
    </ResponsivePanel>
  )
}
