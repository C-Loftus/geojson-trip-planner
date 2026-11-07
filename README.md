# geojson-trip-planner

Plan a trip on a map and share it as a link. The whole itinerary is stored as GeoJSON in the URL, so there's no server or account.

- Search for places, or right-click the map (long-press on touch screens) to add stops
- Give each stop a name, description, and optional icon (click its number)
- Share the link, or download/import a `.geojson` file
- Copy a prompt for agents that teaches an LLM the GeoJSON format, so it can write trips for you

Built with [MapLibre GL JS](https://maplibre.org), [OpenFreeMap](https://openfreemap.org) tiles, and [Photon](https://photon.komoot.io) search.

## Development

```sh
npm install
npm run dev
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. In the repo's Settings → Pages, set the source to **GitHub Actions**.
