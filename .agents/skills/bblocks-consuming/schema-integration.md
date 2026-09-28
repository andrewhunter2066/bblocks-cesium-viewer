# Referencing a block's schema

## Always use the annotated schema

Every block publishes two schema forms:

- **source schema** — what the block's author wrote (`schema.yaml`/`schema.json` in the register's
  source tree). May still contain unresolved `bblocks://` refs.
- **annotated schema** — the postprocessed output (`schema['application/yaml']` /
  `schema['application/json']` URLs in the summary). `bblocks://` refs are resolved to real HTTPS
  URLs pointing at *other blocks' annotated schemas*, and `x-jsonld-*` semantic annotations are inlined.

**Always reference the annotated schema as a consumer.** The source schema is not guaranteed to be
self-contained or even resolvable outside the register's own build.

## Resolving `bblocks://` URIs

A schema (or a `$ref` inside one) may use a `bblocks://<identifier>` URI instead of an HTTPS URL. To
resolve it:

1. Strip the `bblocks://` prefix to get the bare identifier.
2. Look it up in the register (see [register.md](register.md)) to get its summary.
3. Use `summary.schema['application/json']` (or `application/yaml`) as the real URL.

Tools that render or validate schemas (the viewer, `bblocks-client-python`'s validator) do this
substitution transparently — if you write your own resolver, this is the one piece of logic to get
right.

## `$ref`-ing a block's schema from your own

Because the annotated schema's `$ref`s already point to real URLs, you can `$ref` a block's annotated
schema directly from a schema you control:

```yaml
properties:
  geometry:
    $ref: "https://ogcincubator.github.io/bblocks-examples/build/annotated/bbr/examples/feature/geojsonFeature/schema.json"
```

Any JSON Schema validator that can fetch remote refs (or that you pre-populate a ref registry for)
will resolve this correctly. See [validation.md](validation.md) for how to wire that up, including
the case where the referenced schema itself contains further `bblocks://`-derived refs to *other*
blocks (refs can chain arbitrarily deep across a register's dependency graph).

## Don't hand-copy schema content

Because annotated schemas already inline inherited semantic annotations and resolve cross-block refs,
copying snippets out of one into your own schema will silently drop you out of sync with future
updates to the upstream block. Reference by URL; don't vendor the content.
