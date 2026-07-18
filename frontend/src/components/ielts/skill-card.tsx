'use client'

import type { LucideIcon } from 'lucide-react'

interface SkillCardProps {
  icon: LucideIcon
  label: string
  description: string
  stat: string
  statLabel: string
  color: 'blue' | 'amber' | 'rose' | 'emerald'
  onClick: () => void
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200/60 dark:border-blue-800/30',
    icon: 'bg-blue-600 text-white',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    hover: 'hover:border-blue-300 dark:hover:border-blue-700',
    stat: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200/60 dark:border-amber-800/30',
    icon: 'bg-amber-600 text-white',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    hover: 'hover:border-amber-300 dark:hover:border-amber-700',
    stat: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200/60 dark:border-rose-800/30',
    icon: 'bg-rose-600 text-white',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    hover: 'hover:border-rose-300 dark:hover:border-rose-700',
    stat: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200/60 dark:border-emerald-800/30',
    icon: 'bg-emerald-600 text-white',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    hover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    stat: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
}

export function SkillCard({ icon: Icon, label, description, stat, statLabel, color, onClick }: SkillCardProps) {
  const c = colorMap[color]

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-start rounded-2xl border ${c.border} ${c.bg} ${c.hover} p-5 text-left shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.icon} shadow-sm`}>
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="mt-3 font-serif text-base font-bold tracking-tight text-stone-900 dark:text-white">
        {label}
      </h3>
      <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
        {description}
      </p>

      <div className="mt-auto pt-4 flex items-center gap-2 text-xs">
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
        <span className={c.stat}>
          <strong>{stat}</strong> {statLabel}
        </span>
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-200 transition-all group-hover:translate-x-0.5 dark:text-stone-700">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  )
}
