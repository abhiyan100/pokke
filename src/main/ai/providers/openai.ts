import { ANALYSIS_SCHEMA, JSON_ONLY_HINT, SYSTEM_PROMPT, parseJsonLoosely, userText } from '../brief'
import { ProviderError, rankModels, requestJson, type AnalyzeRequest, type Provider } from '../provider'

interface ChatResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null } }[]
}

interface ModelList {
  data?: { id?: string }[]
}

const NOT_CHAT_MODELS = /embedding|whisper|tts|audio|image|dall-e|moderation|realtime|transcribe|search|sora/

function headers(apiKey: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(apiKey && { authorization: `Bearer ${apiKey}` })
  }
}

function chatBody(request: AnalyzeRequest, strictSchema: boolean): string {
  return JSON.stringify({
    model: request.model,
    messages: [
      { role: 'system', content: strictSchema ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}\n\n${JSON_ONLY_HINT}` },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText(request.note, request.palette) },
          {
            type: 'image_url',
            image_url: { url: `data:${request.image.mediaType};base64,${request.image.base64}` }
          }
        ]
      }
    ],
    ...(strictSchema && {
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'snip_analysis', strict: true, schema: ANALYSIS_SCHEMA }
      }
    })
  })
}

/**
 * The OpenAI chat-completions protocol. Used for OpenAI itself and for any
 * compatible address (LM Studio, OpenRouter, vLLM and similar).
 */
export function openAiCompatible(service: string, options: { requireKey: boolean; preferred: RegExp[] }): Provider {
  const send = (request: AnalyzeRequest, strictSchema: boolean): Promise<unknown> =>
    requestJson(service, `${trimSlash(request.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: headers(request.apiKey),
      body: chatBody(request, strictSchema)
    })

  return {
    async analyze(request) {
      if (options.requireKey && !request.apiKey) throw new ProviderError(`Add your ${service} API key first.`)
      if (!request.model) throw new ProviderError('Choose a model first.')

      let reply: unknown
      try {
        reply = await send(request, true)
      } catch (error) {
        // Compatible servers often reject response_format; ask in plain words instead.
        if (options.requireKey || !(error instanceof ProviderError)) throw error
        reply = await send(request, false)
      }

      const message = (reply as ChatResponse).choices?.[0]?.message
      if (message?.refusal) throw new ProviderError(`${service} declined to analyse this snip.`)
      if (!message?.content) throw new ProviderError(`${service} returned an empty answer.`)
      return parseJsonLoosely(message.content)
    },

    async listModels({ apiKey, baseUrl }) {
      if (options.requireKey && !apiKey) throw new ProviderError(`Add your ${service} API key first.`)
      const reply = (await requestJson(service, `${trimSlash(baseUrl)}/models`, {
        headers: headers(apiKey)
      })) as ModelList
      const ids = (reply.data ?? [])
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string' && !NOT_CHAT_MODELS.test(id))
      return rankModels(ids, options.preferred)
    }
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export const openai = openAiCompatible('OpenAI', {
  requireKey: true,
  preferred: [/^gpt-\d+(\.\d+)?$/, /^gpt-\d+(\.\d+)?-mini$/, /^gpt-/, /^o\d/]
})

export const custom = openAiCompatible('The model server', { requireKey: false, preferred: [] })
