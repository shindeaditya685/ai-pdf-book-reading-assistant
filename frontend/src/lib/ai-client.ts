export class AIClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message)
    this.name = 'AIClientError'
  }
}

export interface AIClientOptions {
  model?: string
  temperature?: number
  top_p?: number
  max_tokens?: number
  timeout?: number
  systemPrompt?: string
}

export interface AIClientResponse {
  content: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-flash'
const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const DEFAULT_TIMEOUT = 120_000
const DEFAULT_TEMPERATURE = 0.5
const DEFAULT_TOP_P = 0.95
const DEFAULT_MAX_TOKENS = 4096

class AIClient {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.NVIDIA_API_KEY || ''
    this.baseUrl = DEFAULT_BASE_URL
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async generate(prompt: string, options?: AIClientOptions): Promise<AIClientResponse> {
    if (!this.apiKey) {
      throw new AIClientError('NVIDIA API key is not configured', 500, 'MISSING_API_KEY')
    }

    const messages: { role: string; content: string }[] = []
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const timeout = options?.timeout ?? DEFAULT_TIMEOUT

    let res: Response
    try {
      res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options?.model ?? DEFAULT_MODEL,
          messages,
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          top_p: options?.top_p ?? DEFAULT_TOP_P,
          max_tokens: options?.max_tokens ?? DEFAULT_MAX_TOKENS,
        }),
        signal: AbortSignal.timeout(timeout),
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new AIClientError(`AI request timed out after ${timeout}ms`, 408, 'TIMEOUT')
      }
      throw new AIClientError(
        err instanceof Error ? err.message : 'Failed to connect to AI provider',
        502,
        'CONNECTION_ERROR',
      )
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new AIClientError(
        `AI provider returned ${res.status}: ${errBody || res.statusText}`,
        res.status,
        'PROVIDER_ERROR',
      )
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''

    if (!content) {
      throw new AIClientError('AI returned empty response', 500, 'EMPTY_RESPONSE')
    }

    return {
      content,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          }
        : undefined,
    }
  }

  async generateJSON<T>(prompt: string, options?: AIClientOptions): Promise<T> {
    const response = await this.generate(prompt, options)
    const parsed = this.parseJSON(response.content)
    if (parsed === null) {
      throw new AIClientError(
        'AI returned invalid JSON. Try rephrasing your prompt.',
        500,
        'INVALID_JSON',
      )
    }
    return parsed as T
  }

  private parseJSON(content: string): unknown {
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
}

export const aiClient = new AIClient()
