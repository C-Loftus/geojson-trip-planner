import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export interface Place {
  name: string
  detail: string
  lng: number
  lat: number
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: Record<string, string | undefined>
}

/** Photon (komoot) — free OSM geocoder designed for search-as-you-type. */
const PHOTON = 'https://photon.komoot.io/api/'

function toPlace(f: PhotonFeature): Place {
  const p = f.properties
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const name = p.name || street || p.city || p.state || p.country || 'Unnamed place'
  const parts = [p.name && street ? street : '', p.city, p.state, p.country].filter(
    (v, i, a): v is string => !!v && v !== name && a.indexOf(v) === i,
  )
  return { name, detail: parts.join(', '), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }
}

interface Props {
  onPick: (p: Place) => void
  /** Bias results toward this point (usually the map center). */
  getBias?: () => { lng: number; lat: number } | null
}

export function PlaceSearch({ onPick, getBias }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const listId = useId()
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      abort.current?.abort()
      const ctrl = (abort.current = new AbortController())
      const params = new URLSearchParams({ q: query, limit: '6', lang: 'en' })
      const bias = getBias?.()
      if (bias) {
        params.set('lat', bias.lat.toFixed(4))
        params.set('lon', bias.lng.toFixed(4))
      }
      setLoading(true)
      try {
        const r = await fetch(`${PHOTON}?${params}`, { signal: ctrl.signal })
        const data = (await r.json()) as { features: PhotonFeature[] }
        setResults(data.features.map(toPlace))
        setActive(-1)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([])
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function pick(p: Place) {
    onPick(p)
    setQ('')
    setResults([])
    setOpen(false)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const p = results[active] ?? results[0]
      if (p) pick(p)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && q.trim().length >= 2

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Search a place to add…"
        value={q}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      {showList && (
        <ul className="suggestions" id={listId} role="listbox">
          {results.map((p, i) => (
            <li
              key={`${p.lng},${p.lat},${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              // mousedown (not click) so it fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault()
                pick(p)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="s-name">{p.name}</span>
              {p.detail && <span className="s-detail">{p.detail}</span>}
            </li>
          ))}
          {!results.length && <li className="s-status">{loading ? 'Searching…' : 'No matches'}</li>}
        </ul>
      )}
    </div>
  )
}
