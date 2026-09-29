The **Globe** view (`TopoFeatureCesiumPlugin`) draws [topo-feature](https://github.com/ogcincubator/topo-feature)
documents on a CesiumJS globe in the Building Blocks viewer. Each point is placed by its WGS84
`geometry` (longitude, latitude, ellipsoidal height), and edges, rings, faces, shells, solids and
parcels are assembled from their topology references. This block is the JSON Schema for the
optional per-block configuration that tunes that view.

## Attaching a configuration to a block

Add a `resources` entry to the block's `bblock.json`, next to its examples:

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

A block that already has a configuration for the Three.js topology view (role
`https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin/role/viewer-config`) gets the
same rules on the globe; a Globe-specific resource takes precedence when both are present. See the
[demo blocks](bblocks://ogc.bbr.template.cesiumViewerDemo.parcel) for complete examples.

## Rules

`rules` is an ordered list. For each feature in a rule's `source` collection (`solids`, `parcels`,
`faces`, `rings`, …, or the derived `surfaces` — shells that no solid uses) the first rule whose
`match` applies decides how it is drawn:

| Member | Meaning |
|---|---|
| `kind`, `group`, `kindLabel` | How the feature is listed in the view's Layers panel. Rules sharing a `group` appear under one heading, with a sub-list per `kind`. |
| `geometry` | `solid`, `open-shell`, `polygon` (a Polygon-topology parcel), `face` or `ring`. |
| `match` | `{ "property": "properties.x", "values": [...] }`. Values may be literals, CURIEs (expanded against the document's own `@context`) or full URIs. |
| `label` | Property paths to take the feature's label from, with a `fallback` (default `id`). |
| `style` | `color` and `opacity` of the fill; `lineColor` and `lineStyle` (`solid` / `dashed`) of the outline. |
| `initiallyVisible` | `false` hides the feature until it is ticked in the Layers panel. |
| `elevation` | `preserve` (default), `flatten` (clamp to the ground) or `{ "flattenTo": n }` (n metres above the ellipsoid). |

A feature no rule claims is not drawn. A non-empty `rules` list replaces the view's built-in rules;
`defaults.style` and `defaults.elevation` apply under every rule.

## Globe options (`cesium`)

| Member | Default | Meaning |
|---|---|---|
| `basemap` | `"osm"` | `"osm"`, `"ion"` (Cesium ion world imagery), or `{ "url": "https://…/{z}/{x}/{y}.png", "credit": "…", "maximumLevel": n }`. |
| `terrain` | `"ellipsoid"` | `"ellipsoid"` (flat) or `"ion"` (Cesium World Terrain). |
| `camera` | frame the data | `{ "longitude", "latitude", "height", "heading", "pitch", "roll" }` in degrees and metres. |
| `ionToken` | none | Cesium ion token, needed only for `ion` imagery or terrain. |

Everything works without a token. `ion` imagery or terrain without a token — or with one ion
rejects — falls back to OpenStreetMap and the flat ellipsoid, with a warning in the browser
console. **Never commit a token**: a register that wants ion content injects it into the published
configuration at build time from a CI secret. Anything a browser uses is visible to its users, so
the token must be scoped to `assets:read` and restricted to the register's domain.
