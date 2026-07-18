function parseJSON(content: string): unknown {
  let str = content.trim()
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_TIMEOUT = 60_000

// Primary model: the smart router that auto-selects from available free models.
// Fallbacks: tried in order if the router (or the previous fallback) is rate-limited.
const FREE_MODELS = [
  'tencent/hy3:free',
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
]

export class FallbackError extends Error {
  constructor(
    message: string,
    public detail: string,
  ) {
    super(message)
    this.name = 'FallbackError'
  }
}

async function tryModel<T>(model: string, prompt: string, apiKey: string): Promise<T | null> {
  try {
    const res = await fetch(OPENROUTER_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      // Don't propagate 429 (rate-limited) — let caller try next model
      if (res.status === 429) return null
      throw new FallbackError(
        `OpenRouter returned ${res.status} for ${model}: ${errBody || res.statusText}`,
        'PROVIDER_ERROR',
      )
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    if (!content) return null

    const parsed = parseJSON(content)
    if (!parsed) return null

    return parsed as T
  } catch (error) {
    if (error instanceof FallbackError) throw error
    return null
  }
}

export async function generateJSONWithFallback<T>(prompt: string): Promise<T> {
  const orKey = process.env.OPENROUTER_API_KEY || ''
  if (!orKey || orKey === 'your_openrouter_api_key_here') {
    throw new FallbackError('OpenRouter API key is not configured', 'MISSING_API_KEY')
  }

  for (const model of FREE_MODELS) {
    const result = await tryModel<T>(model, prompt, orKey)
    if (result !== null) return result
  }

  throw new FallbackError(
    'All OpenRouter free models are rate-limited or unavailable. Try again later, or add your own key at https://openrouter.ai/settings/integrations',
    'ALL_MODELS_EXHAUSTED',
  )
}
