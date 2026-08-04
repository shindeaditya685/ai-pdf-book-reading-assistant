'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  Square,
  Volume2,
  Gauge,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'
import { usePDFStore } from '@/store/use-pdf-store'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

/**
 * Shorten a TTS voice name to a friendly, recognizable label.
 * e.g. "Microsoft Aria Online (Natural) - English (United States)" → "Aria"
 *      "Google US English" → "US English"
 *      "Samantha" → "Samantha"
 */
function shortVoiceName(name: string): string {
  if (!name) return 'Voice'
  // Strip common vendor prefixes
  let n = name.replace(/^(Microsoft|Google|Apple)\s+/i, '')
  // If there's "X Online/Downloaded/Desktop (something) - Lang", grab the first word
  const dashSplit = n.split(/\s+-\s+/)
  if (dashSplit.length > 1) n = dashSplit[0]
  // If pattern is "FirstName Lastname/Suffix" keep the first word
  const tokens = n.split(/\s+/)
  // If first token is a known vendor/system word, drop it
  if (/^(Online|Desktop|Natural|Enhanced|Premium|Compact|Wavenet|Neural|Standard)$/i.test(tokens[0]) && tokens.length > 1) {
    return tokens[1]
  }
  // Cap to first 2 tokens if they're short
  if (tokens.length >= 2 && tokens[0].length <= 10 && tokens[1].length <= 10) {
    return `${tokens[0]} ${tokens[1]}`
  }
  return tokens[0] || 'Voice'
}

function findStartWordIndex(fullWords: string[], selectedText: string): number {
  if (!selectedText) return 0
  const cleanSel = selectedText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
  if (cleanSel.length === 0) return 0

  const cleanFull = fullWords.map(w => w.toLowerCase().replace(/[^\w\s]/g, ''))
  
  for (let i = 0; i <= cleanFull.length - cleanSel.length; i++) {
    let match = true
    for (let j = 0; j < cleanSel.length; j++) {
      if (cleanFull[i + j] !== cleanSel[j] && !cleanFull[i + j].includes(cleanSel[j]) && !cleanSel[j].includes(cleanFull[i + j])) {
        match = false
        break
      }
    }
    if (match) return i
  }
  return 0
}

