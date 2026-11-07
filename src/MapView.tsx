import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  AttributionControl,
  GeolocateControl,
  LngLatBounds,
  Map as MlMap,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { mapData, type Stop } from './geojson'
import type { MapStyle } from './styles'

setWorkerUrl(workerUrl)

const ACCENT = '#2f6fde'
const L = { route: 'itin-route', circle: 'itin-circle', num: 'itin-num', label: 'itin-label' } as const
const HIT_LAYERS = [L.circle, L.num, L.label]

export interface MapViewHandle {
  fit: () => void
  focus: (i: number) => void
  center: () => { lng: number; lat: number } | null
}

interface Props {
  stops: Stop[]
  mapStyle: MapStyle
  showNumbers: boolean
  showPath: boolean
  onAdd: (lng: number, lat: number) => void
}

export const MapView = forwardRef<MapViewHandle, Props>(function MapView(props, ref) {
  const { stops, mapStyle, showNumbers, showPath } = props
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const popupRef = useRef<Popup | null>(null)
  // Latest props for long-lived map event handlers.
  const latest = useRef(props)
  latest.current = props

  const fit = () => {
    const map = mapRef.current
    const s = latest.current.stops
    if (!map || !s.length) return
    if (s.length === 1) {
      map.flyTo({ center: [s[0].lng, s[0].lat], zoom: Math.max(map.getZoom(), 11) })
      return
    }
    const b = new LngLatBounds()
    s.forEach((p) => b.extend([p.lng, p.lat]))
    map.fitBounds(b, { padding: 60, maxZoom: 14 })
  }

  useImperativeHandle(ref, () => ({
    fit,
    focus: (i) => {
      const s = latest.current.stops[i]
      const map = mapRef.current
      if (!s || !map) return
      map.flyTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 12) })
      showPopup(i)
    },
    center: () => {
      const map = mapRef.current
      if (!map || map.getZoom() < 3) return null
      const c = map.getCenter()
      return { lng: c.lng, lat: c.lat }
    },
  }))

  function showPopup(i: number) {
    const map = mapRef.current
    const s = latest.current.stops[i]
    if (!map || !s) return
    const el = document.createElement('div')
    el.className = 'popup'
    const h = document.createElement('strong')
    h.textContent = s.name || `Stop ${i + 1}`
    el.appendChild(h)
    if (s.description) {
      const p = document.createElement('p')
      p.textContent = s.description
      el.appendChild(p)
    }
    popupRef.current?.remove()
    popupRef.current = new Popup({ offset: 14, maxWidth: '280px' })
      .setLngLat([s.lng, s.lat])
      .setDOMContent(el)
      .addTo(map)
  }

  /** Apply the numbers/path toggles to existing layers. */
  function applyToggles(map: MlMap) {
    const { showNumbers: nums, showPath: path } = latest.current
    if (!map.getLayer(L.circle)) return
    map.setLayoutProperty(L.route, 'visibility', path ? 'visible' : 'none')
    map.setLayoutProperty(L.num, 'visibility', nums ? 'visible' : 'none')
    map.setPaintProperty(L.circle, 'circle-radius', nums ? 12 : 7)
    map.setLayoutProperty(L.label, 'text-offset', [0, nums ? 1.3 : 0.9])
  }

  function addLayers(map: MlMap) {
    const { points, route } = mapData(latest.current.stops)
    const dark = latest.current.mapStyle.dark
    map.addSource('itin-route', { type: 'geojson', data: route })
    map.addSource('itin-points', { type: 'geojson', data: points })
    map.addLayer({
      id: L.route,
      type: 'line',
      source: 'itin-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ACCENT, 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 0.85 },
    })
    map.addLayer({
      id: L.circle,
      type: 'circle',
      source: 'itin-points',
      paint: {
        'circle-radius': 12,
        'circle-color': ACCENT,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })
    map.addLayer({
      id: L.num,
      type: 'symbol',
      source: 'itin-points',
      layout: {
        'text-field': ['get', 'num'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': '#ffffff' },
    })
    map.addLayer({
      id: L.label,
      type: 'symbol',
      source: 'itin-points',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 13,
        'text-anchor': 'top',
        'text-offset': [0, 1.3],
        'text-max-width': 12,
        'text-optional': true,
      },
      paint: {
        'text-color': dark ? '#f2f2ee' : '#1d1d1b',
        'text-halo-color': dark ? '#111111' : '#ffffff',
        'text-halo-width': 1.6,
      },
    })
    applyToggles(map)
  }

  // Create the map once.
  useEffect(() => {
    if (!container.current) return
    const map = new MlMap({
      container: container.current,
      style: latest.current.mapStyle.url,
      center: [-98.35, 39.5],
      zoom: 3,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new NavigationControl(), 'top-right')
    map.addControl(new GeolocateControl({}), 'top-right')
    map.addControl(new ScaleControl({}), 'bottom-left')
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')

    map.on('style.load', () => addLayers(map))
    map.once('load', fit)

    const canvas = map.getCanvasContainer()
    for (const id of HIT_LAYERS) {
      map.on('mouseenter', id, () => (canvas.style.cursor = 'pointer'))
      map.on('mouseleave', id, () => (canvas.style.cursor = ''))
    }

    // Click: popup on a stop, otherwise add a stop.
    map.on('click', (e) => {
      const layers = HIT_LAYERS.filter((id) => map.getLayer(id))
      const hit = map.queryRenderedFeatures(e.point, { layers })[0]
      if (hit) showPopup(Number(hit.properties.idx))
      else latest.current.onAdd(e.lngLat.lng, e.lngLat.lat)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap basemap style; our layers are re-added on 'style.load'.
  const firstStyle = useRef(true)
  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false
      return
    }
    mapRef.current?.setStyle(mapStyle.url, { diff: false })
  }, [mapStyle.url])

  useEffect(() => {
    if (mapRef.current) applyToggles(mapRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNumbers, showPath])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const { points, route } = mapData(stops)
    ;(map.getSource('itin-points') as GeoJSONSource | undefined)?.setData(points)
    ;(map.getSource('itin-route') as GeoJSONSource | undefined)?.setData(route)
    popupRef.current?.remove()
  }, [stops])

  return <div ref={container} className="map" />
})
