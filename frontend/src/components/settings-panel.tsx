'use client'

import { Globe, Volume2, Sun, Moon, Settings2, Palette, Bookmark, Brain, List, Clock, Timer, Check } from 'lucide-react'
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
import { motion } from 'framer-motion'

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
    setShowReadingTimer
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
        className="w-80 rounded-2xl border-border/50 bg-background/80 p-4 shadow-2xl backdrop-blur-xl focus-visible:outline-none"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 pb-3 border-b border-border/40">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md">
              <Settings2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-foreground block leading-none">Settings</span>
              <span className="text-[10px] text-muted-foreground/80 mt-0.5 block">Customize your workspace</span>
            </div>
          </div>

          {/* Section: Language & Accent */}
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-border/20 pb-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Language & Accent</span>
            </div>

            {/* Translation Language */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground/80">Translation Language</label>
              <Select
                value={translationLanguage}
                onValueChange={(val) => setTranslationLanguage(val as TranslationLanguage)}
              >
                <SelectTrigger className="h-8 w-full rounded-lg border-border/60 text-xs bg-background/50 hover:bg-background/80 transition-colors">
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

            {/* Pronunciation Accent */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground/80">Pronunciation Accent</label>
              <Select
                value={accent}
                onValueChange={(val) => setAccent(val as PronunciationAccent)}
              >
                <SelectTrigger className="h-8 w-full rounded-lg border-border/60 text-xs bg-background/50 hover:bg-background/80 transition-colors">
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

          {/* Section: Reading Tools */}
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-border/20 pb-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Reading Tools</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-background/40 border border-border/30 px-3 py-2 text-xs text-muted-foreground transition-all hover:bg-background/60 shadow-sm">
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span>Show Reading Timer</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                role="switch"
                aria-checked={showReadingTimer}
                onClick={() => setShowReadingTimer(!showReadingTimer)}
                className={`relative h-5 w-9 rounded-full transition-colors duration-200 ease-in-out shadow-inner ${
                  showReadingTimer ? 'bg-emerald-500' : 'bg-muted-foreground/20'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                    showReadingTimer ? 'translate-x-4' : ''
                  }`}
                />
              </motion.button>
            </div>
          </div>

          {/* Section: Vocabulary Workflow */}
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-border/20 pb-1.5">
              <Bookmark className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Vocabulary Workflow</span>
            </div>

            <p className="text-[10px] text-muted-foreground/75 px-1 leading-normal">
              When I bookmark a word on the page:
            </p>

            <div className="space-y-2">
              {/* Toggle: Auto Flashcard */}
              <div className="flex items-center justify-between rounded-lg bg-background/40 border border-border/30 px-3 py-2 text-xs text-muted-foreground transition-all hover:bg-background/60 shadow-sm">
                <div className="flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span>Auto-create flashcard</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  role="switch"
                  aria-checked={autoFlashcard}
                  onClick={() => setAutoFlashcard(!autoFlashcard)}
                  className={`relative h-5 w-9 rounded-full transition-colors duration-200 ease-in-out shadow-inner ${
                    autoFlashcard ? 'bg-emerald-500' : 'bg-muted-foreground/20'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                      autoFlashcard ? 'translate-x-4' : ''
                    }`}
                  />
                </motion.button>
              </div>

              {/* Toggle: Auto Add List */}
              <div className={`flex items-center justify-between rounded-lg bg-background/40 border border-border/30 px-3 py-2 text-xs text-muted-foreground transition-all hover:bg-background/60 shadow-sm ${
                !defaultListId ? 'opacity-50' : ''
              }`}>
                <div className="flex items-center gap-2">
                  <List className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span>Add to default list</span>
                </div>
                <motion.button
                  whileTap={defaultListId ? { scale: 0.9 } : undefined}
                  role="switch"
                  aria-checked={autoAddToList && !!defaultListId}
                  onClick={() => setAutoAddToList(!autoAddToList)}
                  disabled={!defaultListId}
                  className={`relative h-5 w-9 rounded-full transition-colors duration-200 ease-in-out shadow-inner ${
                    autoAddToList && defaultListId ? 'bg-emerald-500' : 'bg-muted-foreground/20'
                  } ${!defaultListId ? 'cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                      autoAddToList && defaultListId ? 'translate-x-4' : ''
                    }`}
                  />
                </motion.button>
              </div>

              {!defaultListId && (
                <p className="px-1 text-[9px] text-muted-foreground/60 italic leading-snug">
                  * Star a word list under Word Lists to auto-add.
                </p>
              )}
            </div>
          </div>

          {/* Section: Theme & Accent */}
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-border/20 pb-1.5">
              <Palette className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Theme & Accent</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground/80 block">Theme Color</label>
              <div className="grid grid-cols-5 gap-2">
                {ACCENT_OPTIONS.map((opt) => {
                  const isSelected = themeAccent === opt.value
                  return (
                    <motion.button
                      key={opt.value}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setThemeAccent(opt.value)}
                      className={`relative flex h-8 items-center justify-center rounded-xl ${opt.className} transition-all shadow-sm ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110 shadow-md'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      title={opt.label}
                    >
                      {isSelected && (
                        <Check className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Appearance Toggle */}
            <div className="pt-1.5">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-lg bg-background/50 border border-border/40 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-background hover:text-foreground shadow-sm"
              >
                <div className="flex items-center gap-2">
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Moon className="h-4 w-4 text-indigo-500" />
                  )}
                  <span>Appearance</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-muted/80 px-2 py-0.5 rounded-md text-foreground">
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
