# bblocks-cesium-viewer

A **Globe** view for [topo-feature](https://github.com/ogcincubator/topo-feature) topology documents
in the [OGC Building Blocks viewer](https://github.com/opengeospatial/bblocks-viewer), built on
CesiumJS — plus the Building Blocks register that documents its configuration and demonstrates it.

The `TopoFeatureCesiumPlugin` is a bblocks-viewer
[view plugin](https://github.com/ogcincubator/bblocks-view-plugin-starter). It adds a **Globe** tab
to any example or transform output that is a topo-feature document whose points carry WGS84
`geometry`, and draws its solids, surfaces, faces, rings and parcels at their real positions and
heights on the globe. It is the geographic sibling of the Three.js topology view,
[bblocks-viewer-topo-feature-plugin](https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin),
and shares its rule configuration.

- **No account or token needed.** OpenStreetMap imagery on the flat WGS84 ellipsoid by default;
  Cesium ion imagery and terrain are optional.
- **Real coordinates.** Each point's `geometry` (longitude, latitude, ellipsoidal height) is used
  as is — no re-centring, projection or geoid model. Projected `place` coordinates are ignored, and
  a document with no WGS84 point geometry gets no Globe tab.
- **Rule-driven.** Which features are drawn, how they are coloured, labelled, grouped, initially
  shown or flattened onto the ground, is set by the same rules as the Three.js view — built in, or
  per block.
- **Controls.** Zoom to extent, labels, edges and fullscreen, and a layers panel with per-group,
  per-kind and per-feature visibility and zoom. The panel is always shown when the view has room
  (the host's full-screen dialog, or fullscreen) and is a pop-over in the compact tab.

## Adding the Globe view to a register

Declare the plugin in the register's `bblocks-config.yaml`:

```yaml
viewer:
  view-plugins:
    - url: https://cdn.jsdelivr.net/gh/andrewhunter2066/bblocks-cesium-viewer@dist/index.js
      export: TopoFeatureCesiumPlugin
```

The URL serves the latest build of `master` (see [Publishing](#publishing)). The repository is
expected to move to `ogcincubator/bblocks-cesium-viewer`; the URL changes with it.

CesiumJS itself (1.145.0) is loaded at runtime from jsDelivr, so viewers need to reach
`cdn.jsdelivr.net` and, for the default basemap, `tile.openstreetmap.org`.

## Configuring a block

A block can tune its Globe view with a JSON configuration declared in its `bblock.json`:

```json
"resources": [
  {
    "role": "https://github.com/ogcincubator/bblocks-cesium-viewer/role/viewer-config",
    "ref": "viewer-config.json",
    "format": "application/json",
    "title": "Globe view configuration"
  }
]
```

A relative `ref` is resolved by the postprocessor to an absolute URL, which the plugin fetches. The
configuration's JSON Schema, with documentation and examples, is this register's
**Cesium globe viewer configuration** block ([`_sources/cesiumViewerConfig/`](_sources/cesiumViewerConfig/)).
In short:

```json
{
  "rules": [
    {
      "source": "parcels",
      "geometry": "polygon",
      "kind": "parcel-created",
      "group": "parcel",
      "kindLabel": "Created",
      "match": { "property": "properties.parcelState", "values": ["wa-parcel-state:created"] },
      "label": { "properties": ["properties.appellation.label"], "fallback": "id" },
      "style": { "color": "#0a6ff6", "opacity": 0.5, "lineColor": "#06102b", "lineStyle": "dashed" },
      "initiallyVisible": true,
      "elevation": "flatten"
    }
  ],
  "cesium": {
    "basemap": "osm",
    "terrain": "ellipsoid",
    "camera": { "longitude": 115.7967, "latitude": -31.8952, "height": 150, "heading": 20, "pitch": -30 }
  }
}
```

- `rules`, `defaults` and `kindOrder` are the Three.js view's rule configuration, unchanged. A block
  that already has a configuration for that view (its own resource role) gets the same rules on the
  globe; a Globe-specific resource takes precedence.
- `cesium` holds the globe-only options: `basemap` (`osm`, `ion`, or an https XYZ tile template),
  `terrain` (`ellipsoid` or `ion`), the initial `camera`, and `ionToken`.
- Problems never break the view: an unreachable or invalid configuration, or an invalid option,
  falls back to the defaults with a warning in the browser console.

The demo blocks in [`_sources/cesiumViewerDemo/`](_sources/cesiumViewerDemo/) are complete
examples: a cadastral parcel and an underground utility network, each with its own configuration.

### Cesium ion (optional)

Ion imagery (`"basemap": "ion"`) and terrain (`"terrain": "ion"`) need a Cesium ion access token.
Without one — or if ion rejects it — the view falls back to OpenStreetMap and the ellipsoid, with a
console warning. Cesium's built-in demo token is never used.

**Never commit a token.** Anything a browser uses is visible to its users, so a token must be
low-value and restricted: scoped to `assets:read` and limited to the register's domain in the ion
dashboard. A published register should inject it into the configuration at build time
(`cesium.ionToken`) from a CI secret. The standard `process-bblocks.yml` workflow has no step for
this yet; a register that needs ion must add one before the postprocessor runs.

## Development

Requires Node.js 22 or later.

```bash
npm install
npm test            # unit tests (Node's built-in runner)
npm run typecheck
npm run dev         # the harness, with live reload
npm run build       # -> dist/ (deploy the whole directory)
```

### Harness

`npm run dev` opens `harness/`, which drives the real plugin from `src/` the way the viewer does.
It offers topo-feature fixtures (each georeferenced near Perth, Western Australia), your own file or
URL, sample configurations (the demo blocks' and the configuration block's examples), your own
configuration file or URL, an ion token box, and a "Tab size" switch that mimics the viewer's 300 px
tab. The current plugin instance is available in the browser console as `harness.plugin`.

For ion content locally, either use the token box (kept only in that browser's `localStorage`) or
copy `.env.example` to `.env.local` and set `VITE_CESIUM_ION_TOKEN`. Both are gitignored and never
part of `dist/`. The harness injects the token into the configuration as `cesium.ionToken`, as a
published register's build would.

### In the real viewer

```bash
npm run build           # the plugin -> dist/
./build.sh              # the register -> build-local/ (postprocessor, Docker)
npm run local-register  # point build-local/register.json at the local dist/
./view.sh               # the viewer at http://localhost:9090
```

Then open, for example, <http://localhost:9090/bblock/ogc.bbr.template.cesiumViewerDemo.parcel>,
choose **Examples** and the **Globe** tab. `view.sh`'s container serves this whole repository under
`/register/`, so the local plugin is loaded same-origin from
`http://localhost:9090/register/dist/index.js`. Re-run `npm run local-register` after every
`./build.sh`. Keep the browser's developer console open: errors from the plugin's asynchronous work
only appear there.

## Repository layout

| Path | Contents |
|---|---|
| `src/js/` | The plugin (`index.js` exports `TopoFeatureCesiumPlugin`), with unit tests alongside |
| `src/js/utils/` | Topology assembly, rule engine, configuration loading, Cesium loading and options |
| `src/js/ui/` | The controls and layers panel (plain DOM, no host framework) |
| `src/css/` | The plugin's stylesheet, bundled into `dist/index.js` |
| `harness/` | Development harness and fixtures |
| `scripts/` | Build and test helpers |
| `_sources/` | The Building Blocks: `cesiumViewerConfig` (configuration schema) and `cesiumViewerDemo/*` |
| `docs/design.md` | Design decisions, secrets policy and verified integration behaviour |

The rule engine (`src/js/utils/rules.js`, `curie.js`, `config.js`, `resolve-config.js`,
`default-config.js` and their tests) is copied unchanged from bblocks-viewer-topo-feature-plugin at
commit `d94018b`; each file says so in its header, and later upstream fixes are ported by hand.

## Publishing

- `.github/workflows/ci.yml` runs the tests, type check and build, and a gitleaks scan of the whole
  history, on every push and pull request.
- `.github/workflows/publish-dist.yml` builds `dist/` on every push to `master` and force-pushes it
  to the `dist` branch, which jsDelivr serves at the URL above. There is no release gate: consumers
  get whatever is on `master`.
- `.github/workflows/process-bblocks.yml` builds and publishes the register itself.

This repository was created from the [OGC Building Blocks template](https://github.com/opengeospatial/bblocks-template);
see its [usage notes](https://github.com/opengeospatial/bblocks-template/blob/master/USAGE.md) for
how the register tooling works.