export function TtsControls() {
  const {
    ttsPlaying,
    ttsPaused,
    ttsSpeed,
    ttsVoiceURI,
    ttsTotalWords,
    ttsHighlightIndex,
    setTtsPlaying,
    setTtsPaused,
    setTtsSpeed,
    setTtsVoiceURI,
    setTtsHighlightIndex,
    setTtsTotalWords,
    pdfFileName,
    currentPage,
  } = usePDFStore()

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const isMobile = useIsMobile()
  // Start minimized on mobile so the bar fits on small screens.
  // The Play / Stop buttons stay visible; user can expand to access speed / voice.
  const [minimized, setMinimized] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  )
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const wordOffsetsRef = useRef<number[]>([])
  const wordsRef = useRef<string[]>([])
  const wordStartsRef = useRef<number[]>([])
  const hasDomWordsRef = useRef<boolean>(false)
  const pauseOnNextRef = useRef(false)
  const cancelledRef = useRef(false)
  const currentChunkIdxRef = useRef<number>(0)
  const charOffsetRef = useRef<number>(0)
  const originalTextRef = useRef<string>('')
  const lastHighlightedIdxRef = useRef<number>(-1)
  const isRestartingRef = useRef<boolean>(false)
  const speakChunkRef = useRef<() => void>(() => {})
  // Word-highlight fallback: drives the highlight from wall-clock time when the
  // browser never fires `onboundary` events (common on some voices/platforms).
  const estimateTimerRef = useRef<number | null>(null)
  const chunkStartRef = useRef<number>(0)
  const lastBoundaryAtRef = useRef<number>(-1)
  const lastBoundaryWordRef = useRef<number>(-1)

  // Load available voices
  useEffect(() => {
    const load = () => {
      const v = speechSynthesis.getVoices()
      setVoices(v)
      // Auto-select first voice matching the current accent
      if (v.length > 0 && !ttsVoiceURI) {
        const accent = usePDFStore.getState().accent
        const match = v.find((voice) => voice.lang.startsWith(accent.slice(0, 2)))
        setTtsVoiceURI(match?.voiceURI ?? v[0].voiceURI)
      }
    }
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [ttsVoiceURI, setTtsVoiceURI])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true
      if (estimateTimerRef.current !== null) window.clearInterval(estimateTimerRef.current)
      speechSynthesis.cancel()
    }
  }, [])

  // Clear TTS highlight overlays
  const clearHighlights = useCallback(() => {
    document.querySelectorAll('.tts-highlight-overlay').forEach((el) => el.remove())
    setTtsHighlightIndex(null)
  }, [setTtsHighlightIndex])

  // Highlight the exact word being spoken by walking text nodes and matching words via regex
  const highlightWord = useCallback((wordIndex: number) => {
    document.querySelectorAll('.tts-highlight-overlay').forEach((el) => el.remove())

    const livePage = usePDFStore.getState().currentPage
    const currentPageDiv = document.querySelector(`[data-page="${livePage}"]`)
    const textLayer = currentPageDiv?.querySelector('.pdf-text-layer')
    if (!textLayer) return

    const spans = textLayer.querySelectorAll('span')
    let accumulated = 0

    for (const span of spans) {
      const parts = (span.textContent || '').match(/\S+/g) || []
      if (wordIndex < accumulated + parts.length) {
        const localIdx = wordIndex - accumulated

        const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT, null)
        let node: Text | null
        let wordCount = 0
        let foundNode: Text | null = null
        let foundStart = 0
        let foundEnd = 0

        while ((node = walker.nextNode() as Text | null)) {
          const text = node.textContent || ''
          const re = /\S+/g
          let match: RegExpExecArray | null
          while ((match = re.exec(text)) !== null) {
            if (wordCount === localIdx) {
              foundNode = node
              foundStart = match.index
              foundEnd = match.index + match[0].length
              break
            }
            wordCount++
          }
          if (foundNode) break
        }

        if (foundNode) {
          const range = document.createRange()
          range.setStart(foundNode, foundStart)
          range.setEnd(foundNode, foundEnd)
          const wordRect = range.getBoundingClientRect()

          const parentEl = textLayer.parentElement
          const parentRect = parentEl?.getBoundingClientRect()
          if (parentEl && parentRect && (wordRect.width > 0 || wordRect.height > 0)) {
            const overlay = document.createElement('div')
            overlay.className = 'tts-highlight-overlay'
            overlay.style.position = 'absolute'
            overlay.style.left = `${wordRect.left - parentRect.left}px`
            overlay.style.top = `${wordRect.top - parentRect.top}px`
            overlay.style.width = `${wordRect.width}px`
            overlay.style.height = `${wordRect.height}px`
            overlay.style.backgroundColor = 'rgba(16, 185, 129, 0.35)'
            overlay.style.borderRadius = '2px'
            overlay.style.pointerEvents = 'none'
            overlay.style.zIndex = '5'
            overlay.style.boxShadow = '0 0 0 1px rgba(16, 185, 129, 0.4)'
            overlay.style.transition = 'all 0.12s ease'
            parentEl.appendChild(overlay)
          }
        }
        break
      }
      accumulated += parts.length
    }

    setTtsHighlightIndex(wordIndex)
  }, [setTtsHighlightIndex])

  // Build word offsets + per-word char starts from the SAME text layer that is
  // displayed. The returned `text` is the single source of truth for BOTH the
  // spoken content and the highlight mapping, so a char index maps to exactly
  // the word the user sees (no drift from re-parsing a different text).
  const buildWordIndex = useCallback(() => {
    const livePage = usePDFStore.getState().currentPage
    const currentPageDiv = document.querySelector(`[data-page="${livePage}"]`)
    const textLayer = currentPageDiv?.querySelector('.pdf-text-layer')
    if (!textLayer) return { words: [], offsets: [], starts: [], text: '', hasDom: false }

    const spans = textLayer.querySelectorAll('span')
    const words: string[] = []
    const starts: number[] = []
    let charPos = 0
    spans.forEach((span) => {
      const parts = (span.textContent || '').match(/\S+/g) || []
      for (const part of parts) {
        words.push(part)
        starts.push(charPos)
        // +1 to account for the single inter-word space in `text`
        charPos += part.length + 1
      }
    })
    const offsets = words.map((_, i) => i)
    const text = words.join(' ')
    return { words, offsets, starts, text, hasDom: text.length > 0 }
  }, [])

  // Start a low-frequency timer that estimates the currently-spoken word from
  // elapsed time. It only advances when the browser hasn't delivered a
  // `boundary` event recently, so accurate browsers drive the highlight
  // precisely and uncooperative ones still get a moving highlight.
  const ensureEstimator = useCallback(() => {
    if (estimateTimerRef.current !== null) return
    lastBoundaryAtRef.current = -1
    const speed = usePDFStore.getState().ttsSpeed
    const baselineMs =
      lastHighlightedIdxRef.current > 0 ? (lastHighlightedIdxRef.current / (2.8 * speed)) * 1000 : 0
    chunkStartRef.current = performance.now() - baselineMs
    estimateTimerRef.current = window.setInterval(() => {
      const state = usePDFStore.getState()
      const now = performance.now()
      if (
        cancelledRef.current ||
        isRestartingRef.current ||
        state.ttsPaused ||
        !state.ttsPlaying
      ) {
        return
      }
      // Only ever fill long silent gaps. Words are normally spoken faster than
      // this, so while real `boundary` events keep arriving the estimator never
      // fires — which is what prevents the highlight from jumping ahead and then
      // snapping back (correct → wrong → correct).
      if (lastBoundaryWordRef.current >= 0) {
        if (now - lastBoundaryAtRef.current < 1500) return
      } else if (now - lastBoundaryAtRef.current < 350) {
        return
      }
      const wordsPerSec = 2.8 * state.ttsSpeed // ~measured average across voices
      let estIdx: number
      if (lastBoundaryWordRef.current >= 0) {
        // Resume from the LAST real boundary word instead of guessing from the
        // start, so recovery from a gap lands on the word nearest reality.
        const advance = Math.floor(((now - lastBoundaryAtRef.current) / 1000) * wordsPerSec)
        estIdx = lastBoundaryWordRef.current + advance
      } else {
        const elapsedSec = (now - chunkStartRef.current) / 1000
        estIdx = Math.floor(elapsedSec * wordsPerSec)
      }
      if (estIdx > lastHighlightedIdxRef.current && estIdx < wordsRef.current.length) {
        lastHighlightedIdxRef.current = estIdx
        highlightWord(wordOffsetsRef.current[estIdx] ?? estIdx)
      }
    }, 120)
  }, [highlightWord])

  const stopEstimator = useCallback(() => {
    if (estimateTimerRef.current !== null) {
      window.clearInterval(estimateTimerRef.current)
      estimateTimerRef.current = null
    }
  }, [])

  // Stop TTS when page changes or PDF is unloaded
  const prevPageRef = useRef(currentPage)
  const prevFileNameRef = useRef(pdfFileName)
  useEffect(() => {
    if (ttsPlaying || ttsPaused) {
      if (currentPage !== prevPageRef.current || pdfFileName !== prevFileNameRef.current) {
        cancelledRef.current = true
        speechSynthesis.cancel()
        clearHighlights()
        setTtsPlaying(false)
        setTtsPaused(false)
        setTtsHighlightIndex(null)
      }
    }
    prevPageRef.current = currentPage
    prevFileNameRef.current = pdfFileName
  }, [currentPage, pdfFileName, ttsPlaying, ttsPaused, clearHighlights, setTtsPlaying, setTtsPaused, setTtsHighlightIndex])

  const startTts = useCallback((text: string, fromWordIndex: number = 0) => {
    speechSynthesis.cancel()
    cancelledRef.current = false
    isRestartingRef.current = false

    // Prefer the DOM text layer (guarantees speech stays aligned with what's
    // highlighted). Fall back to the passed `text` when the layer isn't ready.
    const { words, offsets, starts, text: domText, hasDom } = buildWordIndex()
    const speechText = (hasDom ? domText : (text || originalTextRef.current)).trim()
    const domWords = hasDom ? words : (speechText.match(/\S+/g) || [])

    wordsRef.current = domWords
    wordOffsetsRef.current = offsets
    wordStartsRef.current = starts
    hasDomWordsRef.current = hasDom && words.length > 0
    setTtsTotalWords(domWords.length)
    clearHighlights()

    originalTextRef.current = speechText

    // If text was passed and fromWordIndex is 0, let's see if it's a selection
    let actualStartWordIdx = fromWordIndex
    if (text && fromWordIndex === 0) {
      actualStartWordIdx = findStartWordIndex(domWords, text)
    }

    lastHighlightedIdxRef.current = actualStartWordIdx - 1
    lastBoundaryWordRef.current = -1
    lastBoundaryWordRef.current = -1

    // Split speechText into chunks and keep track of their start indices
    const chunks: { text: string; start: number }[] = []
    const regex = /(?<=[.?!])\s+|\n+/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(speechText)) !== null) {
      const chunkText = speechText.slice(lastIndex, match.index).trim()
      if (chunkText) {
        const actualStart = speechText.indexOf(chunkText, lastIndex)
        if (actualStart !== -1) {
          chunks.push({ text: chunkText, start: actualStart })
        }
      }
      lastIndex = regex.lastIndex
    }
    const lastChunkText = speechText.slice(lastIndex).trim()
    if (lastChunkText) {
      const actualStart = speechText.indexOf(lastChunkText, lastIndex)
      if (actualStart !== -1) {
        chunks.push({ text: lastChunkText, start: actualStart })
      }
    }

    if (chunks.length === 0) return

    // Now find the chunk that contains the starting word character position
    const charPos = actualStartWordIdx < starts.length ? starts[actualStartWordIdx] : 0

    let chunkIdx = 0
    let relativeOffset = 0
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      const nextC = chunks[i + 1]
      const endPos = nextC ? nextC.start : speechText.length
      if (charPos >= c.start && charPos < endPos) {
        chunkIdx = i
        relativeOffset = charPos - c.start
        break
      }
    }

    currentChunkIdxRef.current = chunkIdx
    charOffsetRef.current = charPos

    const speakChunk = () => {
      const currentIdx = currentChunkIdxRef.current
      if (cancelledRef.current || currentIdx >= chunks.length) {
        if (!cancelledRef.current && !isRestartingRef.current) {
          clearHighlights()
          setTtsPlaying(false)
          setTtsPaused(false)
        }
        return
      }
      const fullChunk = chunks[currentIdx]
      let chunkTextToSpeak = fullChunk.text
      if (currentIdx === chunkIdx && relativeOffset > 0) {
        chunkTextToSpeak = fullChunk.text.slice(relativeOffset)
      }
      ensureEstimator()
      // Read the LATEST speed / voice from the store on every chunk so that
      // mid-playback changes (speed slider, voice dropdown) take effect on
      // the next sentence instead of requiring a stop + restart.
      const liveState = usePDFStore.getState()
      const liveVoice = liveState.ttsVoiceURI
        ? voices.find((v) => v.voiceURI === liveState.ttsVoiceURI) ?? null
        : null

      const utterance = new SpeechSynthesisUtterance(chunkTextToSpeak)
      utterance.rate = liveState.ttsSpeed
      if (liveVoice) utterance.voice = liveVoice

      utterance.onboundary = (e) => {
        if (cancelledRef.current || isRestartingRef.current) return
        if (e.name && e.name !== 'word') return
        lastBoundaryAtRef.current = performance.now()
        const globalCharIndex = charOffsetRef.current + (e.charIndex ?? 0)
        let wordIdx = -1
        if (hasDomWordsRef.current && wordStartsRef.current.length > 0) {
          // Exact mapping: pick the last word whose char start is <= the index.
          const starts = wordStartsRef.current
          for (let i = 0; i < starts.length; i++) {
            if (starts[i] <= globalCharIndex) wordIdx = i
            else break
          }
        } else {
          // Fallback when the text layer isn't available.
          const preceding = originalTextRef.current.slice(0, globalCharIndex)
          wordIdx = preceding.split(/\s+/).filter(Boolean).length - 1
        }
        // Remember the anchor position so the fallback estimator, if it ever
        // needs to fill a gap, advances from HERE instead of from the start.
        lastBoundaryWordRef.current = wordIdx
        if (wordIdx >= 0 && wordIdx !== lastHighlightedIdxRef.current && wordIdx < wordsRef.current.length) {
          lastHighlightedIdxRef.current = wordIdx
          lastBoundaryWordRef.current = wordIdx
          highlightWord(wordOffsetsRef.current[wordIdx] ?? wordIdx)
        }
      }

      utterance.onend = () => {
        if (cancelledRef.current || isRestartingRef.current) return
        const nextIdx = currentChunkIdxRef.current + 1
        if (nextIdx < chunks.length) {
          charOffsetRef.current = chunks[nextIdx].start
        } else {
          charOffsetRef.current = fullChunk.start + fullChunk.text.length
        }
        relativeOffset = 0
        currentChunkIdxRef.current = nextIdx
        speakChunk()
      }

      utterance.onerror = (e) => {
        if (cancelledRef.current || isRestartingRef.current) return
        if (e.error && e.error !== 'interrupted' && e.error !== 'canceled') {
          clearHighlights()
          setTtsPlaying(false)
          setTtsPaused(false)
        }
      }

      utteranceRef.current = utterance
      speechSynthesis.speak(utterance)
    }

    speakChunkRef.current = speakChunk
    speakChunk()
    setTtsPlaying(true)
    setTtsPaused(false)
  }, [voices, buildWordIndex, setTtsPlaying, setTtsPaused, setTtsTotalWords, clearHighlights, highlightWord, ensureEstimator])

  // Handle immediate voice changes
  useEffect(() => {
    if (!ttsPlaying) return
    const currentIdx = Math.max(0, lastHighlightedIdxRef.current)
    stopEstimator()
    isRestartingRef.current = true
    speechSynthesis.cancel()
    isRestartingRef.current = false
    
    startTts('', currentIdx)
    if (ttsPaused) {
      speechSynthesis.pause()
    }
  }, [ttsVoiceURI, stopEstimator])

  // Handle speed changes during playback
  useEffect(() => {
    if (!ttsPlaying) return

    // Debounce the restart to prevent stuttering while dragging the slider
    const timer = setTimeout(() => {
      const currentIdx = Math.max(0, lastHighlightedIdxRef.current)
      stopEstimator()
      isRestartingRef.current = true
      speechSynthesis.cancel()
      isRestartingRef.current = false
      
      startTts('', currentIdx)
      if (ttsPaused) {
        speechSynthesis.pause()
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [ttsSpeed, stopEstimator])

  const pauseTts = useCallback(() => {
    stopEstimator()
    speechSynthesis.pause()
    setTtsPaused(true)
  }, [stopEstimator, setTtsPaused])

  const resumeTts = useCallback(() => {
    speechSynthesis.resume()
    setTtsPaused(false)
    ensureEstimator()
  }, [ensureEstimator, setTtsPaused])

  const stopTts = useCallback(() => {
    cancelledRef.current = true
    stopEstimator()
    speechSynthesis.cancel()
    clearHighlights()
    setTtsPlaying(false)
    setTtsPaused(false)
    setTtsHighlightIndex(null)
  }, [stopEstimator, clearHighlights, setTtsPlaying, setTtsPaused, setTtsHighlightIndex])

  // Expose functions via window for the PDF viewer to call
  useEffect(() => {
    ;(window as any).__ttsStart = startTts
    ;(window as any).__ttsStop = stopTts
    ;(window as any).__ttsPause = pauseTts
    ;(window as any).__ttsResume = resumeTts
  }, [startTts, stopTts, pauseTts, resumeTts])

  if (!pdfFileName) return null

  const selectedVoice = voices.find((v) => v.voiceURI === ttsVoiceURI)

  return (
    <AnimatePresence>
      {ttsPlaying || ttsPaused ? (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={
            isMobile
              ? "absolute bottom-20 inset-x-2 z-50"
              : "absolute bottom-3 left-1/2 z-50 -translate-x-1/2"
          }
        >
          <div className={
            isMobile
              ? "flex items-center gap-1.5 rounded-2xl border border-border/70 bg-background/95 px-2 py-1.5 shadow-2xl backdrop-blur-md"
              : "flex items-center gap-2 rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-2xl backdrop-blur-md"
          }>
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 sm:h-8 sm:w-8"
              onClick={ttsPaused ? resumeTts : pauseTts}
              title={ttsPaused ? 'Resume' : 'Pause'}
            >
              {ttsPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
            </Button>

            {/* Stop */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 sm:h-8 sm:w-8"
              onClick={stopTts}
              title="Stop"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>

            {/* Speed (always visible on mobile; only when expanded on desktop) */}
            {(isMobile || !minimized) && (
              <>
                <div className="mx-0.5 h-5 w-px bg-border/60 sm:mx-1" />
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={ttsSpeed}
                    onChange={(e) => {
                      const speed = Number(e.target.value)
                      setTtsSpeed(speed)
                      if (utteranceRef.current) {
                        utteranceRef.current.rate = speed
                      }
                    }}
                    className="h-1 w-12 shrink-0 appearance-none rounded-full bg-muted accent-emerald-500 cursor-pointer sm:w-16"
                    title={`Speed: ${ttsSpeed.toFixed(1)}x`}
                    aria-label="Playback speed"
                  />
                  <span className="min-w-[1.8rem] text-[10px] font-semibold text-muted-foreground tabular-nums sm:min-w-[2.2rem]">
                    {ttsSpeed.toFixed(1)}x
                  </span>
                </div>
              </>
            )}

            {/* Mobile: progress bar + voice dropdown in remaining space */}
            {isMobile && (
              <>
                <div className="flex flex-1 items-center gap-1.5 min-w-0">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                      style={{
                        width: ttsTotalWords > 0
                          ? `${Math.min(100, ((ttsHighlightIndex ?? 0) + 1) / ttsTotalWords * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-medium text-muted-foreground whitespace-nowrap tabular-nums">
                    {ttsHighlightIndex !== null ? ttsHighlightIndex + 1 : 0}/{ttsTotalWords}
                  </span>
                </div>

                {/* Voice: labeled dropdown trigger on mobile for discoverability */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-muted/60 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-95"
                      title={`Voice: ${selectedVoice?.name ?? 'Default'}`}
                      aria-label="Choose voice"
                    >
                      <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="max-w-[64px] truncate">
                        {selectedVoice ? shortVoiceName(selectedVoice.name) : 'Voice'}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    className="max-h-72 w-60"
                  >
                    <DropdownMenuLabel className="text-[10px]">Voice</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {voices.length === 0 ? (
                      <DropdownMenuItem disabled>No voices available</DropdownMenuItem>
                    ) : (
                      voices.map((v, i) => (
                        <DropdownMenuItem
                          key={`${v.voiceURI}-${i}`}
                          onSelect={() => setTtsVoiceURI(v.voiceURI)}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-xs">
                            {v.name} <span className="text-muted-foreground">({v.lang})</span>
                          </span>
                          {ttsVoiceURI === v.voiceURI && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          )}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {/* Desktop-only sections: voice select + progress + minimize toggle */}
            {!isMobile && (
              <>
                {!minimized && (
                  <>
                    <div className="mx-1 h-5 w-px bg-border/60" />
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <select
                        value={ttsVoiceURI || ''}
                        onChange={(e) => setTtsVoiceURI(e.target.value || null)}
                        className="max-w-[140px] truncate rounded-lg border border-border bg-background px-1.5 py-1 text-[10px] font-medium text-foreground outline-none focus:border-emerald-500"
                        title="Voice"
                      >
                        {voices.map((v, i) => (
                          <option key={`${v.voiceURI}-${i}`} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mx-1 h-5 w-px bg-border/60" />
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                          style={{
                            width: ttsTotalWords > 0
                              ? `${Math.min(100, ((ttsHighlightIndex ?? 0) + 1) / ttsTotalWords * 100)}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                        {ttsHighlightIndex !== null ? ttsHighlightIndex + 1 : 0}/{ttsTotalWords}
                      </span>
                    </div>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground sm:h-6 sm:w-6"
                  onClick={() => setMinimized(!minimized)}
                  title={minimized ? 'Show details' : 'Hide details'}
                >
                  {minimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
