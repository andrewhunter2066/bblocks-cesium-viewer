# Semantics — Overview

OGC Blocks supports semantic interoperability by linking JSON data models to RDF. This section covers
the three layers of semantic tooling:

| File | What it covers |
|------|----------------|
| [context.md](context.md) | Writing a JSON-LD context to map JSON properties to RDF predicates |
| [annotated-schemas.md](annotated-schemas.md) | How schemas are annotated, and how the assembled context is built |
| [shacl.md](shacl.md) | SHACL shapes (`shaclShapes`) and closures (`shaclClosures`) for RDF graph validation |
| [uplift.md](uplift.md) | Semantic uplift: additional pre/post steps when JSON-LD is not enough |

---

## How the layers fit together

```
source schema (schema.yaml)
  + x-jsonld-context → path to context.jsonld
  + x-jsonld-* properties (optional inline annotations)
        ↓  annotated by ogc-na-tools (annotate_schema.py)
annotated schema (build/.../schema.json)
  ↑ references resolved, x-jsonld-* properties inlined

context.jsonld (source)
  + contexts from all imported blocks (assembled by postprocessor)
        ↓
assembled context.jsonld (build/.../context.jsonld)

JSON instance + assembled context
        ↓  JSON-LD uplift
.jsonld (expanded/compacted) + .ttl (Turtle)
        ↓  SHACL validation
shapes.shacl + shaclClosures → validation report
```

---

## Quick decision guide

| I want to… | Use |
|------------|-----|
| Map JSON property names to RDF predicates | [JSON-LD context](context.md) |
| Understand how semantic annotations propagate through `$ref` chains | [Annotated schemas](annotated-schemas.md) |
| Validate RDF graph structure and constraints | [SHACL shapes](shacl.md) |
| Transform JSON to a different RDF model before/after uplift | [Semantic uplift](uplift.md) |
| Define an ontology without any JSON Schema | [rdf-only.md](../rdf-only.md) |

---

## Key terms

**JSON-LD uplift**: The process of embedding a JSON-LD `@context` into a JSON document, then parsing
the result as RDF. The postprocessor does this automatically for every JSON example and test resource
that has a context.

**Annotated schema**: The postprocessor output schema with `x-jsonld-*` properties from the source
schema (and all referenced schemas) resolved and inlined. This is the schema other blocks import
via `bblocks://` — not the source schema.

**Assembled context**: The merged JSON-LD context that combines the block's own `context.jsonld` with
the contexts of all blocks it imports. Produced in `build/.../context.jsonld`.

**SHACL closure**: An RDF file merged into every test snippet as background data before SHACL
validation runs. Useful for small, static vocabularies (codelists, type hierarchies) that the SHACL
shapes reference but that are not expected to be in the instance data.
