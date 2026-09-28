# Repository Structure

## Top-level layout

```
my-bblocks-repo/
  bblocks-config.yaml        # register-level config → register-config.md
  bblocks-config-local.yml   # local URL mappings for testing (gitignored) → imports-profiles.md
  bblocks-config-override.yml # fork-specific config overrides, excluded from PRs (gitignored) → contributing.md
  build.sh                   # convenience wrapper: runs postprocessor via Docker → local-iteration.md
  view.sh                    # launches the bblocks viewer against build-local/ → local-iteration.md
  .volumes                   # extra Docker volume mounts for build.sh (gitignored, optional) → imports-profiles.md
  docker-compose.yml         # alternative to build.sh / view.sh
  .github/
    workflows/
      process-bblocks.yml    # CI: runs postprocessor and deploys to GitHub Pages; add SPARQL secrets here → register-config.md
  _sources/                  # all block source files live here
    group1/
      my-block/
        bblock.json          # block metadata → metadata.md
        schema.yaml          # JSON Schema → schema.md
        context.jsonld       # JSON-LD context → semantic/context.md
        shapes.shacl          # SHACL shapes → semantic/shacl.md
        examples.yaml        # examples → examples.md
        tests.yaml           # explicit test resources → tests.md
        tests/               # auto-detected test files → tests.md
        transforms.yaml      # transforms → transforms.md
        semantic-uplift.yaml # semantic uplift config → semantic/uplift.md
        assets/              # static files (images, etc.) — no fixed name required
        description.md       # long-form Markdown block docs → see below
  build/                     # NEVER edit — postprocessor output committed for CI/GitHub Pages → outputs.md
  build-local/               # gitignored local postprocessor output; inspect here when iterating locally → local-iteration.md, outputs.md
```

## `bblocks-config.yaml`

Register-level configuration (identifier prefix, imports, viewer depth, SPARQL push).
Full field reference: [register-config.md](register-config.md).

## Identifier construction

Block identifiers are auto-generated — never set `itemIdentifier` manually:

```
{identifier-prefix}{dot-separated-path-from-_sources}
```

Examples:

| Prefix | Source path | Identifier |
|--------|-------------|------------|
| `myorg.p.` | `_sources/geo/point/bblock.json` | `myorg.p.geo.point` |
| `ogc.geo.` | `_sources/features/feature/bblock.json` | `ogc.geo.features.feature` |

Directory names become identifier segments. Intermediate directories without a `bblock.json` are
treated as namespaces and are part of the identifier but have no block of their own.

**Identifiers must be stable** — changing them breaks all downstream `$ref`s, imports, and profiles.

## Source files vs. build outputs

`_sources/` contains what authors write. `build/` contains what the postprocessor generates.

The `build/` directory **must never be edited by hand**. Applications and other registers should
reference resources from `build/`, not `_sources/`.

## Human-readable documentation (`description.md`)

Long-form Markdown documentation for a block goes in `description.md` in the block directory.

- Relative links and images (`some/relative/link.ext`) are resolved to full source URLs when the
  block is published.
- To cross-reference *another block* from within the prose (as opposed to a schema `$ref`), use the
  `bblocks://my.prefix.my.bb` URL scheme as a plain link target — this resolves on deployed pages
  and in the local viewer alike, e.g. `[see also](bblocks://ogc.geo.features.feature)`.

## Static assets

Any files in an `assets/` subdirectory (or any subdirectory, really — the name is a convention) are
copied directly to the GitHub Pages output alongside the block. Use them for images referenced in
`description.md` or other documentation. These are served as-is and are not post-processed.

## Local URL mappings

`bblocks-config-local.yml` (gitignored) redirects remote import URLs to local paths for offline or
restricted-network testing — see [imports-profiles.md](imports-profiles.md).
