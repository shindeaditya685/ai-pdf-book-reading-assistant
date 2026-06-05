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
} from 'lucide-react'
import { usePDFStore } from '@/store/use-pdf-store'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [minimized, setMinimized] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const wordOffsetsRef = useRef<number[]>([])
  const wordsRef = useRef<string[]>([])
  const pauseOnNextRef = useRef(false)
  const cancelledRef = useRef(false)

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

    const textLayer = document.querySelector('.pdf-text-layer')
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

  // Build word offsets from the text layer content
  const buildWordIndex = useCallback(() => {
    const textLayer = document.querySelector('.pdf-text-layer')
    if (!textLayer) return { words: [], offsets: [] }

    const spans = textLayer.querySelectorAll('span')
    const words: string[] = []
    const offsets: number[] = []

    spans.forEach((span) => {
      const text = span.textContent || ''
      const parts = text.match(/\S+/g) || []
      parts.forEach((part) => {
        offsets.push(words.length)
        words.push(part)
      })
    })
    return { words, offsets }
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

  const startTts = useCallback((text: string) => {
    speechSynthesis.cancel()
    cancelledRef.current = false

    const { words, offsets } = buildWordIndex()
    wordsRef.current = words
    wordOffsetsRef.current = offsets
    setTtsTotalWords(words.length)
    clearHighlights()

    const utterance = new SpeechSynthesisUtterance(text)
    const store = usePDFStore.getState()
    utterance.rate = store.ttsSpeed
    if (store.ttsVoiceURI) {
      const voice = voices.find((v) => v.voiceURI === store.ttsVoiceURI)
      if (voice) utterance.voice = voice
    }

    let lastHighlightedIdx = -1

    utterance.onboundary = (e) => {
      if (cancelledRef.current) return
      if (e.name !== 'word') return

      // Find which word this char index corresponds to
      const charIndex = e.charIndex ?? 0
      const preceding = text.slice(0, charIndex)
      const wordIdx = preceding.split(/\s+/).filter(Boolean).length - 1

      if (wordIdx >= 0 && wordIdx !== lastHighlightedIdx && wordIdx < words.length) {
        lastHighlightedIdx = wordIdx
        highlightWord(wordOffsetsRef.current[wordIdx] ?? wordIdx)
      }
    }

    utterance.onend = () => {
      if (!cancelledRef.current) {
        clearHighlights()
        setTtsPlaying(false)
        setTtsPaused(false)
      }
    }

    utterance.onerror = () => {
      if (!cancelledRef.current) {
        clearHighlights()
        setTtsPlaying(false)
        setTtsPaused(false)
      }
    }

    utteranceRef.current = utterance
    speechSynthesis.speak(utterance)
    setTtsPlaying(true)
    setTtsPaused(false)
  }, [voices, buildWordIndex, setTtsPlaying, setTtsPaused, setTtsTotalWords, clearHighlights, highlightWord])

  const pauseTts = useCallback(() => {
    speechSynthesis.pause()
    setTtsPaused(true)
  }, [setTtsPaused])

  const resumeTts = useCallback(() => {
    speechSynthesis.resume()
    setTtsPaused(false)
  }, [setTtsPaused])

  const stopTts = useCallback(() => {
    cancelledRef.current = true
    speechSynthesis.cancel()
    clearHighlights()
    setTtsPlaying(false)
    setTtsPaused(false)
    setTtsHighlightIndex(null)
  }, [clearHighlights, setTtsPlaying, setTtsPaused, setTtsHighlightIndex])

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
          className="absolute bottom-3 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-2xl backdrop-blur-md">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={ttsPaused ? resumeTts : pauseTts}
              title={ttsPaused ? 'Resume' : 'Pause'}
            >
              {ttsPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
            </Button>

            {/* Stop */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={stopTts}
              title="Stop"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>

            {!minimized && <div className="mx-1 h-5 w-px bg-border/60" />}

            {!minimized && (
              <>
                {/* Speed */}
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
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
                    className="h-1 w-16 appearance-none rounded-full bg-muted accent-emerald-500 cursor-pointer"
                    title={`Speed: ${ttsSpeed}x`}
                  />
                  <span className="min-w-[2.2rem] text-[10px] font-semibold text-muted-foreground">
                    {ttsSpeed}x
                  </span>
                </div>

                <div className="mx-1 h-5 w-px bg-border/60" />

                {/* Voice selector */}
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

                {/* Progress */}
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

            {/* Minimize / Expand */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setMinimized(!minimized)}
              title={minimized ? 'Show details' : 'Hide details'}
            >
              {minimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
