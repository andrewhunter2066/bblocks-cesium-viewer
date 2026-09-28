# SHACL Shapes and Closures

SHACL (Shapes Constraint Language) validates RDF graphs produced from JSON-LD uplift. It is the
validation layer *after* semantic annotation — use it to enforce constraints on the RDF model
that JSON Schema cannot express.

---

## Declaring SHACL shapes

### Auto-detected

Place a `shapes.shacl` file in the block directory. It is picked up automatically. (A legacy
`rules.shacl` filename is also auto-detected as a fallback when `shapes.shacl` is absent, but new
blocks should use `shapes.shacl`.)

### Via `bblock.json`

```json
{
  "shaclShapes": [
    "shapes.shacl",
    "https://example.org/shared-shapes.shacl"
  ]
}
```

`shaclShapes` accepts local paths (relative to `bblock.json`) or URLs. Multiple files are merged.

> **Note:** `shaclRules` is a deprecated alias for `shaclShapes`. Treat any `shaclRules` entry as
> equivalent to `shaclShapes`.

---

## SHACL closures (`shaclClosures`)

SHACL shapes often reference external vocabulary terms (class hierarchies, codelists) that are
not expected to appear in instance data. Without those terms, the shapes fail.

`shaclClosures` provides background RDF data that is merged into every test snippet *before*
SHACL validation runs:

```json
{
  "shaclShapes": ["shapes.shacl"],
  "shaclClosures": [
    "vocabs/my-codelist.ttl",
    "https://example.org/static-vocabulary.ttl"
  ]
}
```

Use `shaclClosures` for:
- Small, static codelists (allowed values for a property)
- Type hierarchies needed for `sh:class` checks
- Any RDF that is part of the specification but not part of the instance data

---

## Inheritance

A block's SHACL closure graph is not just its own declared `shaclClosures`: it's assembled from
the *entire* `dependsOn`/`isProfileOf` chain (the same chain `shaclShapes` is inherited across —
see [imports-profiles.md](../imports-profiles.md)), and from more than just `shaclClosures`. For
every block in that chain (including itself), the closure graph picks up:

- its declared `shaclClosures`;
- its `ontology`, if it has one (auto-detected `ontology.ttl`/`ontology.owl` counts too);
- any `resources` entry with `role: data` whose `format` is an RDF serialization (Turtle,
  RDF/XML, JSON-LD, N-Triples, N3, TriG). A `role: data` resource that's actually a CSV or
  NetCDF file, for example, is skipped — it can't be parsed into an RDF closure graph, and stays
  purely a published artifact.

So a block that depends on (or profiles) another block which declares an ontology defining
`eg:Bird rdfs:subClassOf eg:Animal`, for instance, gets that class hierarchy for free when
validating a `sh:class eg:Animal` shape against `eg:Bird` instances — no need to redeclare it as
a `shaclClosures` entry.

---

## Per-example closures (`shacl-closure`)

Individual snippets in `examples.yaml` can add their own closure data on top of the block's closure
graph, via the snippet-level `shacl-closure` property:

```yaml
examples:
  - snippets:
      - language: json
        code: '{ "type": "Bird" }'
        shacl-closure:
          - extra-taxonomy.ttl
```

It's merged with the block's `shaclClosures` (and everything inherited per the section above) — use it
for RDF data that's specific to one example rather than the whole block. See
[examples.md](../examples.md#per-snippet-shacl-closures) for the snippet-vs-example distinction and how
it interacts with auto-generated JSON-LD/Turtle doc snippets.

---

## Writing SHACL shapes

```turtle
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix ex:   <https://example.org/vocab#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

ex:ObservationShape
    a sh:NodeShape ;
    sh:targetClass ex:Observation ;
    sh:property [
        sh:path ex:hasValue ;
        sh:datatype xsd:double ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path ex:observedProperty ;
        sh:minCount 1 ;
        sh:nodeKind sh:IRI ;
    ] .
```

SHACL shapes apply to the RDF graph produced by uplifting JSON with the assembled context.
The subject nodes are typically blank nodes or URIs from `@id` values in the JSON-LD context.

---

## SHACL validation vs. JSON Schema validation

| | JSON Schema | SHACL |
|-|-------------|-------|
| Input | JSON | RDF graph (from JSON-LD uplift) |
| When it runs | Before uplift | After uplift |
| Validates | Structure, types, cardinality | Semantic graph constraints |
| Good for | Required fields, data types, enum values | Cross-property constraints, class membership, link integrity |

Both layers run in sequence. A test resource can fail at either layer.

---

## Testing your shapes

Use the [SHACL Validator](https://shacl-play.sparna.fr/play/validate) interactively.

In the postprocessor output, check `build/tests/` for:
- `{name}.ttl` — the uplifted Turtle
- `{name}.validation_passed.txt` or `{name}.validation_failed.txt` — the SHACL report

Run with `--log-level DEBUG` to see detailed shape evaluation.
