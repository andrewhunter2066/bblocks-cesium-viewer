Demonstrates the **Globe** view of a topo-feature document. Open the example below and choose its
**Globe** tab: the lot's 3D solid is drawn on OpenStreetMap at its surveyed position in Perth, with
the parcels clamped to the ground beneath it.

The block's `resources` attach a [Globe view configuration](bblocks://ogc.bbr.template.cesiumViewerConfig)
(`viewer-config.json`): the Three.js topology view's parcel rules, used unchanged. Parcels are
listed by state in the view's Layers panel, and former-tenure parcels and the ground surface start
hidden.

The document is a fixture from the Three.js topology view
([bblocks-viewer-topo-feature-plugin](https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin)).
Each point carries both projected `place` coordinates and a WGS84 `geometry`; the Globe view uses
only `geometry`.
