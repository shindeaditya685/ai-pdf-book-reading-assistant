'use client'

export function BandScoreRing({ score, target = 7 }: { score: number | null; target?: number }) {
  const radius = 72
  const stroke = 10
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI

  const bandColor = (band: number) => {
    if (band <= 4) return '#e11d48'
    if (band <= 6) return '#d97706'
    return '#d4a017'
  }

  const currentScore = score ?? 0
  const strokeDashoffset = circumference - (currentScore / 9) * circumference

  if (score === null) {
    return (
      <div className="flex flex-col items-center">
        <svg width={radius * 2} height={radius * 2} className="drop-shadow-lg">
          <circle cx={radius} cy={radius} r={normalizedRadius} fill="none" stroke="#e5e1da" strokeWidth={stroke} />
        </svg>
        <div className="absolute flex flex-col items-center justify-center" style={{ width: radius * 2, height: radius * 2 }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Band</span>
          <span className="text-3xl font-serif font-bold text-stone-300">—</span>
        </div>
        <p className="mt-4 text-xs text-stone-400 text-center max-w-[200px] leading-relaxed">
          Complete a practice to see your estimated band score
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center">
      <svg width={radius * 2} height={radius * 2} className="drop-shadow-lg">
        <circle cx={radius} cy={radius} r={normalizedRadius} fill="none" stroke="#e5e1da" strokeWidth={stroke} />
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          stroke={bandColor(Math.round(currentScore))}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${radius} ${radius})`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Band</span>
        <span className="text-4xl font-serif font-black tracking-tight text-stone-900 dark:text-white">{currentScore.toFixed(1)}</span>
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-stone-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          1–4
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          5–6
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          7–9
        </span>
        <span className="ml-2 text-stone-300 dark:text-stone-600">
          Target: <span className="font-semibold text-stone-500 dark:text-stone-400">{target}.0</span>
        </span>
      </div>
    </div>
  )
}
