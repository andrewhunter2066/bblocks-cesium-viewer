# Postprocessor Outputs

Understanding what the postprocessor produces — and where — helps with debugging, with knowing
what downstream consumers should reference, and with understanding what gets deployed to GitHub Pages.

---

## Output root

The postprocessor writes everything to `build/` (or `build-local/` when run with a local base URL).
The `build/` directory is committed and tracked by git so that GitHub Pages can deploy it.

**Never edit `build/` by hand.** It is fully regenerated on each postprocessing run.

---

## Per-block outputs

For a block at `_sources/geo/point/`, with identifier `myorg.proj.geo.point`:

```
build/
  annotated/
    geo/
      point/
        schema.json              # annotated schema (resolved $refs, inlined x-jsonld-* annotations)
        schema.yaml              # same, in YAML
        context.jsonld           # assembled JSON-LD context (own + inherited)
        bblock.json              # processed metadata
  generateddocs/
    slate/
      geo/
        point/
          index.html.md          # Slate (markdown) documentation source
    markdown/
      geo/
        point/
          index.md               # Markdown documentation
    json-full/
      geo/
        point/
          index.json             # Full JSON documentation
  tests/
    myorg.proj.geo.point/
      *.jsonld                   # uplifted JSON-LD for each example/test
      *.ttl                      # uplifted Turtle
      *.validation_passed.txt    # SHACL report (pass)
      *.validation_failed.txt    # SHACL report (fail)
    report.html                  # summary validation report
    report.json                  # machine-readable summary
```

---

## Register-level outputs

```
build/
  register.json      # machine-readable index of all blocks in this register
  bblocks.jsonld      # register.json semantically uplifted to JSON-LD (register + all blocks' metadata, one graph)
  bblocks.ttl         # same, as Turtle RDF
```

`register.json` is the canonical file that other registers import. It contains the full metadata
for each block, including links to annotated schemas, contexts, documentation, and test results.
`bblocks.jsonld`/`bblocks.ttl` are the same content uplifted to RDF — there is no separate
`register.jsonld`/`register.ttl` pair.

---

## Annotated schema

The most important output for downstream consumers. Key differences from the source schema:

- `bblocks://` `$ref` URIs are resolved to real HTTPS URLs pointing to other blocks' annotated schemas.
- `x-jsonld-*` properties from all referenced schemas are inlined.
- The schema is written as JSON (even if the source is YAML).

**Other blocks should always reference the annotated schema** (via `bblocks://` which resolves to it),
not the source schema.

---

## Assembled context

`build/annotated/.../context.jsonld` is the merged JSON-LD context combining:
- The block's own `context.jsonld`
- Contexts from all imported blocks (transitively)

This is what gets embedded in JSON documents during semantic uplift. Do not use the source
`context.jsonld` for uplift — use the assembled one from `build/`.

---

## Test outputs

For each example snippet and test resource, the pipeline writes:
- `{name}.jsonld` — the uplifted JSON-LD (if input was JSON and a context is present)
- `{name}.ttl` — the Turtle RDF
- `{name}.validation_passed.txt` or `{name}.validation_failed.txt` — SHACL validation report

Transform outputs (from `transforms.yaml`) are written to `build/tests/{block-id}/transforms/`.

---

## What gets deployed to GitHub Pages

The `build/` directory is deployed as-is. Static assets from block `assets/` directories are also
deployed directly (not under `build/`), alongside the GitHub Pages index.

The building blocks viewer (`ghcr.io/ogcincubator/bblocks-viewer`) reads `register.json` and renders
the register as a navigable web application. Run it locally against your `build/` output for preview:

```bash
docker run --rm --pull=always -v "$(pwd):/register" -p 9090:9090 \
  ghcr.io/ogcincubator/bblocks-viewer
```
