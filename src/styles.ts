export interface MapStyle {
  id: string
  label: string
  url: string
  dark: boolean
}

/** OpenFreeMap basemaps — free, no API key. https://openfreemap.org */
export const MAP_STYLES: MapStyle[] = [
  { id: 'liberty', label: 'Liberty', url: 'https://tiles.openfreemap.org/styles/liberty', dark: false },
  { id: 'bright', label: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright', dark: false },
  { id: 'positron', label: 'Positron', url: 'https://tiles.openfreemap.org/styles/positron', dark: false },
  { id: 'dark', label: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark', dark: true },
  { id: 'fiord', label: 'Fiord', url: 'https://tiles.openfreemap.org/styles/fiord', dark: true },
]

const KEY = 'geojson-trip-planner:style'

export function initialStyle(): MapStyle {
  try {
    const saved = MAP_STYLES.find((s) => s.id === localStorage.getItem(KEY))
    if (saved) return saved
  } catch {
    /* storage unavailable */
  }
  return MAP_STYLES[0] // Liberty (light)
}

export function saveStyle(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage unavailable */
  }
}

export type Theme = 'light' | 'dark'
const THEME_KEY = 'geojson-trip-planner:theme'

/** UI theme. Light unless the viewer has explicitly switched to dark. */
export function initialTheme(): Theme {
  try {
    if (localStorage.getItem(THEME_KEY) === 'dark') return 'dark'
  } catch {
    /* storage unavailable */
  }
  return 'light'
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* storage unavailable */
  }
}
