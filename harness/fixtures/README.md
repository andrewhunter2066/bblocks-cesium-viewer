# Harness fixtures

- `georeferenced-square.json`, `projected-only-square.json`: small hand-made documents for the
  match/no-match check.
- `4-unit-up-down.json`, `cube*.json`, `derived-3d-solid.json`, `parcel.json`, `tetrahedron.json`:
  copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b `harness/fixtures/` (line
  endings normalised to LF). Their point `geometry` is WGS84 lon/lat.
  - Upstream, the `geometry` heights of all but `derived-3d-solid.json` were AHD (equal to the
    `place` heights), not ellipsoidal. They have been converted to ellipsoidal heights with
    h = H + N, using each site's AUSGeoid2020 ellipsoid–geoid separation N from the Geoscience
    Australia Geodetic Calculator. `place` (projected, AHD) is unchanged.

    | File | N (m) | AHD → ellipsoidal (m) |
    |---|---|---|
    | `4-unit-up-down.json` | −31.101 | 20.0 / 23.0 / 26.0 → −11.101 / −8.101 / −5.101 |
    | `cube.json` | −31.289 | 2.5 / 12.5 → −28.789 / −18.789 |
    | `cube-with-protrusion.json` | −31.35 | 10.5–20.5 → −20.85 – −10.85 |
    | `cube-with-void.json` | −31.316 | 6.0–16.0 → −25.316 – −15.316 |
    | `tetrahedron.json` | −31.291 | 7.0 / 15.165 → −24.291 / −16.126 |
    | `parcel.json` | −32.89 | 17.5–32.9 → −15.39 – 0.01 |

  - `derived-3d-solid.json` is unchanged: its `geometry` heights were already ellipsoidal upstream
    (the same site as `parcel.json`, N ≈ −32.89).
- `utility-network-georeferenced.json`: derived from that repo's `utility-network.json`, whose
  coordinates are local metres at 0,0. Each point keeps its original local coordinates in `place`,
  and `geometry` holds the exact east-north-up → WGS84 conversion with the local origin at
  115.8605 E, 31.9535 S, 10 m below the ellipsoid (so the pipes sit 2–10 m underground).

`parcel.json` and `utility-network-georeferenced.json` are also the examples of the register's
demo blocks (`_sources/cesiumViewerDemo/`). Their rule configs — that repo's `parcel-config.json`
and `utility-network-config.json`, unchanged — live there as each block's `viewer-config.json`,
and the harness applies them automatically. The Cesium-only sample configs are the
`cesiumViewerConfig` block's examples (`_sources/cesiumViewerConfig/examples/`).
