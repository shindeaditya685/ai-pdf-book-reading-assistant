'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Volume2, Mic, Square, CheckCircle2, XCircle, Repeat,
  ChevronLeft, ChevronRight, Ear, Loader2
} from 'lucide-react'
import { WordLabWord } from './types'

interface Props {
  words: WordLabWord[]
  onBack: () => void
}

type CoachPhase = 'idle' | 'listening' | 'recording' | 'result'

const BAR_COUNT = 64
const ORANGE = '#F97316'
const ORANGE_GLOW = 'rgba(249, 115, 22, 0.15)'
const GREEN = '#22C55E'
const RED = '#EF4444'

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function PronunciationCoach({ words, onBack }: Props) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<CoachPhase>('idle')
  const [transcript, setTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [history, setHistory] = useState<Record<number, { transcript: string; confidence: number }>>({})
  const [recordingDuration, setRecordingDuration] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const recognitionRef = useRef<any>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const word = words[index]
  const isLast = index === words.length - 1
  const isFirst = index === 0

  // ── Draw waveform ──
  const drawWaveform = useCallback((dataArray: Uint8Array, color = ORANGE) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.clearRect(0, 0, w, h)

    const barWidth = (w - (BAR_COUNT - 1) * 1.5) / BAR_COUNT
    const centerY = h / 2

    for (let i = 0; i < BAR_COUNT; i++) {
      const value = dataArray[i] / 255
      const barHeight = Math.max(value * (h * 0.7), 2)
      const x = i * (barWidth + 1.5)
      const y = centerY - barHeight / 2

      const alpha = 0.4 + value * 0.5
      ctx.fillStyle = color.replace('1)', `${alpha})`)
      if (color === ORANGE && value > 0.6) {
        ctx.shadowColor = ORANGE_GLOW
        ctx.shadowBlur = 8 * value
      } else {
        ctx.shadowBlur = 0
      }

      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 3, barWidth / 3])
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }, [])

  // ── Listen (TTS) ──
  const handleListen = useCallback(() => {
    setPhase('listening')
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    // Simulate a waveform during TTS by generating frequency-like data
    let frame = 0
    const simulateWaveform = () => {
      const data = new Uint8Array(BAR_COUNT)
      for (let i = 0; i < BAR_COUNT; i++) {
        const t = frame * 0.05
        const freq = Math.sin(i * 0.3 + t) * 0.3 + Math.sin(i * 0.1 + t * 1.5) * 0.2
        const envelope = Math.sin(frame * 0.02) * 0.15 + 0.5
        data[i] = Math.max(0, Math.min(255, Math.floor((freq * envelope + 0.5) * 255)))
      }
      drawWaveform(data)
      frame++
      animRef.current = requestAnimationFrame(simulateWaveform)
    }
    simulateWaveform()

    const u = new SpeechSynthesisUtterance(word.word)
    u.lang = 'en-US'
    u.rate = 0.7
    u.onend = () => {
      cancelAnimationFrame(animRef.current)
      drawWaveform(new Uint8Array(BAR_COUNT), ORANGE)
      setPhase('idle')
    }
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  }, [word, drawWaveform])

  // ── Record ──
  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      sourceRef.current = source
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      analyserRef.current = analyser

      setPhase('recording')
      setRecordingDuration(0)

      const canvas = canvasRef.current
      if (canvas) {
        const dpr = window.devicePixelRatio || 1
        const w = canvas.width / dpr
        const h = canvas.height / dpr
        canvas.width = w * dpr
        canvas.height = h * dpr
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const animate = () => {
        analyser.getByteFrequencyData(dataArray)
        drawWaveform(dataArray)
        animRef.current = requestAnimationFrame(animate)
      }
      animate()

      let elapsed = 0
      durationTimerRef.current = setInterval(() => { elapsed++; setRecordingDuration(elapsed) }, 1000)

      // SpeechRecognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const rec = new SpeechRecognition()
        rec.lang = 'en-US'
        rec.continuous = true
        rec.interimResults = true
        rec.maxAlternatives = 5
        recognitionRef.current = rec

        rec.onresult = (event: any) => {
          const last = event.results[event.results.length - 1]
          if (last.isFinal) {
            setTranscript(last[0].transcript.trim().toLowerCase())
            setConfidence(last[0].confidence)
          }
        }
        rec.start()
      }
    } catch {
      setPhase('idle')
    }
  }, [drawWaveform])

  const handleStopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    cancelAnimationFrame(animRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    setPhase('result')
  }, [])

  // ── Cleanup on unmount / word change ──
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current)
      speechSynthesis.cancel()
      if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()) }
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [index])

  const handleNext = useCallback(() => {
    if (history[index]) {
      // Already answered – just advance
    }
    if (index < words.length - 1) setIndex((i) => i + 1)
    else onBack() // finished all words
    setPhase('idle')
    setTranscript('')
    setConfidence(0)
    setRecordingDuration(0)
  }, [index, words.length, onBack, history])

  const handlePrev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1)
    setPhase('idle')
    setTranscript('')
    setConfidence(0)
    setRecordingDuration(0)
  }, [index])

  const handleRetry = useCallback(() => {
    setPhase('idle')
    setTranscript('')
    setConfidence(0)
    setRecordingDuration(0)
  }, [])

  const handleTakeResult = useCallback(() => {
    setHistory((prev) => ({
      ...prev,
      [index]: { transcript, confidence },
    }))
    setPhase('idle')
    if (index < words.length - 1) setIndex((i) => i + 1)
    else onBack()
  }, [index, transcript, confidence, words.length, onBack])

  const exactMatch = transcript.toLowerCase() === word.word.toLowerCase()
  const partialMatch = !exactMatch && transcript && (
    transcript.includes(word.word.toLowerCase()) ||
    word.word.toLowerCase().includes(transcript)
  )

  const completedCount = Object.keys(history).length
  const allDone = completedCount >= words.length

  // ── Canvas sizing ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [index])

  // ── Static idle waveform ──
  useEffect(() => {
    if (phase === 'idle') {
      const data = new Uint8Array(BAR_COUNT)
      for (let i = 0; i < BAR_COUNT; i++) {
        data[i] = Math.floor(Math.random() * 8 + 2)
      }
      drawWaveform(data, 'rgba(168, 162, 158, 0.15)')
    }
  }, [phase, index, drawWaveform])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0806] select-none" style={{ userSelect: 'none' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between border-b border-stone-800/40 px-4 py-3 sm:px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-stone-700/30 bg-stone-800/20 px-2.5 py-1.5 text-xs font-semibold text-stone-400 transition-colors hover:border-stone-600/50 hover:text-stone-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {words.slice(0, Math.min(words.length, 15)).map((w, i) => {
            const done = history[i] !== undefined
            const active = i === index
            return (
              <button
                key={w.id}
                onClick={() => { if (!active) { setIndex(i); setPhase('idle'); setTranscript(''); setConfidence(0) } }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  active
                    ? 'w-6 bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.4)]'
                    : done
                      ? 'w-2 bg-emerald-500/60'
                      : 'w-2 bg-stone-700/50 hover:bg-stone-600/50'
                }`}
              />
            )
          })}
          {words.length > 15 && (
            <span className="text-[10px] text-stone-600 ml-1">
              +{words.length - 15}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <Ear className="h-3 w-3" />
          {completedCount}/{words.length}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg mx-auto text-center space-y-10">

          {/* Word display */}
          <div className="space-y-2">
            <p
              className="text-5xl sm:text-6xl font-bold tracking-tight text-[#F5F5F0]"
              style={{ fontFamily: "'Fraunces', 'Georgia', serif", fontVariationSettings: '"wght" 700, "opsz" 72' }}
            >
              {word.word}
            </p>
            {word.pronunciation && (
              <p
                className="text-sm tracking-wide text-stone-500"
                style={{ fontFamily: "'JetBrains Mono', 'Menlo', monospace" }}
              >
                {word.pronunciation}
              </p>
            )}
            <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
              {word.meaning}
            </p>
          </div>

          {/* Waveform */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="w-full max-w-md h-24 rounded-xl"
              style={{ background: 'transparent' }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {phase === 'idle' && (
              <>
                <button
                  onClick={handleListen}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-stone-700/50 bg-stone-800/30 text-stone-400 transition-all hover:border-orange-500/40 hover:text-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] active:scale-95"
                  title="Listen to pronunciation"
                >
                  <Volume2 className="h-6 w-6" />
                </button>
                <button
                  onClick={handleStartRecording}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:scale-105 active:scale-95"
                  title="Record your voice"
                >
                  <Mic className="h-7 w-7" />
                </button>
              </>
            )}

            {phase === 'listening' && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-orange-500/40 bg-orange-500/10">
                  <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
                </div>
                <p className="text-xs text-stone-500 animate-pulse">Listening...</p>
              </div>
            )}

            {phase === 'recording' && (
              <>
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleStopRecording}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25 transition-all hover:shadow-rose-500/40 hover:scale-105 active:scale-95 animate-pulse"
                    title="Stop recording"
                  >
                    <Square className="h-6 w-6 fill-white" />
                  </button>
                  <span className="text-[10px] tabular-nums text-rose-400">{recordingDuration}s</span>
                </div>
              </>
            )}

            {phase === 'result' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRetry}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-700/50 bg-stone-800/30 text-stone-400 transition-all hover:border-stone-600/50 hover:text-stone-200 active:scale-95"
                  title="Try again"
                >
                  <Repeat className="h-5 w-5" />
                </button>
                <button
                  onClick={handleListen}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-700/50 bg-stone-800/30 text-stone-400 transition-all hover:border-orange-500/40 hover:text-orange-400 active:scale-95"
                  title="Listen again"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Feedback */}
          {phase === 'result' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                exactMatch
                  ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                  : partialMatch
                    ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20'
              }`}>
                {exactMatch ? (
                  <><CheckCircle2 className="h-4 w-4" /> Perfect!</>
                ) : partialMatch ? (
                  <><CheckCircle2 className="h-4 w-4" /> Close!</>
                ) : (
                  <><XCircle className="h-4 w-4" /> Needs practice</>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-center gap-6 text-xs">
                  <div className="text-center">
                    <p className="text-stone-600 mb-0.5">Expected</p>
                    <p className="font-semibold text-stone-300" style={{ fontFamily: "'Fraunces', 'Georgia', serif" }}>
                      {word.word}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-stone-600 mb-0.5">Heard</p>
                    <p className={`font-semibold ${exactMatch ? 'text-emerald-400' : 'text-stone-400'}`}>
                      {transcript || '(no speech detected)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <div className="h-1.5 w-32 rounded-full bg-stone-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        exactMatch ? 'bg-emerald-500' : confidence > 0.5 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.round(confidence * 100)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold tabular-nums ${
                    exactMatch ? 'text-emerald-400' : 'text-stone-500'
                  }`}>
                    {formatConfidence(confidence)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleTakeResult}
                className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition-all active:scale-95 ${
                  exactMatch
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-emerald-500/20'
                    : 'bg-gradient-to-r from-stone-700 to-stone-600 hover:shadow-stone-500/20'
                }`}
              >
                {isLast ? 'Finish' : 'Continue'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Action hint */}
          {phase === 'idle' && (
            <p className="text-xs text-stone-600">
              Listen then record yourself saying the word
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div className="flex items-center justify-between border-t border-stone-800/40 px-4 py-3 sm:px-6">
        <button
          onClick={isFirst ? onBack : handlePrev}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 transition-all hover:text-stone-300"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {isFirst ? 'Exit' : 'Previous'}
        </button>

        <div className="text-[10px] text-stone-600 tabular-nums">
          {index + 1} / {words.length}
        </div>

        <button
          onClick={handleNext}
          disabled={phase !== 'idle'}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 transition-all hover:text-stone-300 disabled:opacity-30"
        >
          {isLast ? 'Done' : 'Skip'}
          {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}
