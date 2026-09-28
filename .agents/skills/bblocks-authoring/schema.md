# JSON Schema

A block's JSON Schema lives at `schema.yaml` (preferred) or `schema.json` in the block directory.
YAML is preferred because it supports comments and is easier to read.

The schema describes the data model that instances of this block must conform to. It is:

- validated against during example and test processing
- annotated by the postprocessor with semantic properties to produce the **annotated schema**
- combined with imported blocks' schemas via `$ref` resolution

See [semantic/annotated-schemas.md](semantic/annotated-schemas.md) for how annotation works.

---

## Referencing other schemas

### Plain `$ref`

Reference any external schema by URL:

```yaml
"$ref": "https://geojson.org/schema/Feature.json"
```

### `bblocks://` scheme

Reference another block's annotated schema using its identifier. This automatically inherits the
referenced block's JSON-LD context and SHACL shapes:

```yaml
"$ref": "bblocks://ogc.geo.features.feature"
```

This requires the referenced block's register to be listed in `bblocks-config.yaml` under `imports`.
At postprocessing time the `bblocks://` URI is resolved to the actual annotated schema URL.

---

## Profiling (extending) a schema

To constrain a referenced schema, wrap the `$ref` in an `allOf` and add your constraints:

```yaml
allOf:
  - "$ref": "bblocks://ogc.geo.features.feature"
  - properties:
      properties:
        required: [name, measurementType]
        properties:
          name:
            type: string
          measurementType:
            type: string
            enum: [temperature, pressure, humidity]
```

JSON Schema profiling is genuinely complex, but the `allOf`/`$ref` pattern shown above is the basic,
standard mechanism for it. [extension-points.md](extension-points.md) (experimental) covers a more
specific case: specializing a base block by constraining specific blocks it references — including
ones reached transitively through its imports — without hand-editing the base schema.

Beyond that, general JSON Schema profiling remains an open problem — no wizard tool or constraint DSL
exists yet, so complex cases still require hand-written `allOf` composition as shown above.

---

## Semantic annotations with `x-jsonld-*`

Source schemas can carry `x-jsonld-*` properties to guide semantic annotation. These are used by the
postprocessor (via ogc-na-tools) to annotate the schema and build the assembled JSON-LD context.

The most common annotation is pointing a schema to its JSON-LD context:

```yaml
# Top of schema.yaml
"$schema": https://json-schema.org/draft/2020-12/schema
title: My Feature
x-jsonld-context: ../my-context.jsonld   # relative to schema.yaml
type: object
properties:
  ...
```

You can also declare extra context entries and base URI directly in the schema:

```yaml
x-jsonld-extra-terms:
  myProp: "https://example.org/vocab#myProp"
x-jsonld-prefixes:
  ex: "https://example.org/vocab#"
```

The `x-jsonld-*` properties only take effect in the **annotated schema** output (in `build/`) — they
have no effect in validators or tools that read the source schema directly.

See [semantic/context.md](semantic/context.md) and [semantic/annotated-schemas.md](semantic/annotated-schemas.md)
for the full annotation mechanism.

---

## Identifier property

It's good practice to give the schema an identifier property (commonly `id`), even if nothing in
the immediate use case requires it. Linked data entities generally need an IRI to be referenced
from elsewhere and merged correctly across graphs, and retrofitting an identifier later is a
breaking change for anyone already producing instances. If the block has a JSON-LD context, map
this property to `@id` — see [semantic/context.md](semantic/context.md#mapping-an-identifier-field-to-id).

---

## Version compatibility

Write schemas using modern JSON Schema (draft 2020-12 or 2019-09) and let the postprocessor handle
downward compatibility, rather than hand-restricting to older JSON Schema features. The postprocessor
generates OAS 3.1-compatible output by default; an additional OAS 3.0-compatible down-compiled
schema is generated only if you opt in with `schema-oas30-downcompile: true` in
`bblocks-config.yaml` (see [register-config.md](register-config.md)) — it is disabled by default.
Avoid `$dynamicRef` if OAS 3.0 compatibility is important, since reuse mechanisms like it may not be
down-compilable.

OGC APIs are currently bound to OAS 3.0, which limits which JSON Schema patterns are supported —
complex structural hierarchies often need to be recreated and composed via `allOf[]` to place
constraints at the right location, rather than relying on more modern JSON Schema composition
features.

---

**Example:** [examples/basic-schema/schema.yaml](examples/basic-schema/schema.yaml) — profiles an imported block with `bblocks://` and adds a required property.

---

## Minimal `schema.yaml`

```yaml
"$schema": https://json-schema.org/draft/2020-12/schema
title: Temperature Reading
type: object
required:
  - value
  - unit
properties:
  value:
    type: number
  unit:
    type: string
    enum: [celsius, fahrenheit, kelvin]
```

## Schema with semantic annotation and block reference

```yaml
"$schema": https://json-schema.org/draft/2020-12/schema
title: Observation Feature
x-jsonld-context: ../context.jsonld
allOf:
  - "$ref": "bblocks://ogc.geo.features.feature"
  - properties:
      properties:
        properties:
          observedProperty:
            type: string
            format: uri
            x-jsonld-id: https://www.w3.org/ns/sosa/observedProperty
            x-jsonld-type: "@id"
          result:
            type: number
            x-jsonld-id: https://www.w3.org/ns/sosa/hasSimpleResult
```
