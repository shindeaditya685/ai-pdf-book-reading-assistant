'use client'

import {
  Globe,
  Settings2,
  Bookmark,
  Clock,
  Timer,
  Brain,
  List,
  Palette,
  Sun,
  Moon,
  Check,
  Ruler,
  Focus,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { usePDFStore, LANGUAGE_LABELS, ACCENT_LABELS, type TranslationLanguage, type PronunciationAccent } from '@/store/use-pdf-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import type { ReactNode } from 'react'

/* Exact shade values match the --brand of each accent class in globals.css.
   They are hard-coded (not bg-emerald-500 etc.) so the swatches are accurate
   even while the applied accent overrides Tailwind's emerald/violet scales. */
const ACCENTS = [
  { value: 'emerald' as const, name: 'Emerald', hex: '#10b981' },
  { value: 'violet' as const, name: 'Violet', hex: '#8b5cf6' },
  { value: 'amber' as const, name: 'Amber', hex: '#f59e0b' },
  { value: 'rose' as const, name: 'Rose', hex: '#f43f5e' },
  { value: 'blue' as const, name: 'Blue', hex: '#3b82f6' },
  { value: 'purple' as const, name: 'Purple', hex: '#a855f7' },
  { value: 'cyan' as const, name: 'Cyan', hex: '#06b6d4' },
  { value: 'orange' as const, name: 'Orange', hex: '#f97316' },
  { value: 'pink' as const, name: 'Pink', hex: '#ec4899' },
]

const READER_AID_COLORS = [
  '#000000',
  '#ffffff',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#3b82f6',
  '#06b6d4',
  '#ec4899',
  '#facc15',
]

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  )
}

function Toggle({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-in-out',
        on ? 'bg-brand' : 'bg-muted-foreground/25',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out',
          on && 'translate-x-4'
        )}
      />
    </button>
  )
}

function SwitchRow({
  icon,
  label,
  hint,
  on,
  onChange,
  disabled,
}: {
  icon?: ReactNode
  label: string
  hint?: string
  on: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5 transition-colors',
        !disabled && 'hover:bg-background'
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="shrink-0 text-muted-foreground/70">{icon}</span>}
        <div className="min-w-0">
          <span className="block text-xs font-medium text-foreground">{label}</span>
          {hint && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/70">{hint}</span>}
        </div>
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} label={label} />
    </div>
  )
}

