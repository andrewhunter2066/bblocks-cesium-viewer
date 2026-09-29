# Cesium globe viewer for topo-feature documents

A CesiumJS **Globe** view for topo-feature topology documents in the Building Blocks viewer, the
JSON Schema for its per-block configuration, and demo blocks that use it.


The `TopoFeatureCesiumPlugin` is a [bblocks-viewer](https://github.com/opengeospatial/bblocks-viewer)
view plugin. It adds a **Globe** tab to any example or transform output that is a
[topo-feature](https://github.com/ogcincubator/topo-feature) document whose points carry WGS84
`geometry`, drawing its solids, surfaces, faces and parcels at their real positions on a
CesiumJS globe — OpenStreetMap on the flat ellipsoid by default, with no Cesium ion token needed.

Which features are drawn and how is set by rules shared with the Three.js topology view
([bblocks-viewer-topo-feature-plugin](https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin)),
optionally configured per block; see the *Cesium globe viewer configuration* block. This register
declares the plugin itself, so the demo blocks' examples open in the Globe tab here.

Source, harness and instructions for adding the plugin to another register:
[bblocks-cesium-viewer](https://github.com/andrewhunter2066/bblocks-cesium-viewer).


## Building Blocks

### `ogc.bbr.template.cesiumViewerConfig` — Cesium globe viewer configuration

**Type:** schema

Per-block configuration for the bblocks-viewer Globe view of topo-feature documents: which features are drawn and how (rules shared with the Three.js topology view), plus the globe's basemap, terrain and initial camera.

### `ogc.bbr.template.cesiumViewerDemo.parcel` — Globe view demo: cadastral parcel

**Type:** schema

A Western Australian cadastral survey as a topo-feature document — a 3D lot solid, the ground surface and three parcels — shown in the Globe view with the parcel rules from the Three.js topology view.

### `ogc.bbr.template.cesiumViewerDemo.utilityNetwork` — Globe view demo: underground utility network

**Type:** schema

Four underground pipe segments as topo-feature solids, classified by asset condition — a non-cadastral document showing that the Globe view's rules are domain-independent.

