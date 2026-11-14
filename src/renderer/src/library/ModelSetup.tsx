import { useEffect, useState } from 'react'
import { PROVIDERS, providerInfo, type ProviderId, type SettingsView } from '@shared/types'
import { api } from '../bridge'
import { CheckIcon, RetryIcon } from '../ui/icons'
import type { SettingsHandle } from './data'

/** True when a model is chosen and has everything it needs to be called. */
export function modelReady(settings: SettingsView): boolean {
  if (!settings.provider || !settings.model) return false
  return providerInfo(settings.provider).key !== 'required' || settings.keySaved[settings.provider]
}

type ModelList = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; ids: string[] } | { state: 'error'; message: string }

/**
 * Choosing who looks at the snips: pick a service, give it a key or an
 * address, pick one of the models it offers right now.
 */
export function ModelSetup({ settings, handle }: { settings: SettingsView; handle: SettingsHandle }) {
  const provider = settings.provider
  const info = provider ? providerInfo(provider) : null
  const usable = info !== null && (info.key !== 'required' || settings.keySaved[info.id])

  const [key, setKey] = useState('')
  const [address, setAddress] = useState(settings.baseUrl)
  const [models, setModels] = useState<ModelList>({ state: 'idle' })
  const [reload, setReload] = useState(0)

  useEffect(() => setAddress(settings.baseUrl), [settings.baseUrl])
  useEffect(() => setKey(''), [provider])

  useEffect(() => {
    if (!provider || !usable) {
      setModels({ state: 'idle' })
      return
    }
    let alive = true
    setModels({ state: 'loading' })
    api.settings
      .models(provider)
      .then((ids) => {
        if (!alive) return
        setModels({ state: 'ready', ids })
        // Nothing chosen yet: take the service's best model. A model the user
        // typed by hand is kept even when the service does not list it.
        const first = ids[0]
        if (first && settings.model === '') void handle.save({ model: first })
      })
      .catch((error: unknown) => {
        if (alive) setModels({ state: 'error', message: readable(error) })
      })
    return () => {
      alive = false
    }
    // The model is deliberately not a dependency: choosing one must not refetch the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, usable, settings.baseUrl, settings.keySaved[provider ?? 'custom'], reload])

  const saveKey = async () => {
    if (!provider || !key.trim()) return
    handle.replace(await api.settings.setKey(provider, key))
    setKey('')
  }

  return (
    <div className="model-setup">
      <div className="providers" role="radiogroup" aria-label="Model service">
        {PROVIDERS.map((option) => (
          <button
            key={option.id}
            className="provider"
            role="radio"
            aria-checked={option.id === provider}
            onClick={() => void handle.save({ provider: option.id as ProviderId })}
          >
            <span className="provider__name">{option.name}</span>
            <span className="provider__blurb">{option.blurb}</span>
          </button>
        ))}
      </div>

      {info?.editableUrl && (
        <div className="field">
          <label htmlFor="model-address">Address</label>
          <input
            id="model-address"
            type="text"
            value={address}
            spellCheck={false}
            placeholder={info.defaultBaseUrl}
            onChange={(event) => setAddress(event.target.value)}
            onBlur={() => {
              if (address.trim() !== settings.baseUrl) void handle.save({ baseUrl: address.trim() })
            }}
          />
        </div>
      )}

      {info && info.key !== 'none' && (
        <form
          className="field"
          onSubmit={(event) => {
            event.preventDefault()
            void saveKey()
          }}
        >
          <label htmlFor="model-key">{info.key === 'optional' ? 'API key, if the server needs one' : 'API key'}</label>
          <div className="field__row">
            <input
              id="model-key"
              type="password"
              value={key}
              autoComplete="off"
              spellCheck={false}
              placeholder={settings.keySaved[info.id] ? 'Saved. Paste a new key to replace it' : 'Paste your key'}
              onChange={(event) => setKey(event.target.value)}
            />
            <button className="button button--ink" type="submit" disabled={!key.trim()}>
              Save key
            </button>
          </div>
          <p className="field__hint">
            {info.editableUrl
              ? 'Stored encrypted on this computer and sent only to the address above. Change the address and it is asked for again.'
              : `Stored encrypted on this computer. Sent only to ${info.name}.`}
          </p>
        </form>
      )}

      {usable && (
        <div className="field">
          <label htmlFor="model-id">Model</label>
          <div className="field__row">
            {models.state === 'ready' && models.ids.length > 0 ? (
              <select id="model-id" value={settings.model} onChange={(event) => void handle.save({ model: event.target.value })}>
                {(models.ids.includes(settings.model) || !settings.model ? models.ids : [settings.model, ...models.ids]).map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="model-id"
                type="text"
                defaultValue={settings.model}
                key={`${provider}:${settings.model}`}
                spellCheck={false}
                placeholder={models.state === 'loading' ? 'Loading models…' : 'Model name'}
                onBlur={(event) => {
                  const next = event.target.value.trim()
                  if (next !== settings.model) void handle.save({ model: next })
                }}
              />
            )}
            <button
              className="icon-button icon-button--ink"
              type="button"
              aria-label="Reload models"
              title="Reload models"
              onClick={() => setReload((count) => count + 1)}
            >
              <RetryIcon />
            </button>
          </div>
          {models.state === 'error' && <p className="field__hint field__hint--problem">{models.message}</p>}
          {models.state === 'ready' && models.ids.length === 0 && (
            <p className="field__hint">No models found there. Type a model name, or add one and reload.</p>
          )}
        </div>
      )}

      {modelReady(settings) && (
        <p className="model-setup__ready">
          <CheckIcon />
          New snips are filed by {settings.model}
        </p>
      )}
    </div>
  )
}

function readable(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // Electron prefixes errors that cross the bridge; show only what the app wrote.
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
