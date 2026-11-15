import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { Pattern } from '@app/ui/Pattern'
import { Stitch } from '@app/ui/Stitch'
import { CheckIcon, CopyIcon } from '@app/ui/icons'
import { POCKETS } from '@shared/pockets'
import { PROVIDERS } from '@shared/types'
import { Demo } from './Demo'
import { HeroRoll } from './HeroRoll'
import { REPO_URL } from './content'

const HEADLINE = ['Snip it.', 'It files itself.']

const INSTALL = `git clone ${REPO_URL}.git
cd pokke
npm install
npm start`

/** What each pocket is for, in a few words. */
const POCKET_LINES: Record<string, string> = {
  design: 'Layouts, type, colour, motion',
  prompts: 'Prompts worth reusing',
  ideas: 'Things to try or build',
  code: 'Snippets and commands',
  reads: 'Threads, quotes, charts',
  tools: 'Apps and libraries to check',
  loose: 'Everything else'
}

const STEPS = [
  {
    title: 'Double-tap Right ⌘',
    body: 'The screen freezes under a crosshair, in any app. On Windows it is Right Ctrl.'
  },
  {
    title: 'Drag, then say why',
    body: 'A stitched outline follows your drag. Add a note about what caught your eye, or just press Enter.'
  },
  {
    title: 'Copy it back out',
    body: 'Later, open the pocket. The prompt and the image are one click each, ready to paste into Claude or any assistant.'
  }
]

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" fill="var(--kon)" />
      <rect x="4.5" y="4.5" width="19" height="19" rx="4.5" fill="none" stroke="var(--thread)" strokeWidth="1.3" strokeDasharray="2.6 2.2" strokeLinecap="round" />
      <path d="M10 12.5V10h2.5M15.5 10H18v2.5M18 15.5V18h-2.5M12.5 18H10v-2.5" fill="none" stroke="var(--thread)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21.2" cy="21.2" r="1.9" fill="var(--akane)" />
    </svg>
  )
}

/**
 * The headline as appliqué: each letter is sewn around its edge, then filled
 * with undyed cotton. The real text is in the h1 for readers and search.
 */
function Headline() {
  const lines = HEADLINE.map((line, index) => ({ line, y: 92 + index * 112 }))
  const text = (className: string) =>
    lines.map(({ line, y }) => (
      <text key={line} className={className} x="0" y={y}>
        {line}
      </text>
    ))
  return (
    <h1 className="headline">
      <span className="visually-hidden">{HEADLINE.join(' ')}</span>
      <svg viewBox="0 0 700 236" aria-hidden="true" focusable="false">
        <defs>
          <mask id="sewing" maskUnits="userSpaceOnUse" x="-10" y="-10" width="720" height="256">
            {text('headline__needle')}
          </mask>
        </defs>
        {text('headline__cotton')}
        <g mask="url(#sewing)">{text('headline__stitch')}</g>
      </svg>
    </h1>
  )
}

function Install() {
  const [copied, setCopied] = useState(false)
  return (
    <div className="install">
      <pre>
        <code>{INSTALL}</code>
      </pre>
      <button
        className="install__copy"
        onClick={() => {
          void navigator.clipboard?.writeText(INSTALL).catch(() => undefined)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="page cloth">
        <header className="hero">
          <HeroRoll />
          <nav className="nav" aria-label="Main">
            <a className="nav__brand" href="#top">
              <Mark />
              Pokke
            </a>
            <a className="nav__link" href={REPO_URL}>
              GitHub
            </a>
          </nav>

          <div className="hero__text" id="top">
            <Headline />
            <p className="hero__lede">
              Double-tap <kbd className="keycap">Right ⌘</kbd> on anything on your screen, drag around it, add a note. Your own AI
              model sorts it into a pocket and writes the prompt you will paste next time.
            </p>
            <div className="hero__actions">
              <a className="button button--cotton" href="#install">
                Get Pokke
              </a>
              <a className="button button--thread" href="#demo">
                Try a snip
              </a>
            </div>
            <p className="hero__small">Free and open source. macOS and Windows.</p>
          </div>
        </header>

        <main>
          <section className="section" id="demo" aria-labelledby="demo-title">
            <div className="section__head">
              <h2 id="demo-title">Try a snip</h2>
              <p>This is the capture screen. Drag around something in the feed and watch where it goes.</p>
            </div>
            <Demo />
          </section>

          <section className="section" aria-labelledby="steps-title">
            <div className="section__head">
              <h2 id="steps-title">Three moves, start to finish</h2>
            </div>
            <ol className="steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className="step">
                  <span className="step__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="section" aria-labelledby="pockets-title">
            <div className="section__head">
              <h2 id="pockets-title">Seven pockets, sorted for you</h2>
              <p>Every snip lands in one, with a title and tags. If the model guesses wrong, move it by hand.</p>
            </div>
            <ul className="pockets">
              {POCKETS.map((pocket) => (
                <li key={pocket.id} className="pocket-card cloth">
                  <span className="pocket-card__pattern">
                    <Pattern pattern={pocket.pattern} ground="var(--kon-shade)" opacity={0.6} />
                  </span>
                  <Stitch inset={7} radius={9} tone="soft" />
                  <span className="pocket-card__label">
                    <strong>{pocket.name}</strong>
                    <span>{POCKET_LINES[pocket.id]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="section section--split" aria-labelledby="model-title">
            <div className="section__head">
              <h2 id="model-title">Your model, your key</h2>
              <p>
                Snips are plain files on your disk. The image and your note go only to the model you choose. Pick a local one
                and nothing leaves your computer.
              </p>
            </div>
            <ul className="models">
              {PROVIDERS.map((provider) => (
                <li key={provider.id}>
                  <strong>{provider.name}</strong>
                  <span>{provider.blurb}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="section section--install" id="install" aria-labelledby="install-title">
            <div className="section__head">
              <h2 id="install-title">Clone and run</h2>
              <p>
                Needs Node 22 or newer. The first start downloads Electron. On macOS, allow Screen Recording and
                Accessibility when it asks.
              </p>
            </div>
            <Install />
          </section>
        </main>

        <footer className="footer">
          <span className="nav__brand">
            <Mark />
            Pokke
          </span>
          <a className="nav__link" href={REPO_URL}>
            Source on GitHub
          </a>
        </footer>
      </div>
    </MotionConfig>
  )
}
