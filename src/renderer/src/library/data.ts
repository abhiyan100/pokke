import { useCallback, useEffect, useState } from 'react'
import type { SettingsPatch, SettingsView, Snip } from '@shared/types'
import { api } from '../bridge'

/** The snip list, kept current. Null until the first load finishes. */
export function useSnips(): Snip[] | null {
  const [snips, setSnips] = useState<Snip[] | null>(null)
  useEffect(() => {
    let alive = true
    void api.snips.list().then((list) => alive && setSnips(list))
    const unsubscribe = api.snips.onChange(setSnips)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])
  return snips
}

export interface SettingsHandle {
  settings: SettingsView | null
  save(patch: SettingsPatch): Promise<void>
  /** Replace the view after a call that already returned the new one. */
  replace(view: SettingsView): void
}

export function useSettings(): SettingsHandle {
  const [settings, setSettings] = useState<SettingsView | null>(null)
  useEffect(() => {
    void api.settings.get().then(setSettings)
  }, [])
  const save = useCallback(async (patch: SettingsPatch) => setSettings(await api.settings.save(patch)), [])
  return { settings, save, replace: setSettings }
}
