export interface DictResult {
  word: string
  meaning: string
  pronunciation: string
  partOfSpeech: string
  example: string
  synonyms: string
  antonyms: string
}

export async function lookupWord(word: string, accent?: string): Promise<DictResult | null> {
  try {
    const params = new URLSearchParams({ word })
    if (accent) params.set('accent', accent)
    const res = await fetch(`/api/dictionary?${params}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
