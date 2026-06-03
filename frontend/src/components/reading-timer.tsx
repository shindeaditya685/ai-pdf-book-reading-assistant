'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Timer, Coffee, Settings } from 'lucide-react'
import { usePDFStore } from '@/store/use-pdf-store'
import { motion, AnimatePresence } from 'framer-motion'

type Phase = 'focus' | 'break'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

export function ReadingTimer() {
  const { pdfDataUrl, focusMode, toggleFocusMode } = usePDFStore()

  const [phase, setPhase] = useState<Phase>('focus')
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [remaining, setRemaining] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [justFinished, setJustFinished] = useState(false)

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const stopTimer = useCallback(() => {
    clearTimer()
    setRunning(false)
  }, [clearTimer])

  const startTimer = useCallback(() => {
    if (remaining <= 0) return
    clearTimer()
    setJustFinished(false)
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer()
          setRunning(false)
          setJustFinished(true)
          playBeep()
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Reading Timer', {
              body: phase === 'focus' ? 'Focus session complete! Time for a break.' : 'Break over! Ready to read again.',
              icon: '/favicon.ico',
            })
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    setRunning(true)
  }, [clearTimer, phase, remaining])

  const handleStartPause = useCallback(() => {
    if (running) {
      stopTimer()
    } else if (remaining <= 0) {
      const minutes = phase === 'focus' ? focusMinutes : breakMinutes
      setRemaining(minutes * 60)
      setJustFinished(false)
    } else {
      startTimer()
    }
  }, [running, remaining, phase, focusMinutes, breakMinutes, startTimer, stopTimer])

  const handleReset = useCallback(() => {
    stopTimer()
    const minutes = phase === 'focus' ? focusMinutes : breakMinutes
    setRemaining(minutes * 60)
    setJustFinished(false)
  }, [phase, focusMinutes, breakMinutes, stopTimer])

  const handlePhaseToggle = useCallback(() => {
    stopTimer()
    const next = phase === 'focus' ? 'break' : 'focus'
    setPhase(next)
    const minutes = next === 'focus' ? focusMinutes : breakMinutes
    setRemaining(minutes * 60)
    setJustFinished(false)
    if (next === 'focus') {
      setSessionCount((c) => c + 1)
    }
  }, [phase, focusMinutes, breakMinutes, stopTimer])

  const applySettings = useCallback(() => {
    if (focusMinutes < 1) setFocusMinutes(1)
    if (breakMinutes < 1) setBreakMinutes(1)
    stopTimer()
    const minutes = phase === 'focus' ? focusMinutes : breakMinutes
    setRemaining(Math.max(minutes, 1) * 60)
    setShowSettings(false)
    setJustFinished(false)
  }, [focusMinutes, breakMinutes, phase, stopTimer])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  if (!pdfDataUrl) return null

  const isFocus = phase === 'focus'
  const totalSeconds = isFocus ? focusMinutes * 60 : breakMinutes * 60
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0
  const accentColor = isFocus ? 'emerald' : 'amber'

  const displayMinutes = Math.floor(remaining / 60)
  const displaySeconds = remaining % 60
  const minuteTens = Math.floor(displayMinutes / 10)
  const minuteOnes = displayMinutes % 10
  const secondTens = Math.floor(displaySeconds / 10)
  const secondOnes = displaySeconds % 10

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <AnimatePresence>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, x: -12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.92, x: -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="rounded-2xl border border-border/70 bg-background/95 p-4 shadow-2xl backdrop-blur-md w-56"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${isFocus ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                  {isFocus ? (
                    <Timer className={`h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400`} />
                  ) : (
                    <Coffee className={`h-3.5 w-3.5 text-amber-600 dark:text-amber-400`} />
                  )}
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider ${isFocus ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {isFocus ? 'Focus' : 'Break'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`flex items-center justify-center h-6 w-6 rounded-lg transition-all ${
                    showSettings ? 'bg-muted text-foreground' : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}
                  title="Timer settings"
                >
                  <Settings className="h-3 w-3" />
                </button>
                <button
                  onClick={handlePhaseToggle}
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-colors ${
                    isFocus
                      ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/20'
                      : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20'
                  }`}
                  title={isFocus ? 'Switch to break' : 'Switch to focus'}
                >
                  {isFocus ? 'Break' : 'Focus'}
                </button>
              </div>
            </div>

            {/* Settings panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="mb-3 rounded-xl border border-border/60 bg-muted/40 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                          Focus (min)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={focusMinutes}
                          onChange={(e) => setFocusMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                          Break (min)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={breakMinutes}
                          onChange={(e) => setBreakMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                    <button
                      onClick={applySettings}
                      className="mt-2 w-full rounded-lg bg-foreground/10 py-1 text-[10px] font-semibold text-foreground hover:bg-foreground/20 transition-colors active:scale-[0.98]"
                    >
                      Apply
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Timer display */}
            <div className="text-center">
              <div className={`flex items-center justify-center gap-0.5 ${justFinished ? 'animate-bounce' : ''}`}>
                <div className={`flex items-center gap-0.5 rounded-xl px-2 py-1 ${justFinished ? (isFocus ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30') : ''}`}>
                  <span className={`text-4xl font-bold tracking-tight tabular-nums ${
                    running ? 'text-foreground' : justFinished ? (isFocus ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400') : 'text-muted-foreground/80'
                  }`}>
                    {minuteTens}
                  </span>
                  <span className={`text-4xl font-bold tracking-tight tabular-nums ${
                    running ? 'text-foreground' : justFinished ? (isFocus ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400') : 'text-muted-foreground/80'
                  }`}>
                    {minuteOnes}
                  </span>
                  <span className={`text-4xl font-bold tabular-nums mx-0.5 ${running ? 'text-foreground animate-pulse' : 'text-muted-foreground/40'}`}>
                    :
                  </span>
                  <span className={`text-4xl font-bold tracking-tight tabular-nums ${
                    running ? 'text-foreground' : justFinished ? (isFocus ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400') : 'text-muted-foreground/80'
                  }`}>
                    {secondTens}
                  </span>
                  <span className={`text-4xl font-bold tracking-tight tabular-nums ${
                    running ? 'text-foreground' : justFinished ? (isFocus ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400') : 'text-muted-foreground/80'
                  }`}>
                    {secondOnes}
                  </span>
                </div>
              </div>

              {justFinished && (
                <p className={`mt-1.5 text-xs font-semibold ${isFocus ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {isFocus ? 'Time for a break!' : 'Ready to focus!'}
                </p>
              )}

              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={`h-full rounded-full ${isFocus ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  animate={{ width: `${Math.min(100, progress * 100)}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 flex items-center justify-center gap-2.5">
              <button
                onClick={handleStartPause}
                className={`flex items-center justify-center h-9 w-9 rounded-xl transition-all active:scale-90 hover:scale-105 ${
                  running
                    ? 'bg-amber-100 text-amber-700 shadow-sm hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                    : remaining <= 0
                      ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
                      : 'bg-emerald-100 text-emerald-700 shadow-sm hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}
                title={running ? 'Pause' : remaining <= 0 ? 'Restart' : 'Start'}
              >
                {running ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={handleReset}
                className="flex items-center justify-center h-8 w-8 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all active:scale-90"
                title="Reset"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={toggleFocusMode}
                className={`flex items-center justify-center h-8 w-8 rounded-xl transition-all active:scale-90 ${
                  focusMode
                    ? 'bg-violet-100 text-violet-700 shadow-sm dark:bg-violet-900/30 dark:text-violet-400'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
                title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
              >
                <Timer className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setExpanded(false)}
                className="flex items-center justify-center h-8 w-8 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all active:scale-90"
                title="Collapse"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Session count */}
            {sessionCount > 0 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(sessionCount, 8) }).map((_, i) => (
                    <div key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
                  ))}
                  {sessionCount > 8 && (
                    <span className="text-[9px] font-semibold text-muted-foreground/60 ml-1">
                      +{sessionCount - 8}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-medium text-muted-foreground/50">
                  {sessionCount} session{sessionCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            onClick={() => setExpanded(true)}
            className={`flex items-center justify-center h-10 w-10 rounded-full border-2 shadow-lg transition-all hover:scale-110 active:scale-95 ${
              running
                ? 'border-emerald-400 bg-emerald-500 text-white shadow-emerald-500/20'
                : justFinished
                  ? `border-${accentColor}-400 bg-${accentColor}-500 text-white animate-bounce`
                  : 'border-border/70 bg-background/95 text-muted-foreground backdrop-blur-md'
            }`}
            title="Open reading timer"
          >
            {running ? (
              <span className="text-[11px] font-bold tabular-nums">{formatTime(remaining)}</span>
            ) : (
              <Timer className="h-4 w-4" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
