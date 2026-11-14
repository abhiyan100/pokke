import { AnimatePresence, LayoutGroup, MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { pocketById, type PocketId } from '@shared/pockets'
import { api, doubleTapLabel } from '../bridge'
import { Grid } from './Grid'
import { modelReady } from './ModelSetup'
import { Roll } from './Roll'
import { SettingsSheet } from './SettingsSheet'
import { SnipSheet } from './SnipSheet'
import { TopBar } from './TopBar'
import { Welcome } from './Welcome'
import { useSettings, useSnips } from './data'
import { relatedSnips, searchSnips } from './snips'

export function App() {
  const snips = useSnips()
  const handle = useSettings()
  const { settings } = handle

  const [pocket, setPocket] = useState<PocketId | null>(null)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // The app can ask the library to show something: a snip from the corner thumbnail, or settings.
  useEffect(
    () =>
      api.nav.onOpen((target) => {
        if (target.view === 'snip') setOpenId(target.id)
        else setSettingsOpen(true)
      }),
    []
  )

  if (!snips || !settings) return <div className="app cloth" aria-busy="true" />

  const searching = query.trim() !== ''
  const list = searching ? searchSnips(snips, query) : pocket ? snips.filter((snip) => snip.pocket === pocket) : snips
  const open = openId ? snips.find((snip) => snip.id === openId) : undefined

  const step = (direction: -1 | 1) => {
    const next = list[list.findIndex((snip) => snip.id === openId) + direction]
    if (next) setOpenId(next.id)
  }

  const home = () => {
    setQuery('')
    setPocket(null)
  }

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div className="app cloth">
          <TopBar
            query={query}
            onQuery={setQuery}
            shortcut={settings.shortcut}
            onSettings={() => setSettingsOpen(true)}
            onHome={home}
          />

          {searching ? (
            <Grid
              key="search"
              pocket={null}
              heading={`“${query.trim()}”`}
              snips={list}
              onBack={home}
              onOpenSnip={setOpenId}
              empty={<p>Nothing matches. Search looks at titles, tags, notes and prompts.</p>}
            />
          ) : pocket ? (
            <Grid
              key={pocket}
              pocket={pocketById(pocket)}
              heading={pocketById(pocket).name}
              snips={list}
              onBack={home}
              onOpenSnip={setOpenId}
              empty={<p>This pocket is empty. Snips the model files as {pocketById(pocket).name} land here.</p>}
            />
          ) : (
            <Roll
              snips={snips}
              doubleTap={settings.doubleTap ? doubleTapLabel(settings.doubleTapKey) : null}
              onOpenPocket={setPocket}
              onOpenSnip={setOpenId}
            />
          )}

          <AnimatePresence>
            {open && (
              <SnipSheet
                key="snip"
                snip={open}
                related={relatedSnips(open, snips)}
                hasModel={modelReady(settings)}
                onClose={() => setOpenId(null)}
                onStep={step}
                onOpen={setOpenId}
                onSettings={() => {
                  setOpenId(null)
                  setSettingsOpen(true)
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!settings.welcomed && !settingsOpen && (
              <Welcome key="welcome" settings={settings} handle={handle} onChooseModel={() => setSettingsOpen(true)} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {settingsOpen && (
              <SettingsSheet key="settings" settings={settings} handle={handle} onClose={() => setSettingsOpen(false)} />
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </MotionConfig>
  )
}
