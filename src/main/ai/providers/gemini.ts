import { JSON_ONLY_HINT, SYSTEM_PROMPT, parseJsonLoosely, userText } from '../brief'
import { ProviderError, rankModels, requestJson, type Provider } from '../provider'

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

interface ModelList {
  models?: { name?: string; supportedGenerationMethods?: string[] }[]
}

const SERVICE = 'Gemini'
const PREFERRED = [/^gemini-[\d.]+-pro$/, /^gemini-[\d.]+-flash$/, /^gemini-.*pro/, /^gemini-.*flash/]

function headers(apiKey: string): Record<string, string> {
  if (!apiKey) throw new ProviderError('Add your Google AI Studio key first.')
  return { 'content-type': 'application/json', 'x-goog-api-key': apiKey }
}

export const gemini: Provider = {
  async analyze({ model, apiKey, baseUrl, image, note, palette }) {
    if (!model) throw new ProviderError('Choose a model first.')
    const reply = (await requestJson(SERVICE, `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\n${JSON_ONLY_HINT}` }] },
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: image.mediaType, data: image.base64 } }, { text: userText(note, palette) }]
          }
        ],
        generationConfig: { responseMimeType: 'application/json' }
      })
    })) as GenerateResponse

    if (reply.promptFeedback?.blockReason) throw new ProviderError('Gemini declined to analyse this snip.')
    const answer = reply.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
    if (!answer) throw new ProviderError('Gemini returned an empty answer.')
    return parseJsonLoosely(answer)
  },

  async listModels({ apiKey, baseUrl }) {
    const reply = (await requestJson(SERVICE, `${baseUrl}/models?pageSize=200`, {
      headers: headers(apiKey)
    })) as ModelList
    const ids = (reply.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => model.name?.replace(/^models\//, ''))
      .filter((id): id is string => Boolean(id) && id!.startsWith('gemini'))
    return rankModels(ids, PREFERRED)
  }
}
