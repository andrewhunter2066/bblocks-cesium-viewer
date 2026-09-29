# Cesium viewer — development plan

Agreed 2026-09-28. This repo is both an OGC Building Blocks register (`_sources/`) and the home of a
[bblocks-viewer](https://github.com/opengeospatial/bblocks-viewer) **view plugin** (`src/`) that
renders [topo-feature](https://github.com/ogcincubator/topo-feature) topology documents on a
CesiumJS globe. It is a sibling of the Three.js `TopoFeaturePlugin` in
[bblocks-viewer-topo-feature-plugin](https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin),
and is added to other registers the same way.

## Decisions

| Topic | Decision |
|---|---|
| Location | This repo (created from the OGC bblock template). Currently `andrewhunter2066/bblocks-cesium-viewer`; expected to move to `ogcincubator/bblocks-cesium-viewer` after development. |
| Isolation | bblocks-viewer-topo-feature-plugin is **not modified** by this work. |
| Branching | All development on `feature/cesium-viewer`, reviewed as a PR into `master`. |
| Layout | Plugin JavaScript in `src/js/` (tests alongside), CSS in `src/css/`; test harness in `harness/` (its script in `harness/js/`); `package.json`/`vite.config.js` at the root; building block in `_sources/cesiumViewerConfig/`. Template blocks `myFeature/` and `mySchema/` are removed. *(Stage 6:)* two demo blocks, `_sources/cesiumViewerDemo/parcel` and `…/utilityNetwork`, whose examples (the harness fixtures, by `ref`) open in the Globe tab with their own `viewer-config.json`; without them the dogfooded plugin would never show a tab in this register. |
| Dogfooding | This register declares its own plugin under `viewer.view-plugins` in `bblocks-config.yaml`. |
| Coordinates | Read each point feature's `geometry` — GeoJSON WGS84 (EPSG:4326) lon/lat + ellipsoidal height — straight into `Cartesian3.fromDegrees`. No proj4, no geoid model. Projected coordinates in `place` are ignored. Higher-order features (`geometry: null`) are assembled from their referenced points. A document with no point `geometry` does not match (no Globe tab). |
| Rule engine | **Copied** (not depended on) from bblocks-viewer-topo-feature-plugin branch `refactor/parameterised-viewer` at commit `d94018b`: `src/utils/rules.js`, `curie.js`, `config.js`, `resolve-config.js` plus their tests, into `src/js/utils/`. Each copied file carries a provenance header; later upstream fixes are ported by hand. |
| Per-block config | Same `resources[]` mechanism as the Three.js plugin (`context.bblock.resources`), extended with Cesium options (basemap, terrain, initial camera). Its JSON Schema is the `cesiumViewerConfig` building block. *(Stage 4:)* role `https://github.com/ogcincubator/bblocks-cesium-viewer/role/viewer-config`; a block with only a Three.js viewer config (that plugin's role) gets the same rules on the globe. Cesium options live under a top-level `cesium` key (`basemap`: `"osm"` / `"ion"` / `{ url, credit, maximumLevel }`; `terrain`: `"ellipsoid"` / `"ion"`; `camera`; `ionToken`) that the copied rule-config parser ignores. Invalid values are dropped with a console warning. |
| Cesium loading | Fetched at runtime from jsDelivr at a pinned version (not bundled), with `CESIUM_BASE_URL` pointed at the same CDN path for workers/assets/widget CSS. A prebuild script checks the pinned version against the `cesium` devDependency. |
| Default basemap | OpenStreetMap imagery + flat `EllipsoidTerrainProvider`, **no ion token**. Ion default imagery, geocoder, timeline and animation widgets explicitly disabled so CesiumJS never falls back to its demo token. |
| `elevation: "flatten"` | Clamp to ground (GroundPrimitive / GroundPolylinePrimitive, so it drapes over ion terrain too); `{ flattenTo: n }` = n metres above the ellipsoid. Flattened solids drop their zero-area walls and duplicate footprints. |

## Secrets policy

Anything a browser uses is visible in devtools, so the goal is **nothing secret in the repo** and
**any token used is low-value and restricted**.

- No credentials or tokens are ever committed. Cesium account logins are never used anywhere.
- Optional Cesium ion token (premium terrain/imagery only):
  - Local dev: gitignored `.env.local` → `VITE_CESIUM_ION_TOKEN`, or the harness's token box
    (stored only in that browser's `localStorage`). `.env.example` documents the variable, empty.
  - Published register: GitHub Actions secret, injected into the published config at build time
    as `cesium.ionToken` (the harness does the same with its token box). Ion imagery/terrain are
    used only when the config asks for them *and* has a token; if ion rejects the token, the
    plugin falls back to OSM and the ellipsoid with a console warning.
  - Tokens must be scoped `assets:read` and restricted to the register's domain in the ion dashboard.
- Guard rails: `.gitignore` covers `.env*`; enable GitHub secret scanning + push protection on the
  repo; gitleaks runs in CI.

## Local testing (nothing pushed, no register install)

1. **Unit tests** — `npm test` (Node's built-in runner): geometry assembly from `geometry`
   coordinates, rule application, config parsing.
2. **Harness** — `npm run dev`, open `harness/`: fixture / file / URL / config pickers and an
   optional token box, importing the plugin straight from `src/` with live reload.
3. **Real viewer** — `npm run build`, run `./build.sh` (postprocess Docker image,
   `--base-url http://localhost:9090/register/`), `npm run local-register`, then `./view.sh`.
   - Pointing the local build at the local plugin *(resolved in stage 1)*: `view.sh`'s viewer
     container serves the whole repo under `/register/` (nginx `alias`), so `dist/index.js` is
     reachable same-origin at `http://localhost:9090/register/dist/index.js` with a JS MIME type —
     no separate server or CORS. After each `./build.sh`, `npm run local-register` rewrites (or
     adds) this plugin's `viewer.viewPlugins` entry in `build-local/register.json` to that URL.
   - Relative `resources[].ref` *(verified in stage 6)*: the postprocessor rewrites it to an
     absolute URL under `--base-url` (`…/register/_sources/<block>/viewer-config.json`), in both
     `register.json` and the json-full document the viewer passes as `context.bblock`, and the
     plugin fetches it (end-to-end check in the real viewer).

Keep the browser devtools console open while testing — errors from the plugin's async code only
appear there.

## Stages (one commit each, all in the feature-branch PR)

0. **Setup** *(done)* — line endings (`.gitattributes`), feature branch, this plan, `CLAUDE.md`,
   bblocks skills, `.gitignore`.
1. **Scaffold** *(done)* — `package.json`, `vite.config.js`, empty `TopoFeatureCesiumPlugin` class with
   correct `supportedTypes`/`viewName`/`matches()`, harness page, `publish-dist.yml`, gitleaks CI
   step, `.env.example`; resolve the local-viewer open question above.
2. **Globe** *(done)* — runtime CDN load of CesiumJS, empty token-free globe in the harness, clean
   `destroy()`.
3. **Geometry** *(done)* — build Cesium entities/primitives from `geometry` coordinates via the topology
   references (with unit tests); copy fixtures from the topo repo and add a georeferenced version
   of `utility-network.json` (its current coordinates are local metres at 0,0).
4. **Rules & config** *(done)* — copy the rule engine, apply kind/group/style/visibility/label/elevation;
   per-block config and optional ion token.
5. **UI** *(done)* — group toggles, labels, zoom-to-extent, fullscreen, compact vs. expanded layout; plain
   DOM, no Vuetify/mdi.
6. **Building block & docs** *(done)* — `_sources/cesiumViewerConfig/` (schema, description, examples,
   tests), `bblocks-config.yaml` register metadata + `view-plugins` entry, README replacing the
   template's, CHANGELOG.

## Handover checklist (after development)

- [ ] OGC provides the `identifier-prefix` → set it in `bblocks-config.yaml` (currently the
      template placeholder `ogc.bbr.template.`), and update the `bblocks://ogc.bbr.template.…`
      links in `_sources/*/description.md`, `examples.yaml` and the demo blocks' `seeAlso`, and the
      demo URL in the README.
- [ ] Repo transferred to `ogcincubator/bblocks-cesium-viewer` → update the jsDelivr URL
      (`https://cdn.jsdelivr.net/gh/<owner>/bblocks-cesium-viewer@dist/…`) in
      `bblocks-config.yaml`, README and the workflow comment, and the repository links in
      `bblocks-config.yaml`'s description and `_sources/cesiumViewerConfig/bblock.json`.
- [ ] OGC adds the block to the official register.
- [ ] Secret scanning + push protection enabled on the final repo; ion token secret (if any)
      recreated there, restricted to the new domain.
- [ ] If the published register should show ion imagery/terrain: add a CI step that writes the
      secret into the relevant `viewer-config.json` as `cesium.ionToken` before the postprocessor
      runs (the reusable `process-bblocks.yml` has no hook for this yet).
