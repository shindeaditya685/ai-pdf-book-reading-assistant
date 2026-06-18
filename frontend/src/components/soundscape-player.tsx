'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Headphones, HeadphoneOff, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Soundscape = 'rain' | 'fireplace' | 'coffee' | 'library' | null

const SOUNDSCAPES: { key: Soundscape; label: string; icon: string }[] = [
  { key: 'rain', label: 'Rain', icon: '\u2614' },
  { key: 'fireplace', label: 'Fireplace', icon: '\uD83D\uDD25' },
  { key: 'coffee', label: 'Cafe', icon: '\u2615' },
  { key: 'library', label: 'Library', icon: '\uD83D\uDCDA' },
]

function whiteNoiseBuffer(ctx: AudioContext, duration: number) {
  const len = ctx.sampleRate * duration
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

export function SoundscapePlayer() {
  const [active, setActive] = useState<Soundscape>(null)
  const [volume, setVolume] = useState(0.3)
  const [open, setOpen] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<AudioNode[]>([])
  const timersRef = useRef<number[]>([])
  const gainRef = useRef<GainNode | null>(null)

  const cleanup = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    nodesRef.current.forEach((n) => { try { n.disconnect() } catch {} })
    nodesRef.current = []
    if (ctxRef.current?.state !== 'closed') ctxRef.current?.suspend()
  }, [])

  // ── Rain ──
  const startRain = useCallback((ctx: AudioContext, dest: GainNode) => {
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = whiteNoiseBuffer(ctx, 4)
    noiseSrc.loop = true

    const shaping = ctx.createGain()
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.4
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.2
    lfo.connect(lfoGain)
    lfoGain.connect(shaping.gain)

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 200

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1200
    bp.Q.value = 0.5

    noiseSrc.connect(hp)
    hp.connect(bp)
    bp.connect(shaping)
    shaping.connect(dest)

    lfo.start()
    noiseSrc.start()
    nodesRef.current.push(noiseSrc, lfo, lfoGain, hp, bp, shaping)

    // secondary heavier drops
    const dropInterval = setInterval(() => {
      if (ctx.state === 'closed') { clearInterval(dropInterval); return }
      const drop = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
      drop.buffer = buf
      const dGain = ctx.createGain()
      dGain.gain.value = 0.12
      const dLp = ctx.createBiquadFilter()
      dLp.type = 'lowpass'
      dLp.frequency.value = 2500
      drop.connect(dLp)
      dLp.connect(dGain)
      dGain.connect(dest)
      drop.start()
      nodesRef.current.push(drop, dGain, dLp)
    }, 300 + Math.random() * 600)
    timersRef.current.push(dropInterval as any)
  }, [])

  // ── Fireplace ──
  const startFireplace = useCallback((ctx: AudioContext, dest: GainNode) => {
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = whiteNoiseBuffer(ctx, 4)
    noiseSrc.loop = true

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 250

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 30

    const shaping = ctx.createGain()
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.8
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.35
    lfo.connect(lfoG)
    lfoG.connect(shaping.gain)

    noiseSrc.connect(lp)
    lp.connect(hp)
    hp.connect(shaping)
    shaping.connect(dest)
    lfo.start()
    noiseSrc.start()
    nodesRef.current.push(noiseSrc, lfo, lfoG, lp, hp, shaping)

    // crackle pops (sharp, high-freq bursts)
    const pop = () => {
      if (ctx.state === 'closed') return
      const popSrc = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) {
        const env = Math.exp(-i / (ctx.sampleRate * 0.008))
        d[i] = (Math.random() * 2 - 1) * env
      }
      popSrc.buffer = buf
      const pGain = ctx.createGain()
      pGain.gain.value = 0.15 + Math.random() * 0.15
      const pLp = ctx.createBiquadFilter()
      pLp.type = 'lowpass'
      pLp.frequency.value = 3000
      popSrc.connect(pLp)
      pLp.connect(pGain)
      pGain.connect(dest)
      popSrc.start()
      nodesRef.current.push(popSrc, pGain, pLp)
      timersRef.current.push(window.setTimeout(pop, 1500 + Math.random() * 4000))
    }
    pop()
  }, [])

  // ── Coffee shop ──
  const startCoffee = useCallback((ctx: AudioContext, dest: GainNode) => {
    // ambient rumble (fridge / AC)
    const hum = ctx.createOscillator()
    hum.type = 'sine'
    hum.frequency.value = 55
    const humGain = ctx.createGain()
    humGain.gain.value = 0.04
    hum.connect(humGain)
    humGain.connect(dest)
    hum.start()
    nodesRef.current.push(hum, humGain)

    // filtered noise (muffled chatter)
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = whiteNoiseBuffer(ctx, 4)
    noiseSrc.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900
    bp.Q.value = 0.6
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    const shaping = ctx.createGain()
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.3
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.3
    lfo.connect(lfoG)
    lfoG.connect(shaping.gain)

    noiseSrc.connect(bp)
    bp.connect(lp)
    lp.connect(shaping)
    shaping.connect(dest)
    lfo.start()
    noiseSrc.start()
    nodesRef.current.push(noiseSrc, lfo, lfoG, bp, lp, shaping)

    // occasional cup clink
    const clink = () => {
      if (ctx.state === 'closed') return
      const src = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) {
        const t = i / ctx.sampleRate
        d[i] = Math.sin(t * 4500) * Math.exp(-t * 40) * 0.3 +
               Math.sin(t * 7800) * Math.exp(-t * 60) * 0.15
      }
      src.buffer = buf
      const cGain = ctx.createGain()
      cGain.gain.value = 0.06
      src.connect(cGain)
      cGain.connect(dest)
      src.start()
      nodesRef.current.push(src, cGain)
      timersRef.current.push(window.setTimeout(clink, 8000 + Math.random() * 15000))
    }
    clink()
  }, [])

  // ── Library ──
  const startLibrary = useCallback((ctx: AudioContext, dest: GainNode) => {
    // extremely faint ambient
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = whiteNoiseBuffer(ctx, 4)
    noiseSrc.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 150
    const nGain = ctx.createGain()
    nGain.gain.value = 0.06
    noiseSrc.connect(lp)
    lp.connect(nGain)
    nGain.connect(dest)
    noiseSrc.start()
    nodesRef.current.push(noiseSrc, lp, nGain)

    // occasional page rustle (sparse)
    const rustle = () => {
      if (ctx.state === 'closed') return
      const src = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) {
        const env = Math.sin((i / d.length) * Math.PI)
        d[i] = (Math.random() * 2 - 1) * env * 0.08
      }
      src.buffer = buf
      const rLp = ctx.createBiquadFilter()
      rLp.type = 'lowpass'
      rLp.frequency.value = 1200
      const rGain = ctx.createGain()
      rGain.gain.value = 0.1
      src.connect(rLp)
      rLp.connect(rGain)
      rGain.connect(dest)
      src.start()
      nodesRef.current.push(src, rLp, rGain)
      timersRef.current.push(window.setTimeout(rustle, 12000 + Math.random() * 18000))
    }
    rustle()
  }, [])

  const play = useCallback((type: Soundscape) => {
    cleanup()
    if (!type) return
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const gain = ctx.createGain()
    gain.gain.value = volume
    gain.connect(ctx.destination)
    gainRef.current = gain
    switch (type) {
      case 'rain': startRain(ctx, gain); break
      case 'fireplace': startFireplace(ctx, gain); break
      case 'coffee': startCoffee(ctx, gain); break
      case 'library': startLibrary(ctx, gain); break
    }
  }, [volume, cleanup, startRain, startFireplace, startCoffee, startLibrary])

  const toggle = (type: Soundscape) => {
    if (active === type) { cleanup(); setActive(null); return }
    setActive(type)
    play(type)
  }

  useEffect(() => { if (gainRef.current) gainRef.current.gain.value = volume }, [volume])
  useEffect(() => () => cleanup(), [cleanup])

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 rounded-lg ${active ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
        onClick={() => setOpen(!open)}
        title={active ? `Playing: ${SOUNDSCAPES.find(s => s.key === active)?.label}` : 'Ambient sound'}
        aria-label="Soundscapes"
      >
        {active ? <Headphones className="h-3.5 w-3.5" /> : <HeadphoneOff className="h-3.5 w-3.5" />}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border p-2 shadow-lg"
            style={{ backgroundColor: 'var(--canvas)', borderColor: 'var(--paper-border)' }}
          >
            <p
              className="mb-2 px-2 text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--accent-warm)', fontFamily: 'var(--font-geist-mono)' }}
            >
              Soundscapes
            </p>
            <div className="space-y-0.5">
              {SOUNDSCAPES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => { toggle(s.key); setOpen(false) }}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                    active === s.key ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-muted/50'
                  }`}
                  style={{ color: active === s.key ? '#059669' : 'var(--ink)' }}
                >
                  <span className="text-sm">{s.icon}</span>
                  <span className="font-medium" style={{ fontFamily: 'var(--font-geist-sans)' }}>{s.label}</span>
                  {active === s.key && (
                    <span className="ml-auto flex gap-0.5">
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="inline-block w-0.5 rounded-full bg-emerald-500"
                          style={{
                            height: `${6 + i * 3}px`,
                            animation: `soundWave ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                          }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 border-t px-2 pt-2" style={{ borderColor: 'var(--paper-border)' }}>
              <Volume2 className="h-3 w-3 shrink-0" style={{ color: 'var(--accent-warm)' }} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(90deg, #059669 ${volume * 100}%, var(--paper-border) ${volume * 100}%)`,
                }}
                aria-label="Volume"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
