import Anthropic from '@anthropic-ai/sdk'
import { ANALYSIS_SCHEMA, SYSTEM_PROMPT, parseJsonLoosely, userText } from '../brief'
import { ProviderError, rankModels, type Provider } from '../provider'

/**
 * Models that accept the server-side fallback: if a safety classifier
 * declines the request, the API re-runs it on a fallback model in the same call.
 */
const SUPPORTS_FALLBACK = /^claude-(fable|opus|sonnet)-5/

const PREFERRED = [/^claude-opus-5-5$/, /^claude-opus/, /^claude-sonnet/, /^claude-fable/, /^claude-haiku/]

function client(apiKey: string): Anthropic {
  if (!apiKey) throw new ProviderError('Add your Anthropic API key first.')
  return new Anthropic({ apiKey })
}

export const anthropic: Provider = {
  async analyze({ model, apiKey, image, note, palette }) {
    const withFallback = SUPPORTS_FALLBACK.test(model)
    try {
      const response = await client(apiKey).beta.messages.create({
        model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: ANALYSIS_SCHEMA }
        },
        ...(withFallback && {
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default' as const
        }),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: image.mediaType, data: image.base64 }
              },
              { type: 'text', text: userText(note, palette) }
            ]
          }
        ]
      })

      if (response.stop_reason === 'refusal') {
        throw new ProviderError('Claude declined to analyse this snip.')
      }
      if (response.stop_reason === 'max_tokens') {
        throw new ProviderError('Claude ran out of room before finishing. Try again.')
      }
      const answer = response.content.find((block) => block.type === 'text')
      if (!answer) throw new ProviderError('Claude returned an empty answer.')
      return parseJsonLoosely(answer.text)
    } catch (error) {
      throw toProviderError(error)
    }
  },

  async listModels({ apiKey }) {
    try {
      const ids: string[] = []
      for await (const model of client(apiKey).models.list()) ids.push(model.id)
      return rankModels(ids, PREFERRED)
    } catch (error) {
      throw toProviderError(error)
    }
  }
}

function toProviderError(error: unknown): Error {
  if (error instanceof ProviderError) return error
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError('Anthropic rejected the API key.')
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new ProviderError('Anthropic does not know that model.')
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError('Anthropic is rate-limiting this key. Try again in a moment.')
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError('Could not reach Anthropic. Check your connection.')
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError(`Anthropic: ${error.message.slice(0, 200)}`)
  }
  return error instanceof Error ? error : new Error(String(error))
}
