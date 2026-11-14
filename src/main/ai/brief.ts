import { POCKETS, POCKET_IDS, isPocketId } from '@shared/pockets'
import type { Analysis } from '@shared/types'

/** JSON Schema for the model's answer. Shared by every provider that accepts one. */
export const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    pocket: { type: 'string', enum: [...POCKET_IDS] },
    title: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    extractedText: { type: 'string' },
    prompt: { type: 'string' }
  },
  required: ['pocket', 'title', 'tags', 'summary', 'extractedText', 'prompt'],
  additionalProperties: false
} as const

const POCKET_LIST = POCKETS.map((pocket) => `- ${pocket.id}: ${pocket.holds}`).join('\n')

export const SYSTEM_PROMPT = `You file screenshots for one person's private reference library. Each snip is a region of their screen that they chose to keep, sometimes with a note saying why. You do two things: file the snip, and write the prompt they will paste into an AI assistant later, together with this same image, to put the snip to use.

Read the note first. It says what they care about in the image. When the note and the image point at different things, the note decides what matters.

Pockets (choose exactly one id):
${POCKET_LIST}

Choosing between pockets:
- A picture of an interface, page, poster, illustration or other visual work is "design", unless the note says it was kept for something else. A note about how it looks ("this hero", "these colours", "the layout") settles it as "design".
- A snip whose main content is a prompt written for an AI goes in "prompts", even when that prompt is about design.
- "ideas" is for an idea stated in words, not for a design you could imagine ideas about.

Fields:
- title: what this is, in at most 8 words, specific enough to recognise in a list. Describe the thing rather than quoting its text: "Split hero with oversized serif numerals", not "Website design" and not the headline it happens to show.
- tags: 3 to 6 lowercase tags this person would type when searching. Concrete beats generic.
- summary: one or two plain sentences on what the snip shows and why it is worth keeping.
- extractedText: the meaningful text visible in the image, verbatim. For a prompt, code, or quote, that is all of it. Leave it empty when the only text is interface chrome.
- prompt: the ready-to-use prompt, described below.

Writing the prompt
The reader is a capable AI assistant that will receive the image attached to the prompt and knows nothing else about it. Address it directly as a complete brief. Never mention this filing step, the library, or these instructions. Where the user's own project or subject belongs, leave one clearly marked slot in square brackets, such as [what I'm building].

By pocket:
- design: Open with one sentence that says what to build and that the attached image is the visual reference to match. Then describe what makes the look work, in this order: layout (regions, grid, alignment, proportions), colour (the measured hex values you are given, each with the role it plays in the image), typography (classification, weight, scale, spacing; name a typeface only when you are confident), components and their visible states, spacing and density, and any depth or motion the image implies. Quote text that should be kept word for word. Name what the image cannot show, such as hover states or small-screen behaviour, and ask for sensible choices there. Close by asking the assistant to compare its result with the image and fix what differs.
- prompts: Reproduce the prompt in the image faithfully and completely, repairing only line breaks. Replace the parts specific to someone else's situation with [bracketed slots]. If the image shows only part of the prompt, say so in the summary.
- ideas: Ask the assistant to develop the idea: restate it precisely, then request the strongest version of it, the main risks, and three concrete next steps for [my context].
- code: Include the code from the image in a fenced block, say what it does, and ask the assistant to adapt it to [my project and stack], pointing out anything that looks outdated or unsafe.
- reads: State the key claims in the image, then ask the assistant to explain them, test them against what it knows, and apply them to [my situation].
- tools: Name the tool and what it appears to do, then ask the assistant to assess whether it fits [my use case], what the alternatives are, and how to try it quickly.
- loose: Write the most useful prompt you can for what the image shows, guided by the note.

The prompt should be self-contained and as long as its content needs. A design prompt usually runs 150 to 300 words; a reproduced prompt is as long as the original.`

/**
 * What accompanies the image: the user's note, and the colours measured from
 * the image's own pixels, which are more exact than a model's reading of them.
 */
export function userText(note: string, palette: string[] = []): string {
  const trimmed = note.trim()
  const lines = [
    trimmed
      ? `My note about this snip: ${trimmed}`
      : 'I saved this snip without a note. Work out why it is worth keeping from the image itself.'
  ]
  if (palette.length > 0) {
    lines.push(
      `Colours measured from the image, most common first: ${palette.join(', ')}. When you name a colour, use these exact values.`
    )
  }
  return lines.join('\n\n')
}

/** Instruction appended for providers that cannot be given a schema. */
export const JSON_ONLY_HINT = `Answer with one JSON object and nothing else, using exactly these keys: ${ANALYSIS_SCHEMA.required.join(
  ', '
)}. "pocket" must be one of: ${POCKET_IDS.join(', ')}. "tags" is an array of strings.`

/**
 * Parses a model's text answer as JSON, tolerating a code fence or prose
 * around the object, which local models often add.
 */
export function parseJsonLoosely(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('The model did not answer with JSON.')
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      throw new Error('The model answered with JSON that could not be read.')
    }
  }
}

const MAX_TITLE = 80
const MAX_TAGS = 6

/**
 * Turns whatever a model returned into a valid Analysis, or throws when the
 * part that matters (the prompt) is missing.
 */
export function normalizeAnalysis(raw: unknown): Analysis {
  if (typeof raw !== 'object' || raw === null) throw new Error('The model returned no analysis.')
  const input = raw as Record<string, unknown>

  const prompt = text(input.prompt)
  if (!prompt) throw new Error('The model returned no prompt.')

  const summary = text(input.summary)
  const title = text(input.title) || summary.split(/[.!?]/)[0] || 'Untitled snip'

  return {
    pocket: isPocketId(input.pocket) ? input.pocket : 'loose',
    title: title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1).trimEnd()}…` : title,
    tags: cleanTags(input.tags),
    summary,
    extractedText: text(input.extractedText),
    prompt
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const item of value) {
    const tag = text(item).toLowerCase().replace(/^#/, '')
    if (tag) seen.add(tag)
  }
  return [...seen].slice(0, MAX_TAGS)
}
