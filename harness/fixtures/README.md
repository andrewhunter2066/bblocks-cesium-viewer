# Harness fixtures

- `georeferenced-square.json`, `projected-only-square.json`: small hand-made documents for the
  match/no-match check.
- `4-unit-up-down.json`, `cube*.json`, `derived-3d-solid.json`, `parcel.json`, `tetrahedron.json`:
  copied unchanged from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b
  `harness/fixtures/` (line endings normalised to LF). Their point `geometry` is already WGS84
  lon/lat with ellipsoidal heights.
- `utility-network-georeferenced.json`: derived from that repo's `utility-network.json`, whose
  coordinates are local metres at 0,0. Each point keeps its original local coordinates in `place`,
  and `geometry` holds the exact east-north-up → WGS84 conversion with the local origin at
  115.8605 E, 31.9535 S, 10 m below the ellipsoid (so the pipes sit 2–10 m underground).

`parcel.json` and `utility-network-georeferenced.json` are also the examples of the register's
demo blocks (`_sources/cesiumViewerDemo/`). Their rule configs — that repo's `parcel-config.json`
and `utility-network-config.json`, unchanged — live there as each block's `viewer-config.json`,
and the harness applies them automatically. The Cesium-only sample configs are the
`cesiumViewerConfig` block's examples (`_sources/cesiumViewerConfig/examples/`).
