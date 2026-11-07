import { emojiToId, ICONS } from './icons'
import { encodeHash, newId, type Itinerary } from './geojson'

const EXAMPLE: Itinerary = {
  title: 'Weekend in Chicago',
  showNumbers: true,
  showPath: true,
  stops: [
    {
      id: newId(),
      lng: -87.62398,
      lat: 41.88257,
      name: 'Cloud Gate',
      description: 'Start at "The Bean" in Millennium Park.',
      icon: '📷',
    },
    {
      id: newId(),
      lng: -87.62379,
      lat: 41.87963,
      name: 'Art Institute',
      description: 'Allow 3 hours.\nTickets online.',
      icon: '🏛️',
    },
    { id: newId(), lng: -87.60972, lat: 41.89167, name: 'Navy Pier', description: '', icon: '' },
  ],
}

/** Instructions an LLM/agent can use to read and write trips for this app. */
export function agentPrompt(appUrl: string) {
  const exampleJson = JSON.stringify(JSON.parse(decodeURIComponent(encodeHash(EXAMPLE))), null, 2)
  const exampleLink = `${appUrl}#${encodeHash(EXAMPLE)}`

  return `You are helping with GeoJSON Trip Planner (${appUrl}), a stateless web app for sharing map itineraries. A trip is stored entirely as GeoJSON in the URL fragment (after "#"). There is no server, API, or account: to create or edit a trip, produce GeoJSON or a share link.

## GeoJSON schema

A trip is an RFC 7946 FeatureCollection:

- \`type\`: "FeatureCollection" (required)
- \`name\`: string, optional. The trip title.
- \`showNumbers\`: boolean, optional, default true. false hides stop numbers on the map (plain stops become small dots).
- \`showPath\`: boolean, optional, default true. false hides the dashed line connecting the stops.
- \`features\`: array of stops, IN TRIP ORDER (the first feature is stop 1). Each stop is a Feature:
  - \`geometry\`: { "type": "Point", "coordinates": [longitude, latitude] }. Longitude comes FIRST. Use 5 decimal places (about 1 m).
  - \`properties.name\`: string. The label drawn on the map (keep it short, at most 80 characters).
  - \`properties.description\`: string, optional. Shown in a popup when the stop is clicked (at most 500 characters; "\\n" for line breaks).
  - \`properties.icon\`: string, optional. An emoji shown instead of the stop number, written as its Unicode code point sequence: uppercase hex, hyphen-separated, including any FE0F/ZWJ code points (the same "unified" IDs as Unicode emoji data, Twemoji and Noto). Examples: 🏨 = "1F3E8", 🏛️ = "1F3DB-FE0F", 🇯🇵 = "1F1EF-1F1F5". Any emoji works. Leave it out to show the number. Suggested:
${ICONS.map((e) => `    ${e} ${emojiToId(e)}`).join('\n')}

Omit optional fields instead of writing empty strings, to keep links short. Only Point features are used. When importing, the app also accepts LineString/MultiPoint (each vertex becomes a stop) and \`title\`/\`note\` as aliases for \`name\`/\`description\`.

## Share links

Link = ${appUrl}# + encodeURIComponent(JSON.stringify(featureCollection))

- Use compact JSON (no whitespace).
- The app also leaves , : [ ] { } @ $ unescaped in the fragment, but fully percent-encoded links work the same.
- To read a link, take everything after "#", apply decodeURIComponent, then JSON.parse.
- Some chat apps cut off links longer than about 2,000 characters. For long trips, give a .geojson file to import instead (Import button in the app).

## Example

${exampleJson}

As a link:
${exampleLink}

## Guidelines

- Use real, accurate coordinates for places. If you're unsure of a location, say so instead of guessing.
- Order the stops in the sequence they will be visited.
- When asked for a trip, reply with the share link and, if useful, the GeoJSON in a code block.
`
}
