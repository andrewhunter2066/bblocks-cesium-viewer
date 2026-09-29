# Harness fixtures

- `georeferenced-square.json`, `projected-only-square.json`: small hand-made documents for the
  match/no-match check.
- `4-unit-up-down.json`, `cube*.json`, `derived-3d-solid.json`, `parcel.json`, `parcel-config.json`,
  `tetrahedron.json`, `utility-network-config.json`: copied unchanged from
  ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b `harness/fixtures/` (line endings
  normalised to LF). Their point `geometry` is already WGS84 lon/lat with ellipsoidal heights.
- `utility-network-georeferenced.json`: derived from that repo's `utility-network.json`, whose
  coordinates are local metres at 0,0. Each point keeps its original local coordinates in `place`,
  and `geometry` holds the exact east-north-up → WGS84 conversion with the local origin at
  115.8605 E, 31.9535 S, 10 m below the ellipsoid (so the pipes sit 2–10 m underground).

`parcel-config.json` and `utility-network-config.json` are the Three.js plugin's per-block rule
configs; the harness applies them automatically with their documents. Two Cesium-only configs
exercise the `cesium` options:

- `cesium-basemap-camera-config.json`: an OpenTopoMap basemap and a fixed initial camera over
  `parcel.json`'s lot (no token needed).
- `cesium-ion-config.json`: ion world imagery and terrain. Needs an ion token (the harness token
  box or `.env.local`); without one the plugin warns and falls back to OSM and the ellipsoid.
