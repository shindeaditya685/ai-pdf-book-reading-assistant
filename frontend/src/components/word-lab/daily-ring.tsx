'use client'

import { useEffect, useState } from 'react'

export function DailyRing({
  studied,
  total = 10,
  size = 56,
  strokeWidth = 4,
  glow = false,
}: {
  studied: number
  total?: number
  size?: number
  strokeWidth?: number
  glow?: boolean
}) {
  const [animatedStudied, setAnimatedStudied] = useState(0)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedStudied(studied), 100)
    return () => clearTimeout(timer)
  }, [studied])

  useEffect(() => {
    if (studied === total && studied > 0) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 2000)
      return () => clearTimeout(t)
    }
  }, [studied, total])

  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - animatedStudied / total)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={pulse || glow ? 'drop-shadow-[0_0_8px_var(--brand)]' : ''}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/50"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-brand transition-all duration-700 ease-out"
        style={{ rotate: '-90deg', transformOrigin: 'center' }}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className={`fill-current text-xs font-bold transition-all duration-700 ${
          studied === total ? 'text-brand' : 'text-muted-foreground'
        }`}
      >
        {studied}/{total}
      </text>
    </svg>
  )
}
