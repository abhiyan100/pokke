import { ANALYSIS_SCHEMA, SYSTEM_PROMPT, parseJsonLoosely, userText } from '../brief'
import { ProviderError, rankModels, requestJson, type Provider } from '../provider'

interface ChatResponse {
  message?: { content?: string }
}

interface TagList {
  models?: { name?: string }[]
}

const SERVICE = 'Ollama'

/** Model families that can read images, so they are offered first. */
const VISION = [/vision|llava|bakllava|moondream|minicpm|qwen.*vl|gemma[34]|pixtral|granite.*vision/i]

export const ollama: Provider = {
  async analyze({ model, baseUrl, image, note, palette }) {
    if (!model) throw new ProviderError('Choose a model first.')
    const reply = (await requestJson(SERVICE, `${baseUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: ANALYSIS_SCHEMA,
        // Small local models file more consistently when kept close to their most likely answer,
        // and need room for the instructions, the image and a full prompt.
        options: { temperature: 0.2, num_ctx: 8192 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userText(note, palette), images: [image.base64] }
        ]
      })
    })) as ChatResponse

    if (!reply.message?.content) throw new ProviderError('The local model returned an empty answer.')
    return parseJsonLoosely(reply.message.content)
  },

  async listModels({ baseUrl }) {
    const reply = (await requestJson(SERVICE, `${baseUrl.replace(/\/+$/, '')}/api/tags`)) as TagList
    const ids = (reply.models ?? []).map((model) => model.name).filter((id): id is string => Boolean(id))
    return rankModels(ids, VISION)
  }
}