export function SettingsPanel() {
  const {
    translationLanguage,
    setTranslationLanguage,
    accent,
    setAccent,
    theme,
    toggleTheme,
    themeAccent,
    setThemeAccent,
    autoFlashcard,
    setAutoFlashcard,
    autoAddToList,
    setAutoAddToList,
    defaultListId,
    showReadingTimer,
    setShowReadingTimer,
    readerAidMode,
    setReaderAidMode,
    readerAidHeight,
    setReaderAidHeight,
    readerAidColor,
    setReaderAidColor,
    readerAidOpacity,
    setReaderAidOpacity,
  } = usePDFStore()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Settings"
          className="h-8 w-8 rounded-xl border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:text-foreground hover:shadow-md sm:h-9 sm:w-9"
          title="Settings"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="panel-scrollbar max-h-[min(70vh,32rem)] w-80 overflow-y-auto rounded-2xl border-border/50 bg-background/80 p-4 shadow-2xl backdrop-blur-xl focus-visible:outline-none overscroll-contain"
      >
        <div className="space-y-5">
          {/* Header */}
          <header className="px-0.5">
            <p className="mb-1 block h-2 w-8 rounded-full bg-brand" />
            <h2 className="font-serif text-lg font-semibold leading-tight tracking-tight text-foreground">
              Your reading room
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tune the voice, the timer, and how your saved words behave.
            </p>
          </header>

          {/* Language */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-border/30 pb-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
              <SectionLabel>Language</SectionLabel>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-muted-foreground/80">
                Translation language
              </label>
              <Select
                value={translationLanguage}
                onValueChange={(val) => setTranslationLanguage(val as TranslationLanguage)}
              >
                <SelectTrigger className="h-8 w-full rounded-lg border-border/60 bg-background/50 text-xs transition-colors hover:bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-muted-foreground/80">
                Pronunciation accent
              </label>
              <Select value={accent} onValueChange={(val) => setAccent(val as PronunciationAccent)}>
                <SelectTrigger className="h-8 w-full rounded-lg border-border/60 bg-background/50 text-xs transition-colors hover:bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCENT_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reading aid */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-border/30 pb-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
              <SectionLabel>Reading</SectionLabel>
            </div>
            <SwitchRow
              icon={<Timer className="h-3.5 w-3.5" />}
              label="Reading timer"
              on={showReadingTimer}
              onChange={() => setShowReadingTimer(!showReadingTimer)}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="shrink-0 text-muted-foreground/70">
                    <Ruler className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">Reading aid</span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/70">
                      Follows your cursor while you read
                    </span>
                  </div>
                </div>
              </div>

              {/* Mode: off / line / focus */}
              <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/60 p-1">
                {(['off', 'line', 'focus'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setReaderAidMode(m)}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold capitalize transition-colors',
                      readerAidMode === m
                        ? 'bg-brand-soft text-brand'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m === 'focus' ? <Focus className="h-3.5 w-3.5" /> : null}
                    {m === 'line' ? <Ruler className="h-3.5 w-3.5" /> : null}
                    {m}
                  </button>
                ))}
              </div>

              {readerAidMode !== 'off' && (
                <div className="space-y-2.5 rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-foreground">Height</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={readerAidHeight}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10)
                          if (Number.isFinite(v) && v >= 1 && v <= 200) setReaderAidHeight(v)
                        }}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10)
                          setReaderAidHeight(Number.isFinite(v) ? v : 2)
                        }}
                        className="h-8 w-16 rounded-lg border border-border/60 bg-background/50 px-2 text-right font-mono text-xs text-foreground focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/15"
                        aria-label="Reading aid height in pixels"
                      />
                      <span className="font-mono text-[10px] text-muted-foreground/70">px</span>
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <span className="mb-1.5 block text-[10px] font-medium text-muted-foreground/80">Colour</span>
                    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Reading aid colour">
                      {READER_AID_COLORS.map((hex) => {
                        const isSelected = readerAidColor === hex
                        return (
                          <button
                            key={hex}
                            type="button"
                            aria-pressed={isSelected}
                            title={hex}
                            aria-label={`Reading aid colour ${hex}`}
                            onClick={() => setReaderAidColor(hex)}
                            style={{
                              backgroundColor: hex,
                              boxShadow: isSelected
                                ? `0 0 0 2px var(--popover), 0 0 0 4px ${hex}`
                                : `inset 0 0 0 1px rgba(128,128,128,0.4)`,
                            }}
                            className={cn(
                              'relative flex h-7 items-center justify-center rounded-lg transition-transform duration-150 ease-out hover:scale-110 motion-reduce:transition-none',
                              !isSelected && 'opacity-85 hover:opacity-100'
                            )}
                          >
                            {isSelected && (
                              <Check
                                className="h-3 w-3 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                                style={{ color: hex === '#ffffff' ? '#000000' : '#ffffff' }}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Opacity */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground/80">Opacity</span>
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground/70">
                        {Math.round(readerAidOpacity * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[readerAidOpacity]}
                      min={0.05}
                      max={1}
                      step={0.05}
                      onValueChange={([v]) => setReaderAidOpacity(v)}
                      className="[&_[data-slot=slider-range]]:bg-brand"
                      aria-label="Reading aid opacity"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* When you save a word */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-border/30 pb-1.5">
              <Bookmark className="h-3.5 w-3.5 text-muted-foreground/70" />
              <SectionLabel>Vocabulary</SectionLabel>
            </div>
            <div className="space-y-2">
              <SwitchRow
                icon={<Brain />}
                label="Auto-create a flashcard"
                on={autoFlashcard}
                onChange={() => setAutoFlashcard(!autoFlashcard)}
              />
              <SwitchRow
                icon={<List />}
                label="Add to the default list"
                hint={!defaultListId ? 'Star a list under Word lists to switch on' : undefined}
                on={autoAddToList && !!defaultListId}
                onChange={() => setAutoAddToList(!autoAddToList)}
                disabled={!defaultListId}
              />
            </div>
          </div>

          {/* Look */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-border/30 pb-1.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground/70" />
              <SectionLabel>Look</SectionLabel>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-1 py-1">
              <button
                onClick={() => theme !== 'light' && toggleTheme()}
                className={cn(
                  'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
                  theme === 'light' ? 'bg-brand-soft text-brand' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Sun className="h-3.5 w-3.5" />
                Light
              </button>
              <button
                onClick={() => theme !== 'dark' && toggleTheme()}
                className={cn(
                  'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
                  theme === 'dark' ? 'bg-brand-soft text-brand' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Moon className="h-3.5 w-3.5" />
                Dark
              </button>
            </div>

            {/* Accent — the signature "shelf of inks" */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground/80">Highlight shade</span>
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground/70">
                  {ACCENTS.find((a) => a.value === themeAccent)?.name}
                </span>
              </div>
              <div className="grid grid-cols-9 gap-1.5" role="group" aria-label="Highlight shade">
                {ACCENTS.map((opt) => {
                  const isSelected = themeAccent === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={isSelected}
                      title={opt.name}
                      aria-label={opt.name}
                      onClick={() => setThemeAccent(opt.value)}
                      style={{
                        backgroundColor: opt.hex,
                        boxShadow: isSelected
                          ? `0 0 0 2px var(--popover), 0 0 0 4px ${opt.hex}`
                          : undefined,
                      }}
                      className={cn(
                        'relative flex h-9 items-center justify-center rounded-[10px] transition-transform duration-150 ease-out hover:scale-110 motion-reduce:transition-none',
                        !isSelected && 'opacity-85 saturate-[0.9] hover:opacity-100 hover:saturate-100'
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}