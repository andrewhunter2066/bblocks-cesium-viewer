# Annotated Schemas and Assembled Contexts

This file explains what the postprocessor does to schemas and contexts — understanding this is
essential for debugging semantic issues and for knowing which schema to reference from other blocks.

The annotation is performed by `ogc-na-tools` (`annotate_schema.py`).

---

## Source schema vs. annotated schema

| | Source (`_sources/.../schema.yaml`) | Annotated (`build/.../schema.json`) |
|-|-------------------------------------|--------------------------------------|
| Who writes it | The block author | The postprocessor |
| Contains `$ref` | Yes, including `bblocks://` URIs | Yes, resolved to real URLs |
| Contains `x-jsonld-*` | Yes, as author-supplied hints | Yes, inlined from all referenced schemas |
| Used by other blocks' `bblocks://` refs | No | Yes |
| Should be edited | Yes | Never |

**Always reference the annotated schema** when using a block from another register. The `bblocks://`
scheme resolves to the annotated schema, not the source.

---

## What annotation does

Given a source schema like:

```yaml
x-jsonld-context: ../context.jsonld
type: object
properties:
  value:
    type: number
    x-jsonld-id: https://example.org/vocab#hasValue
    x-jsonld-type: xsd:double
  feature:
    "$ref": "bblocks://ogc.geo.features.feature"
```

The annotator:

1. **Resolves `bblocks://` URIs** to the actual annotated schema URLs from imported registers.
2. **Inlines `x-jsonld-*` properties** from all referenced schemas recursively.
3. **Records the context path** (`x-jsonld-context`) in the root so downstream consumers know
   which context file to use.
4. Writes the result to `build/annotated/.../<path>/schema.json`.

The output schema carries the full semantic picture — a consumer reading only the annotated schema
can understand all the semantic annotations without needing to follow `$ref` chains.

---

## How the assembled context is built

The assembled context (`build/.../context.jsonld`) is constructed by the postprocessor by merging:

1. The block's own `context.jsonld` (source)
2. The contexts from every directly or transitively imported block

The merge is additive: entries from imported contexts appear first, entries from the local context
come last (and can override). The result is a single `@context` array:

```json
{
  "@context": [
    "https://imported-register.example.org/build/annotated/other-block/context.jsonld",
    {
      "myProp": "https://example.org/vocab#myProp"
    }
  ]
}
```

The assembled context is what gets embedded in JSON instances during semantic uplift — not the
source `context.jsonld`.

---

## `x-jsonld-*` properties reference

These properties can appear anywhere in a source schema:

| Property | Effect |
|----------|--------|
| `x-jsonld-context` | Path or URL to the block's JSON-LD context (used at the schema root level) |
| `x-jsonld-id` | Maps this property to an RDF predicate URI |
| `x-jsonld-type` | Sets the RDF datatype (`xsd:double`, etc.) or `@id` / `@vocab` |
| `x-jsonld-base` | Sets `@base` for the annotated context |
| `x-jsonld-prefix` | Declares a prefix for the annotated context |
| `x-jsonld-extra-terms` | Additional context terms to add (key-value map) |
| `x-jsonld-prefixes` | Additional prefixes to declare (key-value map) |

`x-jsonld-id` and `x-jsonld-type` at the property level generate a context entry equivalent to:

```json
"propertyName": { "@id": "<x-jsonld-id value>", "@type": "<x-jsonld-type value>" }
```

---

## Debugging annotation issues

If a property is not being mapped to the expected RDF predicate:

1. Check the **assembled context** at `build/annotated/.../context.jsonld` — is the mapping present?
2. Check the **annotated schema** at `build/annotated/.../schema.json` — are `x-jsonld-*` properties
   inlined where expected?
3. Check the **uplifted outputs** at `build/tests/.../` — does the `.ttl` output contain the expected triples?
4. Use `--log-level DEBUG` when running the postprocessor to see the annotation steps.
5. Use the [JSON-LD Playground](https://json-ld.org/playground/) with the assembled context to
   test a specific document interactively.
