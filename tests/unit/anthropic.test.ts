import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anthropic } from '../../src/main/ai/providers/anthropic'

/**
 * The Claude provider goes through the official SDK, so it is checked against
 * a local server standing in for the API: what the SDK actually sends, and
 * how its replies are read. It cannot prove the real service accepts the
 * request; that needs a real key.
 */

let server: Server
let seen: { url: string; headers: IncomingHttpHeaders; body: Record<string, any> }[] = []
let reply: { status: number; body: unknown }

const answer = (text: string, stopReason = 'end_turn') => ({
  status: 200,
  body: {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 }
  }
})

const request = {
  model: 'claude-opus-5-5',
  apiKey: 'sk-ant-test',
  baseUrl: '',
  image: { base64: 'aGk=', mediaType: 'image/png' as const },
  note: 'that hero',
  palette: []
}

beforeAll(async () => {
  server = createServer((incoming, response) => {
    let raw = ''
    incoming.on('data', (chunk) => (raw += chunk))
    incoming.on('end', () => {
      seen.push({ url: incoming.url ?? '', headers: incoming.headers, body: raw ? JSON.parse(raw) : {} })
      response.writeHead(reply.status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(reply.body))
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  delete process.env.ANTHROPIC_BASE_URL
  server.close()
})

describe('Claude provider', () => {
  it('sends the image, note and schema, opts into the refusal fallback, and reads the JSON answer', async () => {
    seen = []
    reply = answer('{"pocket":"design","prompt":"Build it"}')

    expect(await anthropic.analyze(request)).toEqual({ pocket: 'design', prompt: 'Build it' })

    const sent = seen[0]!
    expect(sent.url).toContain('/v1/messages')
    expect(sent.headers.authorization).toBe('Bearer sk-ant-test')
    expect(sent.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01')
    expect(sent.body).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } }
    })
    expect(sent.body.output_config.format.schema.required).toContain('prompt')
    expect(sent.body.messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGk=' } },
      { type: 'text', text: 'My note about this snip: that hero' }
    ])
  })

  it('leaves the fallback out for models that do not take it', async () => {
    seen = []
    reply = answer('{"pocket":"code","prompt":"p"}')
    await anthropic.analyze({ ...request, model: 'claude-haiku-5-5' })
    expect(seen[0]!.body.fallbacks).toBeUndefined()
    expect(seen[0]!.headers['anthropic-beta'] ?? '').not.toContain('server-side-fallback')
  })

  it('says so plainly when Claude declines or the key is wrong', async () => {
    reply = answer('', 'refusal')
    await expect(anthropic.analyze(request)).rejects.toThrow('Claude declined to analyse this snip.')

    reply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }
    await expect(anthropic.analyze(request)).rejects.toThrow('Anthropic rejected the API key.')
  })

  it('lists models with the default first', async () => {
    reply = {
      status: 200,
      body: {
        data: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'].map((id) => ({
          id,
          type: 'model',
          display_name: id,
          created_at: '2026-01-01T00:00:00Z'
        })),
        has_more: false,
        first_id: 'claude-haiku-5-5',
        last_id: 'claude-opus-5-5'
      }
    }
    expect(await anthropic.listModels({ apiKey: 'sk-ant-test', baseUrl: '' })).toEqual([
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-haiku-5-5'
    ])
  })
})
