import type { Snip, SnipRecord } from '@shared/types'

const HOUR = 3_600_000

type Sample = Omit<SnipRecord, 'id' | 'createdAt' | 'status'> & {
  file: string
  hoursAgo: number
  status?: SnipRecord['status']
  error?: string
}

const SAMPLES: Sample[] = [
  {
    file: 'hero-numerals',
    hoursAgo: 0.1,
    note: 'this hero for the portfolio relaunch',
    width: 1200,
    height: 760,
    palette: ['#F3EEE4', '#1F3D2B', '#E8674A', '#5B6B5E'],
    pocket: 'design',
    title: 'Editorial hero with oversized serif numerals',
    tags: ['landing page', 'serif', 'editorial', 'hero', 'warm'],
    summary:
      'A residency landing page built around a huge serif "07" and a single coral image block on warm paper. Worth keeping for how much the numeral does on its own.',
    extractedText: 'Seven rooms, one long table, and nothing on the walls.',
    prompt: `Build the hero section for [what I'm building], using the attached screenshot as the visual reference.

Layout: a two-column hero on a 12-column grid. The left seven columns hold one oversized numeral that bleeds toward the left edge, with a two-line headline set beneath it. The right five columns hold a single rounded image block, then two lines of supporting copy and one outlined pill button. A thin top bar carries a wordmark on the left and three text links plus a filled pill on the right.

Colour: warm paper background #F3EEE4, deep forest green #1F3D2B for all type and the filled pill, coral #E8674A for the image block only, muted green-grey #5B6B5E for supporting copy.

Typography: a high-contrast old-style serif for the numeral (around 470px, tight tracking) and the headline (about 46px, second line italic). A neutral grotesque at 15 to 16px for navigation, supporting copy and the button.

Components: the image block has a 28px radius and contains a simple circle-and-semicircle composition. The button is a 48px-tall outlined pill with a 2px border.

The screenshot shows desktop only, so choose a sensible stacked layout for small screens and a restrained hover state for the links and buttons. When you are done, compare your result against the image and fix any differences in proportion, spacing or colour.`
  },
  {
    file: 'prompt-post',
    hoursAgo: 3,
    note: '',
    width: 1100,
    height: 700,
    palette: ['#FFFFFF', '#F7F9F9', '#0F1419', '#1D9BF0'],
    pocket: 'prompts',
    title: 'Three-pass screen critique prompt',
    tags: ['critique', 'design review', 'ux', 'feedback'],
    summary:
      'A prompt for getting a ranked, praise-free critique of a UI screen in three passes: hierarchy, friction and voice.',
    extractedText:
      'You are a senior product designer reviewing my screen. Critique it in three passes: 1. Hierarchy: what does the eye hit first, second, third? 2. Friction: every place a new user would hesitate. 3. Voice: copy that sounds like a template. For each issue give the fix as a one-line change. Do not praise. Rank issues by impact.',
    prompt: `You are a senior product designer reviewing my screen.

Critique it in three passes:
1. Hierarchy: what does the eye hit first, second, third?
2. Friction: every place a new user would hesitate.
3. Voice: copy that sounds like a template.

For each issue give the fix as a one-line change.
Do not praise. Rank issues by impact.

Screen: [attach screenshot of the screen to review]`
  },
  {
    file: 'finance-app',
    hoursAgo: 7,
    note: 'lime on near-black, the balance card',
    width: 720,
    height: 1280,
    palette: ['#0E0F13', '#C6F35E', '#22242C', '#F4F5F0', '#8A8F9C'],
    pocket: 'design',
    title: 'Dark finance home with lime balance card',
    tags: ['mobile', 'fintech', 'dark ui', 'cards', 'lime'],
    summary:
      'A mobile banking home screen where one saturated lime card carries the balance and both primary actions, against a near-black ground.',
    extractedText: '',
    prompt: `Design the home screen of [my mobile app], using the attached screenshot as the visual reference.

Layout: a single column with 40px side margins. A greeting row with an avatar at the top right, then one large hero card, then two equal half-width tiles, then a list of recent items.

Colour: near-black background #0E0F13, raised surfaces #22242C, primary text #F4F5F0, secondary text #8A8F9C. One accent, lime #C6F35E, used as the full fill of the hero card and for positive values. Text on lime is the background colour, not white.

Typography: a geometric sans. The hero figure is very large and extra-bold with tight tracking; labels sit at about a quarter of that size and regular weight.

Components: the hero card has a 44px radius and holds a label, the main figure, a change line, and two pill buttons side by side (one filled dark, one outlined). Tiles have a 36px radius: one holds a five-bar chart with a single contrasting bar, the other a percentage with a progress track. List rows are a 64px circle, two lines of text, and a right-aligned amount.

The image does not show pressed states, scrolling behaviour, or a light theme: choose sensible ones. Then compare your result with the screenshot and correct any differences.`
  },
  {
    file: 'react-hook',
    hoursAgo: 20,
    note: 'spring without a library',
    width: 1100,
    height: 720,
    palette: ['#0D1117', '#C9D1D9', '#FF7B72', '#D2A8FF', '#79C0FF'],
    pocket: 'code',
    title: 'Dependency-free spring value hook',
    tags: ['react', 'animation', 'spring', 'hooks', 'typescript'],
    summary:
      'A small React hook that animates a number towards a target with spring physics using requestAnimationFrame, no animation library needed.',
    extractedText: 'export function useSpringValue(target: number, stiffness = 260, damping = 26) { … }',
    prompt: `The attached screenshot shows a React hook that animates a number with spring physics:

\`\`\`ts
export function useSpringValue(target: number, stiffness = 260, damping = 26) {
  const [value, setValue] = useState(target)
  const velocity = useRef(0)
  useEffect(() => {
    let frame = 0, last = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032)
      setValue((current) => {
        const force = stiffness * (target - current) - damping * velocity.current
        velocity.current += force * dt
        return current + velocity.current * dt
      })
      frame = requestAnimationFrame(step)
    }
    // …
  }, [target, stiffness, damping])
  return value
}
\`\`\`

The image cuts off before the end of the effect. Complete it properly (start the loop, update \`last\`, stop when the value has settled, cancel the frame on cleanup), then adapt it to [my project and stack]. Point out anything in the visible code that looks wrong or wasteful, such as mutating a ref inside a state updater.`
  },
  {
    file: 'bento-dashboard',
    hoursAgo: 28,
    note: '',
    width: 1280,
    height: 800,
    palette: ['#F7F5FA', '#C9B8FF', '#B8F0D0', '#FFE9A8', '#221F2E'],
    pocket: 'design',
    title: 'Pastel bento dashboard',
    tags: ['dashboard', 'bento', 'pastel', 'data'],
    summary:
      'A studio dashboard laid out as a bento grid of soft pastel tiles, each holding one number or one small chart.',
    extractedText: '',
    prompt: `Build a dashboard for [my product], using the attached screenshot as the visual reference.

Layout: a bento grid with 24px gaps on a pale lilac-grey page (#F7F5FA). The top row has one wide tile, one square tile and two stacked half-height tiles. The bottom row has one dark square tile and one wide white tile.

Colour: each tile is a single flat pastel: lavender #C9B8FF, mint #B8F0D0, butter #FFE9A8, pink #FFC2D4. One tile is near-black #221F2E for contrast. All text is #221F2E, secondary text #7B7690.

Typography: one sans family. Tile labels are 18px regular; the main figure in each tile is extra-bold and several times larger, with tight tracking.

Components: every tile has a 32px radius and holds exactly one idea: a big number with a single-stroke sparkline, a ring showing a percentage, a count, or three labelled progress bars. No borders and no shadows.

Hover states, empty states and the narrow-screen layout are not shown: make sensible choices. Compare your result with the image when done and fix what differs.`
  },
  {
    file: 'idea-note',
    hoursAgo: 46,
    note: 'could work for our setup flow',
    width: 1000,
    height: 700,
    palette: ['#FFF7D6', '#2A2416', '#E0454E', '#7A6E4A'],
    pocket: 'ideas',
    title: 'Onboarding by annotating one screenshot',
    tags: ['onboarding', 'product idea', 'setup', 'first run'],
    summary:
      'An idea to replace the setup form with a single step: the new user pastes a screenshot of their current tool and circles what annoys them.',
    extractedText: 'What if onboarding was just one screenshot you annotate?',
    prompt: `Help me develop this idea for [my product's setup flow]:

Instead of a form or a tour, a new user pastes one screenshot of the tool they already use and circles what annoys them. The workspace is then configured from those circles.

First restate the idea precisely, including what has to be true for it to work. Then give me the strongest version of it, the three biggest risks (technical and behavioural), and three concrete next steps I could take this week to test it cheaply. The attached image is the original sketch.`
  },
  {
    file: 'system-prompt',
    hoursAgo: 52,
    note: '',
    width: 1100,
    height: 820,
    palette: ['#161821', '#CAD3F5', '#EEBE77', '#8AADF4'],
    pocket: 'prompts',
    title: 'Release-notes writer system prompt',
    tags: ['system prompt', 'release notes', 'writing', 'changelog'],
    summary: 'A structured system prompt (role, input, output, rules) for turning merged pull requests into terse release notes.',
    extractedText: '# Role\nYou write release notes for a design tool used by working designers. They skim. They distrust hype.',
    prompt: `# Role
You write release notes for [my product], used by [who uses it]. They skim. They distrust hype.

# Input
A list of merged pull requests with titles and labels.

# Output
- One headline of at most seven words.
- Up to five bullets, most useful change first.
- Each bullet starts with what the user can now do.
- No adjectives that could apply to any product.

# Rules
Skip refactors and dependency bumps entirely.
If a fix closes a bug users reported, say which.
Never promise a date.

[paste pull requests here]`
  },
  {
    file: 'tool-card',
    hoursAgo: 70,
    note: 'try for the pocket open animation',
    width: 1100,
    height: 640,
    palette: ['#12131A', '#8B5CF6', '#F5F3FF', '#A8A3C2'],
    pocket: 'tools',
    title: 'Loomkit: 6 kB layout-animation library',
    tags: ['react', 'motion', 'library', 'open source'],
    summary: 'An MIT-licensed React library for shared-element transitions, springs and gesture physics that claims to weigh 6 kB.',
    extractedText: 'npm install loomkit',
    prompt: `The attached image is the landing page of Loomkit, a React library for layout animations (shared-element transitions, springs, gesture physics, about 6 kB, MIT).

Assess whether it fits [my use case]. Tell me what it most likely does well and badly given how it describes itself, which established alternatives I should compare it with, and the quickest way to try it in an existing project without committing to it.`
  },
  {
    file: 'article-chart',
    hoursAgo: 96,
    note: '',
    width: 1100,
    height: 820,
    palette: ['#FBFBF9', '#16181D', '#B4532A', '#E8B79C'],
    pocket: 'reads',
    title: 'Time to first value predicts next-day return',
    tags: ['research', 'retention', 'onboarding', 'chart'],
    summary:
      'A research note claiming that across 41 products, people who got something keepable within ten seconds returned the next day 71% of the time, against 18% past a minute.',
    extractedText: 'Speed to the first keepable thing beat every feature we tested.',
    prompt: `The attached image is a research note. Its claims:

- Across 41 products, time from install to the first "keepable" result strongly predicts next-day return.
- Under 10 seconds: 71% return. 10 to 30 s: 52%. 30 to 60 s: 33%. Over 60 s: 18%.
- "Speed to the first keepable thing beat every feature we tested."

Explain what would have to be true for this to hold, where the reasoning could be confounded, and then apply it to [my product]: where is my first keepable moment, how long does it take today, and what are the three most direct ways to shorten it?`
  },
  {
    file: 'poster',
    hoursAgo: 120,
    note: 'type scale + that red',
    width: 800,
    height: 1100,
    palette: ['#EDE6D6', '#151515', '#D7372B', '#1E4FA3'],
    pocket: 'design',
    title: 'Constructivist exhibition poster',
    tags: ['poster', 'typography', 'print', 'bold'],
    summary: 'A poster built from three flat shapes and three stacked words in a black grotesque, the last one in red.',
    extractedText: 'FORM FOLLOWS FEELING',
    prompt: `Design a poster-style section for [my project], using the attached image as the visual reference.

Layout: portrait, on an unbleached paper tone. A large circle sits upper right, a tall black bar upper left, and a full-width black rule divides the sheet just above the middle. Three words stack flush-left in the lower half, each on its own line and nearly the full width.

Colour: paper #EDE6D6, black #151515, signal red #D7372B, and one small circle of cobalt #1E4FA3.

Typography: a black-weight grotesque in capitals with very tight tracking for the three words; the last word is red. Small supporting text is semi-bold capitals with wide tracking.

Keep the shapes flat: no gradients, shadows or outlines. Then compare your result with the image and fix differences in proportion and weight.`
  },
  {
    file: 'terminal',
    hoursAgo: 150,
    note: '',
    width: 1000,
    height: 520,
    palette: ['#1B1B1F', '#E6E6EA', '#7EE787', '#8B8B96'],
    pocket: 'code',
    title: 'ffmpeg: screen recording to small MP4 and GIF',
    tags: ['ffmpeg', 'video', 'gif', 'terminal'],
    summary: 'Two ffmpeg commands that turn a 48 MB screen recording into a 1.1 MB MP4 and a palette-optimised GIF.',
    extractedText:
      'ffmpeg -i demo.mov -vf "fps=30,scale=1280:-2" -c:v libx264 -crf 23 -preset slow -an demo.mp4',
    prompt: `These two commands from the attached screenshot compress a screen recording:

\`\`\`sh
ffmpeg -i demo.mov -vf "fps=30,scale=1280:-2" -c:v libx264 -crf 23 -preset slow -an demo.mp4
ffmpeg -i demo.mp4 -vf "fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" demo.gif
\`\`\`

Explain what each flag does, then adapt them for [my recording and where it will be shown]. Tell me if a newer codec or container would give a smaller file at the same quality.`
  }
]

export function sampleSnips(baseUrl: string): Snip[] {
  const now = Date.now()
  return SAMPLES.map(({ file, hoursAgo, status, ...rest }, index) => ({
    ...rest,
    id: `sample-${index + 1}`,
    createdAt: now - hoursAgo * HOUR,
    status: status ?? 'ready',
    imageUrl: `${baseUrl}samples/${file}.svg`,
    thumbUrl: `${baseUrl}samples/${file}.svg`
  }))
}
