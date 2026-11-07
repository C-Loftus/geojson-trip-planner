import type { Feature, FeatureCollection, Geometry, LineString, Point } from 'geojson'
import { emojiToId, idToEmoji } from './icons'

export interface Stop {
  id: string
  lng: number
  lat: number
  name: string
  description: string
  /** Emoji shown on the map instead of the stop number; '' = show the number. */
  icon: string // the emoji itself; stored in GeoJSON as its code point ID
}

export interface Itinerary {
  title: string
  stops: Stop[]
  /** Display options, saved in the link so recipients see what the author chose. */
  showNumbers: boolean
  showPath: boolean
}

export const EMPTY: Itinerary = { title: '', stops: [], showNumbers: true, showPath: true }

export interface StopProps {
  name: string
  description?: string
  /** Unicode code point sequence of an emoji, e.g. "1F3E8" for 🏨. */
  icon?: string
}

export interface ItineraryCollection extends FeatureCollection<Point, StopProps> {
  /** Trip title. RFC 7946 §6.1 permits foreign members like this. */
  name?: string
  /** Only written when false; other GeoJSON tools ignore these foreign members. */
  showNumbers?: boolean
  showPath?: boolean
}

let nextId = 0
export const newId = () => `s${Date.now().toString(36)}${(nextId++).toString(36)}`

/** ~1 m precision keeps share links short. */
const r5 = (n: number) => Math.round(n * 1e5) / 1e5

export function toGeoJSON({ title, stops, showNumbers, showPath }: Itinerary): ItineraryCollection {
  const fc: ItineraryCollection = { type: 'FeatureCollection', features: [] }
  if (title) fc.name = title
  if (!showNumbers) fc.showNumbers = false
  if (!showPath) fc.showPath = false
  fc.features = stops.map((s) => {
    const properties: StopProps = { name: s.name }
    if (s.description) properties.description = s.description
    if (s.icon) properties.icon = emojiToId(s.icon)
    return {
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: [r5(s.lng), r5(s.lat)] },
    }
  })
  return fc
}

/**
 * Accepts any GeoJSON: a FeatureCollection, a single Feature, or a bare geometry.
 * Points become stops; MultiPoint/LineString vertices become stops too.
 */
export function fromGeoJSON(input: unknown): Itinerary {
  const gj = input as {
    type?: string
    features?: Feature[]
    name?: unknown
    properties?: Record<string, unknown>
    showNumbers?: unknown
    showPath?: unknown
  }
  if (!gj || typeof gj !== 'object' || !gj.type) throw new Error('Not GeoJSON')

  const feats: Feature[] =
    gj.type === 'FeatureCollection'
      ? (gj.features ?? [])
      : gj.type === 'Feature'
        ? [gj as Feature]
        : [{ type: 'Feature', properties: {}, geometry: gj as unknown as Geometry }]

  const stops: Stop[] = []
  for (const f of feats) {
    const g = f?.geometry
    if (!g) continue
    const p = (f.properties ?? {}) as Record<string, unknown>
    const name = String(p.name ?? p.title ?? '')
    const description = String(p.description ?? p.note ?? '')
    const icon = typeof p.icon === 'string' ? idToEmoji(p.icon) : ''
    const coords =
      g.type === 'Point' ? [g.coordinates] : g.type === 'MultiPoint' || g.type === 'LineString' ? g.coordinates : []
    coords.forEach((c, i) => {
      const lng = Number(c[0])
      const lat = Number(c[1])
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        stops.push({
          id: newId(),
          lng,
          lat,
          name: i ? '' : name,
          description: i ? '' : description,
          icon: i ? '' : icon,
        })
      }
    })
  }

  return {
    title: String(gj.name ?? gj.properties?.name ?? ''),
    stops,
    showNumbers: gj.showNumbers !== false,
    showPath: gj.showPath !== false,
  }
}

/** URL fragment = percent-encoded GeoJSON, leaving , : [ ] { } @ $ readable. */
export const encodeHash = (it: Itinerary) =>
  encodeURIComponent(JSON.stringify(toGeoJSON(it))).replace(/%(2C|3A|5B|5D|7B|7D|40|24)/g, (_, h: string) =>
    String.fromCharCode(parseInt(h, 16)),
  )

export const decodeHash = (hash: string) => fromGeoJSON(JSON.parse(decodeURIComponent(hash)))

/** Map-facing data: numbered points + a route line through them. */
export function mapData(stops: Stop[]) {
  const points: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: stops.map((s, i) => ({
      type: 'Feature',
      id: i,
      // `icon` is only present when set, so map filters can use ['has', 'icon'].
      properties: {
        idx: i,
        num: String(i + 1),
        name: s.name,
        description: s.description,
        ...(s.icon ? { icon: s.icon } : {}),
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  }
  const route: Feature<LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: stops.length > 1 ? stops.map((s) => [s.lng, s.lat]) : [] },
  }
  return { points, route }
}
