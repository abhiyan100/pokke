import type { PocketId } from '@shared/pockets'

/** One saved item shown in the hero's pockets: a snip of a post, and what the app made of it. */
export interface HeroCard {
  id: string
  pocket: PocketId
  title: string
  summary: string
  prompt: string
  image: string
}

const images = import.meta.glob('./assets/posts/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>

function card(id: string, details: Omit<HeroCard, 'id' | 'image'>): HeroCard {
  const image = images[`./assets/posts/${id}.svg`]
  if (!image) throw new Error(`No post image named ${id}`)
  return { id, image, ...details }
}

const LANDING = card('landing', {
  pocket: 'design',
  title: 'Editorial hero with oversized serif numerals',
  summary:
    'A post sharing a residency landing page built around a huge serif "07" and one coral image block on warm paper. Kept for how much the numeral does on its own.',
  prompt: `Build the hero section for [what I'm building], using the attached screenshot as the visual reference.

Layout: a two-column hero. The left holds one oversized numeral with a two-line headline beneath it; the right holds a single rounded image block. A thin top bar carries a wordmark and one filled pill.

Colour: warm paper #F3EEE4, deep forest green #1F3D2B for all type, coral #E8674A for the image block only.

Typography: a high-contrast old-style serif for the numeral and the headline, second line italic. A neutral grotesque for the bar.

The post shows desktop only, so choose a sensible stacked layout for small screens. Then compare your result with the image and fix what differs.`
})

const MOTION = card('motion', {
  pocket: 'design',
  title: 'Stacked cards that fan open on a spring',
  summary:
    'A motion clip of four cards fanning out from a stack, with the spring values given in the post (260 stiffness, 24 damping). Kept as a reference for how a stack should open.',
  prompt: `Animate a stack of cards in [my project] the way the attached frame shows.

Motion: the cards start squared up, then fan out from the bottom edge. Each card rotates a little more than the one in front of it and slides sideways, with its opacity stepping down towards the back. Use a spring of stiffness 260 and damping 24, and start each card about 40 ms after the one in front.

Look: 30 px corner radius, one saturated card in front and deeper violets behind, on a near-black ground with a soft glow.

Give me the component, and keep the motion off for people who ask for reduced motion.`
})

const ICONS = card('icons', {
  pocket: 'design',
  title: 'Rounded line icons with one accent each',
  summary:
    'A post showing an icon family: 2 px rounded strokes on white tiles, each glyph carrying a single coral accent. Kept for how consistent the set feels.',
  prompt: `Draw an icon set for [my product] in the style of the attached image.

Stroke: 2 px on a 24 px grid, round caps and joins, generous corners.

Colour: strokes near-black #1B1D2A. Each icon has exactly one small filled accent in coral #FF7A59, placed on the part that carries the meaning. Tiles are white with a large radius on an off-white page.

Start with: [the icons I need]. Deliver SVG with a consistent viewBox, then compare with the reference and fix any that look heavier or lighter than the rest.`
})

const USAGE = card('claude-usage', {
  pocket: 'tools',
  title: 'CLI that trims tool output to save tokens',
  summary:
    'A post about a command-line proxy that shortens command output before a model reads it, with a chart claiming 68% fewer tokens in a week. Kept to try on a real project.',
  prompt: `The attached post describes a command-line tool that trims the output of commands such as git status and npm test before an AI coding assistant reads it, claiming roughly 60 to 80 percent fewer tokens per command.

Assess whether a tool like this fits [my setup]. Tell me what kind of output it is likely to cut safely and where trimming could hide something I need (failing test details, for example), what the alternatives are, and how to measure the saving on my own usage before I rely on it.`
})

const DESIGN_PROMPT = card('design-prompt', {
  pocket: 'prompts',
  title: 'Glass stat card on a mesh gradient',
  summary:
    'A post sharing a short design prompt with its result: a frosted stat card over a coral-to-violet gradient. The prompt is reproduced here with a slot for your own screenshot.',
  prompt: `Design a stat card for [my product] in this style:

Glassmorphic stat card on a warm mesh gradient (coral to violet).
One huge number, one thin bar, frosted 1px border, 28px radius.

Use the attached screenshot as the reference for the gradient and the frosting. Keep the number legible against the brightest part of the gradient.`
})

const CRITIQUE = card('critique-prompt', {
  pocket: 'prompts',
  title: 'Three-pass screen critique prompt',
  summary: 'A prompt for a ranked, praise-free critique of a screen in three passes: hierarchy, friction and voice.',
  prompt: `You are a senior product designer reviewing my screen. Three passes:

1. Hierarchy: what the eye hits first, second, third.
2. Friction: every place a new user would hesitate.
3. Voice: copy that sounds like a template.

One-line fix for each. No praise.

Screen: [attach screenshot of the screen to review]`
})

const IDEA = card('idea', {
  pocket: 'ideas',
  title: 'Onboarding by annotating one screenshot',
  summary:
    'An idea to replace a setup form with one step: the new user pastes a screenshot of the tool they already use and circles what annoys them.',
  prompt: `Help me develop this idea for [my product's setup flow]:

Instead of a form or a tour, a new user pastes one screenshot of the tool they already use and circles what annoys them. The workspace is then set up from those circles.

Restate the idea precisely, then give me its strongest version, the three biggest risks, and three cheap ways to test it this week.`
})

/** The hero photograph's own size, and where the tops of its pockets are. */
export const PHOTO = { width: 1586, height: 992, lip: 443 }

export interface HeroPocket {
  name: string
  /** The seams that close the pocket's sides, in the photograph. Nothing tucked in it can sit outside them. */
  left: number
  right: number
  /** Where the photographed card sits; the live front card covers it exactly. */
  slot: { x: number; width: number; top: number }
  /** Back to front: the last one is the card on top. */
  cards: HeroCard[]
}

export const HERO_POCKETS: HeroPocket[] = [
  { name: 'Design', left: 474, right: 743, slot: { x: 506, width: 218, top: 280 }, cards: [ICONS, MOTION, LANDING] },
  { name: 'Tools', left: 745, right: 998, slot: { x: 765, width: 204, top: 238 }, cards: [USAGE] },
  { name: 'Prompts', left: 1000, right: 1233, slot: { x: 1010, width: 201, top: 323 }, cards: [CRITIQUE, DESIGN_PROMPT] },
  { name: 'Ideas', left: 1235, right: 1502, slot: { x: 1248, width: 220, top: 302 }, cards: [IDEA] }
]
