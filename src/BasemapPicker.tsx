import { useState } from 'react'
import { MAP_STYLES, type MapStyle } from './styles'

interface Props {
  value: MapStyle
  onChange: (s: MapStyle) => void
  className?: string
}

/** Layers icon over the map that opens a list of basemaps. */
export function BasemapPicker({ value, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`basemap ${className}`}>
      <button
        className="map-btn"
        title="Change basemap"
        aria-label="Change basemap"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 2 8.5 12 14l10-5.5L12 3Z" />
          <path d="m2 13.5 10 5.5 10-5.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="picker-backdrop" onClick={() => setOpen(false)} />
          <ul className="basemap-menu" role="listbox" aria-label="Basemap">
            {MAP_STYLES.map((s) => (
              <li key={s.id}>
                <button
                  role="option"
                  aria-selected={s.id === value.id}
                  className={s.id === value.id ? 'selected' : ''}
                  onClick={() => {
                    onChange(s)
                    setOpen(false)
                  }}
                >
                  <span className={`swatch swatch-${s.id}`} />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
