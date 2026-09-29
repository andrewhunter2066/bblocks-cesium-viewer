# Design notes

This repository is both an OGC Building Blocks register (`_sources/`) and the home of a
[bblocks-viewer](https://github.com/opengeospatial/bblocks-viewer) **view plugin** (`src/`) that
draws [topo-feature](https://github.com/ogcincubator/topo-feature) topology documents on a
CesiumJS globe. It is the geographic sibling of the Three.js `TopoFeaturePlugin` in
[bblocks-viewer-topo-feature-plugin](https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin),
and is added to other registers the same way. This page records why things are the way they are;
the [README](../README.md) covers how to use and develop them.

## Decisions

### Coordinates

Each point feature's `geometry` — GeoJSON WGS84 (EPSG:4326) longitude, latitude and **ellipsoidal**
height — goes straight into `Cartesian3.fromDegrees`. There is no proj4 and no geoid model: the
plugin never converts coordinates. Projected coordinates in `place` are ignored. Higher-order
features (edges, rings, faces, shells, solids, parcels — all `geometry: null`) are assembled from
the points they reference. A document with no WGS84 point `geometry` does not match, so it gets no
Globe tab.

Data must therefore carry ellipsoidal heights in `geometry`. The Perth fixtures copied from the
Three.js plugin had AHD heights there; they were converted with h = H + N using each site's
AUSGeoid2020 separation (see [`harness/fixtures/README.md`](../harness/fixtures/README.md)).
Around Perth the ellipsoid lies roughly 31–33 m below the ground, so correctly placed features sit
below the default flat globe. Cesium still draws them on top of it; with ion terrain, which also
uses ellipsoidal heights, they sit on the ground.

### Loading CesiumJS

CesiumJS is fetched at runtime from jsDelivr at a pinned version (`src/js/utils/cesium-version.js`)
rather than bundled, keeping `dist/index.js` small (about 40 kB). `CESIUM_BASE_URL` points at the
same CDN path, so Cesium's workers, assets and widget CSS come from there too; its cross-origin
workers start through Cesium's own blob-URL shim. A `prebuild` script fails the build if the pinned
version and the `cesium` devDependency differ. When the host provides `context.depResolver`, Cesium
is shared through it under the name `cesium` (patch-level range, since Cesium's monthly minor
releases can break APIs).

### No token by default

The default view is OpenStreetMap imagery (capped at zoom 19, the deepest level the tile server
has) on the flat `EllipsoidTerrainProvider`, with no Cesium ion token. The base-layer picker,
geocoder, timeline and animation widgets are disabled, and `Ion.defaultAccessToken` — which
Cesium ships set to its own shared demo token — is always replaced, by the configured token or by
an empty string, so the demo token is never sent. Ion imagery or terrain is used only when a
configuration asks for it *and* supplies a token; if ion rejects the token or is unreachable, the
view falls back to OpenStreetMap and the ellipsoid with a console warning.

### Rule engine

Which features are drawn, and how, is decided by the Three.js plugin's rule engine, **copied**
rather than depended on — that plugin is not published as a package, and the Globe view must be
able to ship on its own schedule. `rules.js`, `curie.js`, `config.js`, `resolve-config.js` and
`default-config.js` (with their tests) and `mime-type-match.js` were copied unchanged from
bblocks-viewer-topo-feature-plugin (branch `refactor/parameterised-viewer`, commit `d94018b`) into
`src/js/utils/`. Each carries a provenance header; later upstream fixes are ported by hand.
`detect-topo.js` and the topology traversal in `topo-geometry.js` are adapted rather than copied,
because this plugin reads WGS84 `geometry` instead of re-centred local coordinates.

### Per-block configuration

A block configures its Globe view through the same `bblock.json` `resources` mechanism as the
Three.js plugin, delivered to the plugin as `context.bblock.resources`, under the role
`https://github.com/ogcincubator/bblocks-cesium-viewer/role/viewer-config`. A block that only has a
Three.js view configuration (that plugin's role) gets the same rules on the globe, so existing
configurations need no duplication; a Globe-specific resource wins when both exist.

The rule configuration (`rules`, `defaults`, `kindOrder`) is unchanged. Globe-only options live
under a top-level `cesium` key — `basemap`, `terrain`, `camera` and `ionToken` — which the copied
rule parser ignores. Nothing in a configuration can break the view: an unreachable or invalid file,
or an invalid option, falls back to the defaults with a console warning. The JSON Schema is the
`cesiumViewerConfig` building block, and `src/js/block-schema.test.js` keeps it and the code in
step.

### Elevation

`elevation: "flatten"` clamps a feature to the ground with `GroundPrimitive` /
`GroundPolylinePrimitive`, so it drapes over ion terrain as well as the ellipsoid.
`{ "flattenTo": n }` places it n metres above the ellipsoid with ordinary primitives. Flattening a
solid collapses its walls to lines and stacks its top and bottom faces, so zero-area polygons and
duplicate polygons and edges are dropped rather than drawn over one another.

### Geometry

Faces use `CoplanarPolygonGeometry`, which triangulates any planar polygon including vertical
walls (`PolygonGeometry` only handles polygons roughly parallel to the ellipsoid). Edges are
straight 3D polylines (`ArcType.NONE`), not geodesics. The globe renders on demand
(`requestRenderMode`), so an idle tab costs no GPU time.

### User interface

Plain DOM and CSS (`src/js/ui/`, `src/css/`), with no host framework: a plugin runs outside the
viewer's component tree. The CSS is bundled into `dist/index.js` through a static `?raw` import. The
layout follows the space the host gives the view, not which control produced it: at 400 px or
taller (the host's full-screen dialog, or the plugin's own fullscreen) the layers panel is always
shown; in the compact ~300 px tab it is a pop-over behind the layers button, and the built-in
groups get inline toggles. This mirrors the Three.js plugin.

### The register

The register declares its own plugin under `viewer.view-plugins` in `bblocks-config.yaml`
(dogfooding). Besides the `cesiumViewerConfig` schema block it has two demo blocks,
`cesiumViewerDemo/parcel` and `cesiumViewerDemo/utilityNetwork`: without examples that are
topo-feature documents, the Globe tab would never appear in this register. Each demo block's
example is a harness fixture (by `ref`, not a copy) with its own `viewer-config.json`; one block per
document, because a block has a single viewer configuration.

## Secrets policy

Anything a browser uses is visible to its users, so the goal is **nothing secret in the
repository** and **any token in use is low-value and restricted**.

- No credentials or tokens are ever committed. Cesium account logins are never used anywhere.
- A Cesium ion token is optional, needed only for ion imagery or terrain:
  - **Local development:** a gitignored `.env.local` (`VITE_CESIUM_ION_TOKEN`, documented empty in
    `.env.example`) or the harness's token box (kept in that browser's `localStorage`). They are
    never compiled into `dist/`. The harness injects the token into the configuration it hands the
    plugin; `npm run local-register` injects it into copies of the blocks' configurations in the
    gitignored `build-local/ion-configs/` for the local viewer, never into `_sources/`.
  - **Published register:** a GitHub Actions secret, written into the published configuration as
    `cesium.ionToken` at build time — the harness does the same with its token box. The reusable
    `process-bblocks.yml` workflow has no step for this yet.
  - **Scope:** create dedicated tokens, never the account's default token. Scope `assets:read` only;
    resources limited to the assets used (Cesium World Terrain, asset 1, and Bing Maps Aerial,
    asset 2); allowed URLs limited to the register's origin. Use a separate development token
    allowed only on `http://localhost:5199` (harness) and `http://localhost:9090` (local viewer).
    URL restrictions rely on the browser's `Referer`, so they make a token low-value, not secret:
    revoke and replace one that is misused.
- Guard rails: `.gitignore` covers `.env*`; gitleaks scans the whole history in CI; GitHub secret
  scanning and push protection should be enabled on the repository.

## Verified integration behaviour

- `view.sh`'s bblocks-viewer container serves the whole repository under `/register/` (an nginx
  `alias`), so a local `dist/index.js` is reachable same-origin at
  `http://localhost:9090/register/dist/index.js` with a JavaScript MIME type — no separate server or
  CORS setup. `npm run local-register` points `build-local/register.json` at it after each
  `./build.sh`.
- A relative `resources[].ref` in `bblock.json` is rewritten by the postprocessor to an absolute URL
  under `--base-url` (`…/register/_sources/<block>/viewer-config.json`), in both `register.json` and
  the json-full document the viewer passes as `context.bblock`, and the plugin fetches it. This was
  checked end to end in the real viewer; whether a published register serves `_sources/` at that
  URL should be confirmed after the first publish.
