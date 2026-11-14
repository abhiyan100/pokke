import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { doubleTapKeysFor, type Permissions, type SettingsView } from '@shared/types'
import { api, doubleTapLabel, isMac, shortcutKeys } from '../bridge'
import { Stitch } from '../ui/Stitch'
import { CheckIcon, CloseIcon } from '../ui/icons'
import { fade, sheet } from '../ui/motion'
import type { SettingsHandle } from './data'
import { ModelSetup } from './ModelSetup'

/** Re-reads permissions every couple of seconds, since they change outside the app. */
export function usePermissions(): Permissions | null {
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  useEffect(() => {
    let alive = true
    const read = () => void api.settings.permissions().then((next) => alive && setPermissions(next))
    read()
    const timer = setInterval(read, 2000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])
  return permissions
}

interface AccessRowProps {
  title: string
  detail: string
  granted: boolean
  onAllow(): void
}

export function AccessRow({ title, detail, granted, onAllow }: AccessRowProps) {
  return (
    <div className="row">
      <div className="row__text">
        <p className="row__title">{title}</p>
        <p className="row__detail">{detail}</p>
      </div>
      {granted ? (
        <span className="row__done">
          <CheckIcon />
          Allowed
        </span>
      ) : (
        <button className="button button--ink" onClick={onAllow}>
          Allow
        </button>
      )}
    </div>
  )
}

/** The two macOS permissions. Renders nothing on other platforms. */
export function AccessRows({ permissions, doubleTap }: { permissions: Permissions | null; doubleTap: string }) {
  if (!isMac || !permissions) return null
  return (
    <>
      <AccessRow
        title="Screen recording"
        detail="Lets a snip see what is on screen."
        granted={permissions.screen}
        onAllow={() => void api.settings.askPermission('screen')}
      />
      <AccessRow
        title="Accessibility"
        detail={`Lets the app notice the ${doubleTap} double-tap.`}
        granted={permissions.accessibility}
        onAllow={() => void api.settings.askPermission('accessibility')}
      />
    </>
  )
}

interface SettingsSheetProps {
  settings: SettingsView
  handle: SettingsHandle
  onClose(): void
}

export function SettingsSheet({ settings, handle, onClose }: SettingsSheetProps) {
  const permissions = usePermissions()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      className="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fade}
      onClick={onClose}
    >
      <motion.aside
        className="slip slip--settings"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        initial={{ x: 60 }}
        animate={{ x: 0 }}
        exit={{ x: 60 }}
        transition={sheet}
        onClick={(event) => event.stopPropagation()}
      >
        <Stitch inset={8} radius={13} tone="ink" />
        <div className="slip__scroll">
          <div className="slip__top">
            <h1 className="settings__title">Settings</h1>
            <button className="icon-button icon-button--ink" aria-label="Close settings" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>

          <section className="settings__section" aria-labelledby="settings-model">
            <h2 id="settings-model">Model</h2>
            <p className="settings__lede">Who looks at each snip, files it, and writes its prompt.</p>
            <ModelSetup settings={settings} handle={handle} />
          </section>

          <section className="settings__section" aria-labelledby="settings-shortcut">
            <h2 id="settings-shortcut">Snip shortcut</h2>
            <div className="row">
              <div className="row__text">
                <p className="row__title">
                  Double-tap <kbd className="keycap keycap--ink">{doubleTapLabel(settings.doubleTapKey)}</kbd>
                </p>
                {permissions && !permissions.doubleTapAvailable && (
                  <p className="row__detail">Not available on this computer. The shortcut below still works.</p>
                )}
                {permissions && permissions.doubleTapAvailable && settings.doubleTap && !permissions.doubleTapActive && (
                  <p className="row__detail">Starts once Accessibility is allowed below.</p>
                )}
                {isMac && settings.doubleTap && settings.doubleTapKey === 'meta' && (
                  <p className="row__detail">If Siri opens too, pick another key here or change Siri's shortcut.</p>
                )}
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={settings.doubleTap}
                aria-label="Double-tap to snip"
                onClick={() => void handle.save({ doubleTap: !settings.doubleTap })}
              />
            </div>
            {settings.doubleTap && (
              <div className="keys" role="radiogroup" aria-label="Key to double-tap">
                {doubleTapKeysFor(api.platform).map((key) => (
                  <button
                    key={key}
                    className="keys__option"
                    role="radio"
                    aria-checked={key === settings.doubleTapKey}
                    onClick={() => void handle.save({ doubleTapKey: key })}
                  >
                    {doubleTapLabel(key)}
                  </button>
                ))}
              </div>
            )}
            <div className="row">
              <div className="row__text">
                <p className="row__title">Always available</p>
                {permissions && !permissions.shortcutActive && (
                  <p className="row__detail">Another app is using this shortcut, so it is off here.</p>
                )}
              </div>
              <span className="row__keys">
                {shortcutKeys(settings.shortcut).map((key) => (
                  <kbd className="keycap keycap--ink" key={key}>
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          </section>

          {isMac && (
            <section className="settings__section" aria-labelledby="settings-access">
              <h2 id="settings-access">Access</h2>
              <AccessRows permissions={permissions} doubleTap={doubleTapLabel(settings.doubleTapKey)} />
            </section>
          )}
        </div>
      </motion.aside>
    </motion.div>
  )
}
