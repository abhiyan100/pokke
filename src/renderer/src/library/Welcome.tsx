import { motion } from 'motion/react'
import type { SettingsView } from '@shared/types'
import pocketPhoto from '../assets/empty-pocket.jpg'
import { doubleTapLabel, shortcutKeys } from '../bridge'
import { CheckIcon } from '../ui/icons'
import { fade, settle } from '../ui/motion'
import type { SettingsHandle } from './data'
import { modelReady } from './ModelSetup'
import { AccessRows, usePermissions } from './SettingsSheet'

interface WelcomeProps {
  settings: SettingsView
  handle: SettingsHandle
  onChooseModel(): void
}

/** First run: the few things to allow before the first snip, on one card. */
export function Welcome({ settings, handle, onChooseModel }: WelcomeProps) {
  const permissions = usePermissions()
  const ready = modelReady(settings)

  return (
    <motion.div className="scrim scrim--centre" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
      <motion.section
        className="welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        initial={{ y: 24, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={settle}
      >
        <img className="welcome__photo" src={pocketPhoto} alt="" />
        <div className="welcome__body">
          <h1 id="welcome-title">Snip it. It files itself.</h1>
          <p className="welcome__lede">
            Double-tap <kbd className="keycap keycap--ink">{doubleTapLabel(settings.doubleTapKey)}</kbd> anywhere, drag around what you want to keep,
            add a note. It lands in a pocket with a prompt ready to paste.
          </p>

          <AccessRows permissions={permissions} doubleTap={doubleTapLabel(settings.doubleTapKey)} />

          <div className="row">
            <div className="row__text">
              <p className="row__title">A model to file your snips</p>
              <p className="row__detail">Claude, OpenAI, Gemini, or one running on this computer.</p>
            </div>
            {ready ? (
              <span className="row__done">
                <CheckIcon />
                {settings.model}
              </span>
            ) : (
              <button className="button button--ink" onClick={onChooseModel}>
                Choose
              </button>
            )}
          </div>

          <button className="button button--primary welcome__go" onClick={() => void handle.save({ welcomed: true })}>
            Start snipping
          </button>
          <p className="welcome__foot">
            Or press{' '}
            {shortcutKeys(settings.shortcut).map((key) => (
              <kbd className="keycap keycap--ink" key={key}>
                {key}
              </kbd>
            ))}{' '}
            any time.
          </p>
        </div>
      </motion.section>
    </motion.div>
  )
}
