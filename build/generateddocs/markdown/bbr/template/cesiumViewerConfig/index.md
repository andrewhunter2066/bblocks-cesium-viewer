
# Cesium globe viewer configuration (Schema)

`ogc.bbr.template.cesiumViewerConfig` *v0.1*

Per-block configuration for the bblocks-viewer Globe view of topo-feature documents: which features are drawn and how (rules shared with the Three.js topology view), plus the globe's basemap, terrain and initial camera.

[*Status*](http://www.opengis.net/def/status): Under development

## Description

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

## Examples

### Parcel rules
Rules from the Three.js topology view's cadastral example, used unchanged by the Globe view:
parcels are grouped under one heading with a kind per `parcelState` (matched as CURIEs),
flattened onto the ground, with former-tenure parcels dashed and initially hidden. This is the
configuration of the [parcel demo block](bblocks://ogc.bbr.template.cesiumViewerDemo.parcel).

#### json
```json
{
  "rules": [
    {
      "source": "parcels",
      "geometry": "polygon",
      "match": {
        "property": "properties.parcelState",
        "values": [
          "wa-parcel-state:created"
        ]
      },
      "kind": "parcel-created",
      "group": "parcel",
      "kindLabel": "Created",
      "initiallyVisible": true,
      "elevation": "flatten",
      "style": {
        "color": "#0a6ff6",
        "opacity": 0.5,
        "lineColor": "#06102b"
      },
      "label": {
        "properties": [
          "properties.appellation.label",
          "properties.appellation",
          "properties.description",
          "properties.name"
        ],
        "fallback": "id"
      }
    },
    {
      "source": "parcels",
      "geometry": "polygon",
      "match": {
        "property": "properties.parcelState",
        "values": [
          "wa-parcel-state:former-tenure"
        ]
      },
      "kind": "parcel-former-tenure",
      "group": "parcel",
      "kindLabel": "Former Tenure",
      "initiallyVisible": false,
      "elevation": "flatten",
      "style": {
        "color": "#dadcfd",
        "opacity": 0.35,
        "lineColor": "#0d1424",
        "lineStyle": "dashed"
      },
      "label": {
        "properties": [
          "properties.appellation.label",
          "properties.appellation",
          "properties.description",
          "properties.name"
        ],
        "fallback": "id"
      }
    },
    {
      "source": "solids",
      "geometry": "solid",
      "match": {
        "property": "properties.description",
        "values": [
          "Solid for Lot 800 on Plan DP 431276"
        ]
      },
      "kind": "solid",
      "initiallyVisible": true,
      "style": {

        "color": "#960f00",
        "opacity": 1.0
      },
      "label": {
        "properties": [
          "properties.appellation.label",
          "properties.appellation",
          "properties.description",
          "properties.name"
        ],
        "fallback": "id"
      }
    },
    {
      "source": "surfaces",
      "geometry": "open-shell",
      "match": {
        "property": "properties.description",
        "values": [
          "Surface Shell of Ground Surface"
        ]
      },
      "kind": "surface",
      "initiallyVisible": false,
      "style": {
        "color": "#006e0c",
        "opacity": 0.75
      },
      "label": {
        "properties": [
          "properties.appellation.label",
          "properties.appellation",
          "properties.description",
          "properties.name"
        ],
        "fallback": "id"
      }
    }
  ]
}

```


### Utility network rules
A non-cadastral configuration: underground pipes classified by `assetCondition`, matching a
literal, a CURIE and a full URI. Decommissioned pipes start hidden; planned pipes are clamped
to the ground. This is the configuration of the
[utility network demo block](bblocks://ogc.bbr.template.cesiumViewerDemo.utilityNetwork).

#### json
```json
{
  "defaults": {
    "style": {
      "opacity": 1
    }
  },
  "rules": [
    {
      "source": "solids",
      "kind": "pipe",
      "geometry": "solid",
      "match": {
        "property": "properties.assetCondition",
        "values": [
          "decommissioned"
        ]
      },
      "initiallyVisible": false,
      "style": {
        "color": "#8a8f89",
        "opacity": 0.25
      },
      "label": {
        "properties": [
          "properties.name"
        ],
        "fallback": "id"
      }
    },
    {
      "source": "solids",
      "kind": "pipe",
      "geometry": "solid",
      "match": {
        "property": "properties.assetCondition",
        "values": [
          "util:hazardous"
        ]
      },
      "style": {
        "color": "#c23b22"
      },
      "label": {
        "properties": [
          "properties.name"
        ],
        "fallback": "id"
      }
    },
    {
      "source": "solids",
      "kind": "pipe",
      "geometry": "solid",
      "match": {
        "property": "properties.assetCondition",
        "values": [
          "http://example.org/utility-status#planned"
        ]
      },
      "style": {
        "color": "#3b5bab"
      },
      "elevation": "flatten",
      "label": {
        "properties": [
          "properties.name"
        ],
        "fallback": "id"
      }
    },
    {
      "source": "solids",
      "kind": "pipe",
      "geometry": "solid",
      "style": {
        "color": "#3388ff"
      },
      "label": {
        "properties": [
          "properties.name"
        ],
        "fallback": "id"
      }
    }
  ]
}

```


### Basemap and initial camera
Globe options only, so the built-in rules still apply: an OpenTopoMap basemap (no key needed)
and a fixed starting view instead of framing the data.

#### json
```json
{
  "cesium": {
    "basemap": {
      "url": "https://tile.opentopomap.org/{z}/{x}/{y}.png",
      "credit": "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)",
      "maximumLevel": 17
    },
    "camera": {
      "longitude": 115.7967,
      "latitude": -31.8952,
      "height": 150,
      "heading": 20,
      "pitch": -30
    }
  }
}

```


### Cesium ion imagery and terrain
Cesium ion world imagery and terrain. These need an ion token, which is injected into the
published configuration at build time and never committed; without one, the view falls back
to OpenStreetMap and the flat ellipsoid.

#### json
```json
{
  "cesium": {
    "basemap": "ion",
    "terrain": "ion"
  }
}

```

## Schema

```yaml
$schema: https://json-schema.org/draft/2020-12/schema
title: Cesium globe viewer configuration
description: 'Per-block configuration for the TopoFeatureCesiumPlugin, the bblocks-viewer
  "Globe" view of

  topo-feature documents. A block declares it as a `resources` entry in its `bblock.json`
  with the

  role `https://github.com/ogcincubator/bblocks-cesium-viewer/role/viewer-config`.


  `rules`, `defaults` and `kindOrder` are the rule-engine configuration shared with
  the Three.js

  TopoFeaturePlugin (bblocks-viewer-topo-feature-plugin); `cesium` holds the globe-only
  options.

  Every member is optional: an omitted `rules` keeps the plugin''s built-in rules.

  '
type: object
additionalProperties: false
properties:
  rules:
    description: 'Ordered rules. For each feature, the first rule whose `source` is
      the collection it came from

      and whose `match` (if any) applies decides how it is drawn; a feature no rule
      claims is not

      drawn. A non-empty list replaces the built-in rules entirely.

      '
    type: array
    items:
      $ref: '#/$defs/rule'
  defaults:
    description: Defaults merged under every rule; `style` is merged key by key.
    type: object
    additionalProperties: false
    properties:
      style:
        $ref: '#/$defs/style'
      elevation:
        $ref: '#/$defs/elevation'
  kindOrder:
    description: Preferred order of kinds, for viewers that list them.
    type: array
    items:
      type: string
  cesium:
    $ref: '#/$defs/cesiumOptions'
$defs:
  rule:
    type: object
    additionalProperties: false
    required:
    - source
    - kind
    - geometry
    properties:
      source:
        description: 'Top-level collection of the document to classify, e.g. `solids`,
          `parcels`, `faces`,

          `rings`, or the derived `surfaces` (shells no solid uses).

          '
        type: string
        minLength: 1
      kind:
        description: Identifier grouping this rule's features, e.g. `parcel-created`.
        type: string
        minLength: 1
      group:
        description: Groups several kinds under one heading and toggle. Defaults to
          `kind`.
        type: string
        minLength: 1
      kindLabel:
        description: Human-readable name for this kind, e.g. `Former Tenure`.
        type: string
      geometry:
        description: How the feature's topology is turned into a shape.
        enum:
        - solid
        - open-shell
        - polygon
        - face
        - ring
      match:
        description: 'Restricts the rule to features whose property value (or any
          value, for an array) equals

          one of `values`. Values may be literals, CURIEs expanded against the document''s
          own

          `@context`, or full URIs; both sides are expanded before comparing.

          '
        type: object
        additionalProperties: false
        required:
        - property
        - values
        properties:
          property:
            description: Dot-separated path into the feature, e.g. `properties.parcelState`.
            type: string
            minLength: 1
          values:
            type: array
            minItems: 1
            items:
              type: string
      label:
        description: 'Where a feature''s label comes from: the first of `properties`
          (dot-separated paths) that

          resolves to a non-empty value or to an object with a string `label`, else
          `fallback`

          (default `id`).

          '
        type: object
        additionalProperties: false
        properties:
          properties:
            type: array
            items:
              type: string
          fallback:
            type: string
      style:
        $ref: '#/$defs/style'
      initiallyVisible:
        description: Whether the feature is shown when the view opens. Default true.
        type: boolean
      elevation:
        $ref: '#/$defs/elevation'
  style:
    type: object
    additionalProperties: false
    properties:
      color:
        description: Fill colour, any CSS colour (e.g. `#a1531a`). Default cycles
          a palette.
        type: string
      opacity:
        description: Fill opacity, 0 (transparent) to 1 (opaque).
        type: number
        minimum: 0
        maximum: 1
      lineColor:
        description: Outline colour, any CSS colour. Default white.
        type: string
      lineStyle:
        enum:
        - solid
        - dashed
  elevation:
    description: '`preserve` (default) keeps each point''s height; `flatten` clamps
      the feature to the ground

      (terrain, or the ellipsoid); `{ "flattenTo": n }` places it n metres above the
      ellipsoid.

      '
    oneOf:
    - enum:
      - preserve
      - flatten
    - type: object
      additionalProperties: false
      required:
      - flattenTo
      properties:
        flattenTo:
          type: number
  cesiumOptions:
    description: 'Globe-only options. Everything works without an ion token: the default
      is OpenStreetMap

      imagery on the flat WGS84 ellipsoid.

      '
    type: object
    additionalProperties: false
    properties:
      basemap:
        description: '`osm` (default), `ion` (Cesium ion world imagery; needs `ionToken`),
          or an XYZ tile

          template served over https with `{z}`, `{x}` and `{y}` placeholders.

          '
        oneOf:
        - enum:
          - osm
          - ion
        - type: object
          additionalProperties: false
          required:
          - url
          properties:
            url:
              type: string
              pattern: ^(?=.*\{z\})(?=.*\{x\})(?=.*\{y\})https://
            credit:
              description: Attribution shown on the globe; required by most tile providers.
              type: string
            maximumLevel:
              description: Deepest zoom level the tile server has.
              type: integer
              minimum: 0
      terrain:
        description: '`ellipsoid` (default, flat) or `ion` (Cesium World Terrain;
          needs `ionToken`).'
        enum:
        - ellipsoid
        - ion
      camera:
        description: Initial view. Without it, the view frames the document's features.
        type: object
        additionalProperties: false
        required:
        - longitude
        - latitude
        - height
        properties:
          longitude:
            type: number
            minimum: -180
            maximum: 180
          latitude:
            type: number
            minimum: -90
            maximum: 90
          height:
            description: Metres above the ellipsoid.
            type: number
          heading:
            description: Degrees clockwise from north. Default 0.
            type: number
          pitch:
            description: Degrees; negative looks down. Default -45.
            type: number
            minimum: -90
            maximum: 90
          roll:
            description: Degrees. Default 0.
            type: number
      ionToken:
        description: 'Cesium ion access token, used only by `ion` imagery or terrain.
          Never commit one: a

          published register injects it at build time from a CI secret. It is visible
          to anyone

          using the viewer, so it must be scoped to `assets:read` and restricted to
          the register''s

          domain.

          '
        type: string

```

Links to the schema:

* YAML version: [schema.yaml](https://raw.githubusercontent.com/andrewhunter2066/bblocks-cesium-viewer/undefined/build/annotated/bbr/template/cesiumViewerConfig/schema.json)
* JSON version: [schema.json](https://raw.githubusercontent.com/andrewhunter2066/bblocks-cesium-viewer/undefined/build/annotated/bbr/template/cesiumViewerConfig/schema.yaml)


# For developers

The source code for this Building Block can be found in the following repository:

* URL: [https://github.com/andrewhunter2066/bblocks-cesium-viewer](https://github.com/andrewhunter2066/bblocks-cesium-viewer)
* Path: `_sources/cesiumViewerConfig`

