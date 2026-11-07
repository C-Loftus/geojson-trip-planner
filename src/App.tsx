import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { decodeHash, EMPTY, encodeHash, fromGeoJSON, newId, toGeoJSON, type Itinerary, type Stop } from './geojson'
import { agentPrompt } from './agentPrompt'
import { BasemapPicker } from './BasemapPicker'
import { firstEmoji, ICONS } from './icons'
import { MapView, type MapViewHandle } from './MapView'
import { PlaceSearch, type Place } from './PlaceSearch'
import { applyTheme, initialStyle, initialTheme, saveStyle, type Theme } from './styles'

const PANEL_KEY = 'geojson-trip-planner:panel'
function initialPanelOpen() {
  try {
    return localStorage.getItem(PANEL_KEY) !== 'closed'
  } catch {
    return true
  }
}

function readHash(): Itinerary {
  const h = location.hash.slice(1)
  if (!h) return EMPTY
  try {
    return decodeHash(h)
  } catch (err) {
    console.error(err)
    alert('This link appears to be corrupted.')
    return EMPTY
  }
}

export default function App() {
  const [itin, setItin] = useState<Itinerary>(readHash)
  const [mapStyle, setMapStyle] = useState(initialStyle)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [copied, setCopied] = useState<'link' | 'prompt' | null>(null)
  const [panelOpen, setPanelOpen] = useState(initialPanelOpen)
  /** Index of the stop whose icon picker is open. */
  const [picker, setPicker] = useState<number | null>(null)
  const mapView = useRef<MapViewHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const lastWritten = useRef(location.hash.slice(1))

  const { title, stops, showNumbers, showPath } = itin

  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, panelOpen ? 'open' : 'closed')
    } catch {
      /* storage unavailable */
    }
  }, [panelOpen])
  const setStops = (fn: (s: Stop[]) => Stop[]) => setItin((it) => ({ ...it, stops: fn(it.stops) }))
  const updateStop = (i: number, patch: Partial<Stop>) =>
    setStops((s) => s.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  // State -> URL (debounced, replaceState so typing doesn't spam history).
  useEffect(() => {
    const t = setTimeout(() => {
      const h = title || stops.length ? encodeHash(itin) : ''
      lastWritten.current = h
      history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search)
      document.title = title ? `${title} · GeoJSON Trip Planner` : 'GeoJSON Trip Planner'
    }, 250)
    return () => clearTimeout(t)
  }, [itin, title, stops.length])

  // URL -> state when the user pastes a different link into the same tab.
  useEffect(() => {
    const onHash = () => {
      if (location.hash.slice(1) === lastWritten.current) return
      setItin(readHash())
      setTimeout(() => mapView.current?.fit(), 50)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const addStop = useCallback((lng: number, lat: number, name = '') => {
    setStops((s) => [...s, { id: newId(), lng, lat, name, description: '', icon: '' }])
  }, [])

  const reorder = (i: number, d: number) =>
    setStops((s) => {
      const j = i + d
      if (j < 0 || j >= s.length) return s
      const next = [...s]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  async function copy(text: string, what: 'link' | 'prompt') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1200)
    } catch {
      prompt('Copy this:', text)
    }
  }
  const appUrl = () => `${location.origin}${location.pathname}`
  const copyLink = () => copy(`${appUrl()}#${encodeHash(itin)}`, 'link')
  const copyPrompt = () => copy(agentPrompt(appUrl()), 'prompt')

  function download() {
    const blob = new Blob([JSON.stringify(toGeoJSON(itin), null, 2)], { type: 'application/geo+json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'itinerary').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-') || 'itinerary'}.geojson`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importFile(file: File) {
    try {
      const next = fromGeoJSON(JSON.parse(await file.text()))
      if (!next.stops.length) return alert('No points found in that file.')
      setItin(next)
      setTimeout(() => mapView.current?.fit(), 50)
    } catch {
      alert('Could not read that file as GeoJSON.')
    }
  }

  function addPlace(p: Place) {
    addStop(p.lng, p.lat, p.name)
    setTimeout(() => mapView.current?.focus(stops.length), 50)
  }

  return (
    <div className={`app${panelOpen ? '' : ' panel-closed'}`}>
      <aside aria-hidden={!panelOpen}>
        <header>
          <div className="row">
            <input
              className="title"
              placeholder="Untitled trip"
              maxLength={120}
              value={title}
              onChange={(e) => setItin((it) => ({ ...it, title: e.target.value }))}
            />
            <button
              className="panel-arrow"
              title="Hide side panel"
              aria-label="Hide side panel"
              onClick={() => setPanelOpen(false)}
            >
              <span>‹</span>
            </button>
          </div>
          <PlaceSearch onPick={addPlace} getBias={() => mapView.current?.center() ?? null} />
          <div className="row toggles">
            <label>
              <input
                type="checkbox"
                checked={showNumbers}
                onChange={(e) => setItin((it) => ({ ...it, showNumbers: e.target.checked }))}
              />
              Numbers
            </label>
            <label>
              <input
                type="checkbox"
                checked={showPath}
                onChange={(e) => setItin((it) => ({ ...it, showPath: e.target.checked }))}
              />
              Path
            </label>
            <button
              className="theme-btn"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? '☾' : '☀'}
            </button>
          </div>
        </header>

        <ol className="stops">
          {stops.length === 0 && <li className="empty">Search, or right-click the map, to add stops.</li>}
          {stops.map((s, i) => (
            <li key={s.id}>
              <button
                className={`num${s.icon ? ' has-icon' : ''}`}
                title="Change icon"
                aria-haspopup="true"
                aria-expanded={picker === i}
                onClick={() => setPicker(picker === i ? null : i)}
              >
                {s.icon || i + 1}
              </button>
              {picker === i && (
                <>
                  <div className="picker-backdrop" onClick={() => setPicker(null)} />
                  <div
                    className={`icon-picker${i > 1 && i >= stops.length - 2 ? ' up' : ''}`}
                    role="dialog" aria-label={`Icon for stop ${i + 1}`}>
                    <button
                      className={`icon-opt num-opt${s.icon ? '' : ' selected'}`}
                      title="Show number"
                      onClick={() => {
                        updateStop(i, { icon: '' })
                        setPicker(null)
                      }}
                    >
                      {i + 1}
                    </button>
                    {ICONS.map((ic) => (
                      <button
                        key={ic}
                        className={`icon-opt${s.icon === ic ? ' selected' : ''}`}
                        onClick={() => {
                          updateStop(i, { icon: ic })
                          setPicker(null)
                        }}
                      >
                        {ic}
                      </button>
                    ))}
                    <input
                      className="picker-any"
                      placeholder="Or type / paste any emoji…"
                      aria-label="Any emoji"
                      onChange={(e) => {
                        const emoji = firstEmoji(e.target.value)
                        if (emoji) {
                          updateStop(i, { icon: emoji })
                          setPicker(null)
                        }
                      }}
                    />
                    <button
                      className="picker-show"
                      onClick={() => {
                        setPicker(null)
                        mapView.current?.focus(i)
                      }}
                    >
                      Show on map
                    </button>
                  </div>
                </>
              )}
              <div className="fields">
                <input
                  placeholder={`Stop ${i + 1}`}
                  maxLength={80}
                  value={s.name}
                  onChange={(e) => updateStop(i, { name: e.target.value })}
                />
                <textarea
                  rows={1}
                  placeholder="Description"
                  maxLength={500}
                  value={s.description}
                  onChange={(e) => updateStop(i, { description: e.target.value })}
                />
              </div>
              <div className="ctrls">
                <button title="Move up" disabled={i === 0} onClick={() => reorder(i, -1)}>
                  ▲
                </button>
                <button title="Move down" disabled={i === stops.length - 1} onClick={() => reorder(i, 1)}>
                  ▼
                </button>
                <button className="del" title="Remove" onClick={() => setStops((all) => all.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>

        <footer>
          <div className="row">
            <button className="primary grow" onClick={copyLink} disabled={!stops.length && !title}>
              {copied === 'link' ? 'Copied!' : 'Copy share link'}
            </button>
            <button title="Zoom to all stops" onClick={() => mapView.current?.fit()}>
              Fit
            </button>
            <button
              title="Remove all stops"
              onClick={() => stops.length && confirm('Remove all stops?') && setItin((it) => ({ ...it, stops: [] }))}
            >
              Clear
            </button>
          </div>
          <div className="row">
            <button className="grow" title="Download as a .geojson file" onClick={download} disabled={!stops.length}>
              Download
            </button>
            <button className="grow" title="Import a .geojson file" onClick={() => fileInput.current?.click()}>
              Import
            </button>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".geojson,.json,application/geo+json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) importFile(f)
              }}
            />
          </div>
          <button
            title="Copy instructions that teach an AI assistant this app's GeoJSON format and link scheme"
            onClick={copyPrompt}
          >
            {copied === 'prompt' ? 'Copied!' : 'Copy prompt for agents'}
          </button>
          {stops.length > 0 && (
            <div className="meta">
              {stops.length} stop{stops.length === 1 ? '' : 's'} · right-click the map to add a stop
            </div>
          )}
        </footer>
      </aside>

      <div className="map-wrap">
        {!panelOpen && (
          <button
            className="panel-arrow panel-open map-btn"
            title="Show side panel"
            aria-label="Show side panel"
            onClick={() => setPanelOpen(true)}
          >
            <span>›</span>
          </button>
        )}
        <BasemapPicker
          className={panelOpen ? '' : 'shifted'}
          value={mapStyle}
          onChange={(s) => {
            setMapStyle(s)
            saveStyle(s.id)
          }}
        />
        <MapView
          ref={mapView}
          stops={stops}
          mapStyle={mapStyle}
          showNumbers={showNumbers}
          showPath={showPath}
          onAdd={addStop}
        />
      </div>
    </div>
  )
}
