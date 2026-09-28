# Extension Points

> **Experimental feature.** Extension points are functional but may not work correctly in all
> cases. Verify compiled output when using this feature.

Extension points allow you to specialise an existing block by substituting specific referenced
blocks within its schema (and recursively within its imports). This produces a compiled schema
for the extension — consumers can validate against that single schema without needing to understand
the extension relationship.

---

## The problem they solve

Suppose a base `FeatureCollection` block references a `Feature` block. You want a collection
that only accepts your specialised `MyFeature` type. Without extension points, you would need
to replicate the entire `FeatureCollection` structure. With extension points, you declare
a single mapping and the postprocessor compiles the result.

---

## Declaration in `bblock.json`

```json
{
  "name": "My Feature Collection",
  "extensionPoints": {
    "baseBuildingBlock": "bblocks://ogc.geo.features.featureCollection",
    "extensions": {
      "bblocks://ogc.geo.features.feature": "bblocks://myorg.myproject.my-feature"
    }
  }
}
```

- `baseBuildingBlock`: the block you are extending.
- `extensions`: a map from the referenced block identifier (in the base or its imports) to your
  specialised block identifier. The postprocessor replaces every reference to the key with a
  constraint that requires both the original and your specialised version.

`bblocks://` URIs are preferred throughout; bare identifiers are also accepted.

Semantic mappings from the target blocks are also included in the generated JSON-LD context. SHACL
shapes are inherited from both the base and the extension targets (unless explicitly disabled).

Substituting a referenced block is a separate mechanism from overriding a single term's own mapping —
for the latter (e.g. narrowing an inherited `skos:note` to `skos:definition`), see
[semantic/context.md](semantic/context.md#overriding-an-inherited-binding). That works for plain
`allOf` composition too, without needing `extensionPoints` at all.

---

## Limitations

- Extension points work only for blocks backed by a JSON Schema. Blocks backed by an OpenAPI
  document are recorded in the register but no compiled schema is produced.
- The feature is experimental — always inspect the compiled output schema in `build/annotated/`
  to verify the result.

---

## Example: extending a GeoJSON FeatureCollection

```json
{
  "name": "Observation Collection",
  "abstract": "A GeoJSON FeatureCollection where each Feature is an Observation.",
  "status": "experimental",
  "dateTimeAddition": "2024-06-01T00:00:00Z",
  "itemClass": "schema",
  "version": "0.1",
  "extensionPoints": {
    "baseBuildingBlock": "bblocks://ogc.geo.features.featureCollection",
    "extensions": {
      "bblocks://ogc.geo.features.feature": "bblocks://myorg.obs.observation-feature"
    }
  }
}
```

The postprocessor produces a compiled schema at `build/annotated/myorg/obs/observation-collection/schema.json`
in which every reference to the base `feature` block is constrained to also satisfy `observation-feature`.
