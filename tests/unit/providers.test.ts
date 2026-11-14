import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProviderError, rankModels } from '../../src/main/ai/provider'
import { gemini } from '../../src/main/ai/providers/gemini'
import { custom, openai } from '../../src/main/ai/providers/openai'

const request = {
  model: 'm',
  apiKey: 'sk-1',
  baseUrl: 'http://host/v1/',
  image: { base64: 'aGk=', mediaType: 'image/png' as const },
  note: 'why I kept it',
  palette: ['#F3EEE4', '#1F3D2B']
}

const answer = { choices: [{ message: { content: '{"pocket":"code","prompt":"p"}' } }] }

function stubFetch(...replies: { status?: number; body: unknown }[]) {
  const fetchMock = vi.fn(async () => {
    const reply = replies.shift()!
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('OpenAI-compatible provider', () => {
  it('sends the image, the note and a strict schema, and returns the parsed answer', async () => {
    const fetchMock = stubFetch({ body: answer })
    expect(await openai.analyze(request)).toEqual({ pocket: 'code', prompt: 'p' })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(url).toBe('http://host/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-1')
    expect(body.response_format.json_schema.strict).toBe(true)
    expect(body.messages[1].content[0].text).toContain('why I kept it')
    expect(body.messages[1].content[0].text).toContain('#F3EEE4, #1F3D2B')
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/png;base64,aGk=')
  })

  it('turns an auth failure into a message the user can act on', async () => {
    stubFetch({ status: 401, body: { error: { message: 'bad key' } } })
    await expect(openai.analyze(request)).rejects.toThrow(new ProviderError('OpenAI rejected the API key.'))
  })

  it('retries a compatible server in plain words when it rejects the schema', async () => {
    const fetchMock = stubFetch({ status: 400, body: { error: 'response_format unsupported' } }, { body: answer })
    expect(await custom.analyze({ ...request, apiKey: '' })).toEqual({ pocket: 'code', prompt: 'p' })

    const retry = JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)
    expect(retry.response_format).toBeUndefined()
    expect(retry.messages[0].content).toContain('one JSON object')
  })

  it('lists chat models only', async () => {
    stubFetch({ body: { data: [{ id: 'text-embedding-3' }, { id: 'gpt-5.1' }, { id: 'gpt-5.2-mini' }, { id: 'gpt-5.2' }] } })
    expect(await openai.listModels({ apiKey: 'sk-1', baseUrl: 'http://host/v1' })).toEqual(['gpt-5.2', 'gpt-5.1', 'gpt-5.2-mini'])
  })
})

describe('Gemini provider', () => {
  const base = 'https://generativelanguage.googleapis.com/v1beta'

  it('sends the image and note with the key in a header, and reads the JSON answer', async () => {
    const fetchMock = stubFetch({ body: { candidates: [{ content: { parts: [{ text: '{"pocket":"reads",' }, { text: '"prompt":"p"}' }] } }] } })
    expect(await gemini.analyze({ ...request, model: 'gemini-3-flash', baseUrl: base })).toEqual({ pocket: 'reads', prompt: 'p' })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(url).toBe(`${base}/models/gemini-3-flash:generateContent`)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('sk-1')
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: 'image/png', data: 'aGk=' })
    expect(body.contents[0].parts[1].text).toContain('why I kept it')
    expect(body.generationConfig.responseMimeType).toBe('application/json')
  })

  it('reports a blocked request and lists only models that can generate content', async () => {
    stubFetch({ body: { promptFeedback: { blockReason: 'SAFETY' } } })
    await expect(gemini.analyze({ ...request, model: 'gemini-3-flash', baseUrl: base })).rejects.toThrow('Gemini declined to analyse this snip.')

    stubFetch({
      body: {
        models: [
          { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-3-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }
        ]
      }
    })
    expect(await gemini.listModels({ apiKey: 'sk-1', baseUrl: base })).toEqual(['gemini-3-pro', 'gemini-3-flash'])
  })
})

describe('ranking models', () => {
  it('puts preferred families first, newest first within a family', () => {
    expect(rankModels(['b-1', 'a-2', 'zzz', 'a-10', 'a-2'], [/^a-/, /^b-/])).toEqual(['a-10', 'a-2', 'b-1', 'zzz'])
  })
})
