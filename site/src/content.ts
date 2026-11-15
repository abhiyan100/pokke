import type { PocketId } from '@shared/pockets'
import type { Rect } from '@shared/types'

/** Where the project lives. */
export const REPO_URL = 'https://github.com/abhiyan100/pokke'

/** The sample desktop used by the demo is drawn at this size. */
export const SCREEN = { width: 1440, height: 900 }

export interface DemoResult {
  pocket: PocketId
  title: string
  prompt: string
}

/** Parts of the sample desktop the demo recognises, with what the model would make of them. */
const REGIONS: { area: Rect; result: DemoResult }[] = [
  {
    area: { x: 452, y: 244, width: 452, height: 286 },
    result: {
      pocket: 'design',
      title: 'Editorial hero with oversized serif numerals',
      prompt:
        "Build the hero section for [what I'm building], using the attached screenshot as the visual reference.\n\nLayout: a two-column hero. The left holds one oversized numeral with a two-line headline beneath it; the right holds a single rounded image block.\n\nColour: warm paper #F3EEE4, deep forest green #1F3D2B for type, coral #E8674A for the image block only.\n\nTypography: a high-contrast old-style serif for the numeral and headline, second line italic.\n\nCompare your result with the image and fix what differs."
    }
  },
  {
    area: { x: 452, y: 590, width: 452, height: 250 },
    result: {
      pocket: 'prompts',
      title: 'Three-pass screen critique prompt',
      prompt:
        'You are a senior product designer reviewing my screen.\n\nCritique it in three passes:\n1. Hierarchy: what does the eye hit first, second, third?\n2. Friction: every place a new user would hesitate.\n3. Voice: copy that sounds like a template.\n\nFor each issue give the fix as a one-line change.\nDo not praise. Rank issues by impact.\n\nScreen: [attach screenshot of the screen to review]'
    }
  },
  {
    area: { x: 956, y: 200, width: 340, height: 300 },
    result: {
      pocket: 'reads',
      title: 'Trending: bento grids, local models, rounded gothics',
      prompt:
        'The attached image lists three topics trending in design and technology: bento grids, local models, and rounded gothic typefaces.\n\nFor each, explain in two sentences why it is getting attention now, then tell me which is most relevant to [my project] and what I could try this week.'
    }
  }
]

const FALLBACK: DemoResult = {
  pocket: 'loose',
  title: 'A corner of the screen',
  prompt:
    'Describe what the attached image shows and suggest how I could use it for [my project].\n\nTry dragging around the design or the prompt in the feed to see a filed snip.'
}

function overlap(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? width * height : 0
}

/** What the demo "model" makes of a selection, given in sample-desktop coordinates. */
export function fileSelection(selection: Rect): DemoResult {
  let best = FALLBACK
  let bestShare = 0.3
  for (const region of REGIONS) {
    const share = overlap(selection, region.area) / (selection.width * selection.height)
    if (share > bestShare) {
      best = region.result
      bestShare = share
    }
  }
  return best
}

/** The selection the demo draws by itself: the design in the first post. */
export const AUTO_SELECTION: Rect = REGIONS[0]!.area
