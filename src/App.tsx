import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { decodeHash, EMPTY, encodeHash, fromGeoJSON, newId, toGeoJSON, type Itinerary, type Stop } from './geojson'
import { MapView, type MapViewHandle } from './MapView'
import { PlaceSearch, type Place } from './PlaceSearch'
import { applyTheme, initialStyle, initialTheme, MAP_STYLES, saveStyle, type Theme } from './styles'

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
  const [copied, setCopied] = useState(false)
  const mapView = useRef<MapViewHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const lastWritten = useRef(location.hash.slice(1))

  const { title, stops, showNumbers, showPath } = itin

  useEffect(() => applyTheme(theme), [theme])
  const setStops = (fn: (s: Stop[]) => Stop[]) => setItin((it) => ({ ...it, stops: fn(it.stops) }))
  const updateStop = (i: number, patch: Partial<Stop>) =>
    setStops((s) => s.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  // State -> URL (debounced, replaceState so typing doesn't spam history).
  useEffect(() => {
    const t = setTimeout(() => {
      const h = title || stops.length ? encodeHash(itin) : ''
      lastWritten.current = h
      history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search)
      document.title = title ? `${title} · Itinerary Map` : 'Itinerary Map'
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
    setStops((s) => [...s, { id: newId(), lng, lat, name, description: '' }])
  }, [])

  const reorder = (i: number, d: number) =>
    setStops((s) => {
      const j = i + d
      if (j < 0 || j >= s.length) return s
      const next = [...s]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  async function copyLink() {
    const h = encodeHash(itin)
    const url = `${location.origin}${location.pathname}#${h}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      prompt('Copy this link:', url)
    }
  }

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
    <div className="app">
      <aside>
        <header>
          <input
            className="title"
            placeholder="Untitled trip"
            maxLength={120}
            value={title}
            onChange={(e) => setItin((it) => ({ ...it, title: e.target.value }))}
          />
          <PlaceSearch onPick={addPlace} getBias={() => mapView.current?.center() ?? null} />
          <label className="row style-pick">
            <span>Basemap</span>
            <select
              value={mapStyle.id}
              onChange={(e) => {
                const s = MAP_STYLES.find((m) => m.id === e.target.value)!
                setMapStyle(s)
                saveStyle(s.id)
              }}
            >
              {MAP_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
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
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? '☾ Dark' : '☀ Light'}
            </button>
          </div>
        </header>

        <ol className="stops">
          {stops.length === 0 && <li className="empty">Click the map or search to add stops.</li>}
          {stops.map((s, i) => (
            <li key={s.id}>
              <button className="num" title="Show on map" onClick={() => mapView.current?.focus(i)}>
                {i + 1}
              </button>
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
              {copied ? 'Copied!' : 'Copy share link'}
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
            <button className="grow" onClick={download} disabled={!stops.length}>
              Download .geojson
            </button>
            <button className="grow" onClick={() => fileInput.current?.click()}>
              Import GeoJSON
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
          {stops.length > 0 && (
            <div className="meta">
              {stops.length} stop{stops.length === 1 ? '' : 's'} · click a pin for its description
            </div>
          )}
        </footer>
      </aside>

      <MapView
        ref={mapView}
        stops={stops}
        mapStyle={mapStyle}
        showNumbers={showNumbers}
        showPath={showPath}
        onAdd={addStop}
      />
    </div>
  )
}
