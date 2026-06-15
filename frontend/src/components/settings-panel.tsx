'use client'

import { Globe, Volume2, Sun, Moon, Settings2, Palette } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePDFStore, LANGUAGE_LABELS, ACCENT_LABELS, type TranslationLanguage, type PronunciationAccent } from '@/store/use-pdf-store'
import { Button } from '@/components/ui/button'

const ACCENT_OPTIONS = [
  { value: 'emerald' as const, label: 'Emerald', className: 'bg-emerald-500' },
  { value: 'violet' as const, label: 'Violet', className: 'bg-violet-500' },
  { value: 'amber' as const, label: 'Amber', className: 'bg-amber-500' },
  { value: 'rose' as const, label: 'Rose', className: 'bg-rose-500' },
  { value: 'blue' as const, label: 'Blue', className: 'bg-blue-500' },
  { value: 'purple' as const, label: 'Purple', className: 'bg-purple-500' },
  { value: 'cyan' as const, label: 'Cyan', className: 'bg-cyan-500' },
  { value: 'orange' as const, label: 'Orange', className: 'bg-orange-500' },
  { value: 'pink' as const, label: 'Pink', className: 'bg-pink-500' },
]

export function SettingsPanel() {
  const { translationLanguage, setTranslationLanguage, accent, setAccent, theme, toggleTheme, themeAccent, setThemeAccent } = usePDFStore()

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
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 rounded-xl border-emerald-500/10 bg-background/95 p-4 shadow-xl shadow-emerald-500/5 backdrop-blur-xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm">
              <Settings2 className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-bold text-foreground">Settings</span>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Translation Language
              </label>
            </div>
            <Select
              value={translationLanguage}
              onValueChange={(val) => setTranslationLanguage(val as TranslationLanguage)}
            >
              <SelectTrigger className="h-8 w-full rounded-lg border-border/60 text-xs">
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

          {/* Accent */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-emerald-500" />
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Pronunciation Accent
              </label>
            </div>
            <Select
              value={accent}
              onValueChange={(val) => setAccent(val as PronunciationAccent)}
            >
              <SelectTrigger className="h-8 w-full rounded-lg border-border/60 text-xs">
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

          {/* Theme accent — color picker */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-emerald-500" />
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Theme Color
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACCENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setThemeAccent(opt.value)}
                  className={`h-7 w-7 rounded-full ${opt.className} transition-all hover:scale-110 hover:shadow-md ${
                    themeAccent === opt.value ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground/30 scale-110' : 'ring-1 ring-border/40'
                  }`}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Theme toggle */}
          <div className="border-t border-border/40 pt-3">
            <button
              onClick={toggleTheme}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-500" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-500" />
                )}
                <span>Appearance</span>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
