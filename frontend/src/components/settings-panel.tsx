'use client'

import { Globe, Settings2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePDFStore, LANGUAGE_LABELS, type TranslationLanguage } from '@/store/use-pdf-store'
import { Label } from '@/components/ui/label'

export function SettingsPanel() {
  const { translationLanguage, setTranslationLanguage } = usePDFStore()

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5">
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          Translate to
        </Label>
        <Select
          value={translationLanguage}
          onValueChange={(val) => setTranslationLanguage(val as TranslationLanguage)}
        >
          <SelectTrigger className="h-7 w-[130px] border-0 p-0 text-xs shadow-none focus:ring-0">
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
    </div>
  )
}
