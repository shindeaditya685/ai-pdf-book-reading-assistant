'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const FALLBACK_COLOR = '#3B82F6'

/** Pick a readable ink color for a colored fill by measuring relative luminance. */
function contrastText(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return '#ffffff'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 150 ? '#1c1917' : '#ffffff'
}

export function MemberAvatar({
  name,
  color,
  size = 24,
  ring = false,
  className,
}: {
  name: string
  color?: string
  size?: number
  ring?: boolean
  className?: string
}) {
  const bg = color || FALLBACK_COLOR
  return (
    <div
      title={name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        ring && 'ring-2 ring-background',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: contrastText(bg),
        fontSize: Math.max(9, Math.round(size * 0.42)),
      }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

/** Muted, uppercase eyebrow used to label a group of controls or a list. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  )
}

/** Dashed-border empty state that invites the reader to act. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

/** Mono count chip used in panel headers and tab bars. */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand tabular-nums">
      {count}
    </span>
  )
}

/** Segmented pill control (e.g. My Words / From the circle, Due / All). */
export function PillTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: ReactNode; count?: number }[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex gap-0.5 rounded-xl bg-muted/50 p-0.5', className)}>
      {tabs.map((t) => {
        const active = value === t.value
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="truncate">{t.label}</span>
            {t.count !== undefined && (
              <span className={cn('tabular-nums', active ? 'text-brand' : 'text-muted-foreground/60')}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Small colored stat used on the flashcards review recap. */
export function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={cn('rounded-lg px-2 py-1.5 text-center', color)}>
      <p className="text-xs font-bold">{count}</p>
      <p className="text-[9px] opacity-70">{label}</p>
    </div>
  )
}
