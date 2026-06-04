'use client'

import { Globe, Volume2, Sun, Moon, Settings2 } from 'lucide-react'
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

export function SettingsPanel() {
  const { translationLanguage, setTranslationLanguage, accent, setAccent, theme, toggleTheme } = usePDFStore()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-xl border-border/60 bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:text-foreground hover:shadow-md"
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
