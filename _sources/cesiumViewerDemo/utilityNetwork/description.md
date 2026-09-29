Demonstrates that the **Globe** view's rules are domain-independent: four underground pipe segments,
classified by `assetCondition`, with no cadastral vocabulary. Open the example below and choose its
**Globe** tab.

The attached [Globe view configuration](bblocks://ogc.bbr.template.cesiumViewerConfig)
(`viewer-config.json`) matches a literal (`decommissioned` — shown grey and initially hidden), a
CURIE (`util:hazardous`, expanded against the document's own `@context` — red) and a full URI
(`…/utility-status#planned` — blue, clamped to the ground); other pipes fall through to a catch-all
rule.

The pipes sit 2–10 m below the ellipsoid in Murray Street, Perth. The document is georeferenced from
the Three.js topology view's `utility-network.json`, whose local metre coordinates are kept in each
point's `place`.
