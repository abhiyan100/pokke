import { describe, expect, it } from 'vitest'
import { normalizeAnalysis, parseJsonLoosely } from '../../src/main/ai/brief'

describe('reading a model answer', () => {
  it('reads JSON wrapped in a code fence or prose', () => {
    expect(parseJsonLoosely('Here you go:\n```json\n{"pocket":"code"}\n```')).toEqual({ pocket: 'code' })
  })

  it('rejects an answer with no JSON in it', () => {
    expect(() => parseJsonLoosely('I cannot help with that.')).toThrow(/did not answer with JSON/)
  })
})

describe('normalising an analysis', () => {
  const complete = {
    pocket: 'design',
    title: 'Split hero',
    tags: ['Landing', '#hero', 'hero', '', 7, 'a', 'b', 'c', 'd', 'e'],
    summary: 'A split hero. With numerals.',
    extractedText: ' Seven rooms ',
    prompt: ' Build this. '
  }

  it('keeps a valid answer, trimming text and cleaning tags', () => {
    expect(normalizeAnalysis(complete)).toEqual({
      pocket: 'design',
      title: 'Split hero',
      tags: ['landing', 'hero', 'a', 'b', 'c', 'd'],
      summary: 'A split hero. With numerals.',
      extractedText: 'Seven rooms',
      prompt: 'Build this.'
    })
  })

  it('files an unknown pocket under loose', () => {
    expect(normalizeAnalysis({ ...complete, pocket: 'inspiration' }).pocket).toBe('loose')
  })

  it('falls back to the first sentence of the summary when there is no title', () => {
    expect(normalizeAnalysis({ ...complete, title: '' }).title).toBe('A split hero')
  })

  it('refuses an answer without a prompt, which is the part that matters', () => {
    expect(() => normalizeAnalysis({ ...complete, prompt: '  ' })).toThrow(/no prompt/)
    expect(() => normalizeAnalysis(null)).toThrow(/no analysis/)
  })
})
