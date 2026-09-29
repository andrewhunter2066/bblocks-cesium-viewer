# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — 0.1.0

First version: a CesiumJS Globe view for topo-feature documents, and the register that documents it.

### Added

- **Plugin scaffold** — `TopoFeatureCesiumPlugin` (tab "Globe"), matching topo-feature documents
  whose points carry WGS84 `geometry`; Vite library build; development harness; CI with tests and a
  gitleaks secret scan; `dist` branch publishing for jsDelivr; `npm run local-register` for testing
  in the real viewer.
- **Globe** — CesiumJS 1.145.0 loaded at runtime from jsDelivr (shared through the host's
  `depResolver` when available); OpenStreetMap on the flat ellipsoid with no ion token, and
  Cesium's demo token never used; safe `destroy()` at any point, and an error banner if loading
  fails.
- **Geometry** — points, edges, rings, faces, shells (including nested and open shells), solids and
  Polygon-topology parcels assembled from topology references at their WGS84 positions and
  ellipsoidal heights; the camera frames the data. Georeferenced fixtures, including a
  georeferenced copy of the Three.js view's utility network.
- **Rules and configuration** — the Three.js view's rule engine (copied at `d94018b`) for kinds,
  groups, labels, styles, initial visibility and elevation (`flatten` clamps to the ground,
  `{ flattenTo }` to a height); per-block configuration via `bblock.json` `resources`, also
  accepting a Three.js view configuration; `cesium` options for basemap, terrain, initial camera and
  an optional ion token, falling back to OpenStreetMap and the ellipsoid if ion is unavailable.
- **UI** — toolbar (zoom to extent, labels, edges, group toggles, layers, fullscreen) and a layers
  panel with per-group, per-kind and per-feature visibility and zoom; compact and expanded layouts
  following the space available; keyboard accessible; plain DOM and CSS.
- **Building blocks** — `cesiumViewerConfig`, the configuration's JSON Schema with documentation,
  examples and tests; `cesiumViewerDemo.parcel` and `cesiumViewerDemo.utilityNetwork`, which show
  the Globe view with their own configurations. The register declares its own plugin.
- **Design notes** — `docs/design.md`: design decisions, secrets policy (including how to scope an
  ion token) and verified integration behaviour.

### Removed

- The template's `myFeature` and `mySchema` building blocks.
