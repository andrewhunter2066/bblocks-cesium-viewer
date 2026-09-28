# The register

## `register.json`

Every published register exposes a `register.json` at its root (e.g.
`https://ogcincubator.github.io/bblocks-examples/build/register.json`). The tables below are the
complete field set as actually published — there's no need to fetch-and-inspect a register to
discover what fields exist; treat any field not listed here as register- or block-specific extra
data you can safely ignore.

### Register-level fields

| Field | Meaning |
|---|---|
| `name`, `abstract`, `description` | Register title and prose (Markdown). |
| `imports` | Array of URLs to other registers' `register.json` files this register depends on. |
| `baseURL` | Base URL the register is published under. |
| `viewerURL` | URL of this register's hosted [bblocks-viewer](viewer.md) instance, if deployed. |
| `gitRepository`, `gitHubRepository` | Source repo URL; the latter is a browsable (`/blob/...`) GitHub URL. |
| `modified` | ISO 8601 timestamp of the last build. |
| `sparqlEndpoint` | SPARQL query endpoint for this register's RDF, if pushed to a triplestore. |
| `license` | `{name?, url?}` — the register's default license, inherited by any block that doesn't declare its own (see per-block `license` below). |
| `remoteCacheDir` | URL where cached external resources (e.g. imported schemas) are mirrored. |
| `validationReport`, `validationReportJson` | URLs to the register-wide test report (HTML / JSON) — see [validation.md](validation.md#reading-validation-results-from-the-register-itself). |
| `tooling` | Dict with build-tool versions/commit info (provenance, not consumption-relevant). |
| `links` | Array of `{rel, href, type, title}` — e.g. self-links to `bblocks.jsonld`/`bblocks.ttl`. |
| `transformPlugins`, `validatorPlugins` | Custom plugin module config for the register's own build pipeline — a producer-side concern, not something a consumer needs to act on. |
| `bblocks` | Array of **summary** objects, one per block — see below. |

A legacy format (a bare JSON array of block summaries, no wrapping object/`imports`) also exists in
the wild; check for an array vs. an object before assuming the new shape.

### Per-block summary fields (`bblocks[]`)

These are the fields as **published** in `register.json` — the postprocessed output. If you've also
seen a block's *source* metadata file (`bblock.json`, written by the block's author), don't reuse
that shape here: several field names overlap but the type differs, notably `schema` (a single
path/URL in source metadata, a `{mediatype: url}` dict here) and `shaclShapes` (an array in source
metadata, an `{identifier: [url, ...]}` dict here).

| Field | Meaning |
|---|---|
| `itemIdentifier` | Globally unique identifier, e.g. `ogc.geo.features.feature`. |
| `name`, `abstract` | Display name and short Markdown summary. |
| `status` | `under-development`, `experimental`, `stable`, `superseded`, `retired`, `invalid`, `reserved`, `submitted`. |
| `itemClass` | `schema`, `datatype`, `path`, `parameter`, `header`, `cookie`, `response`, `api`, `model`, ... |
| `version`, `dateTimeAddition`, `dateOfLastChange` | Versioning and lifecycle timestamps. |
| `register` | Name of the register this block belongs to (useful once you've merged several via `imports`). |
| `maturity`, `scope` | Free-text classification fields (e.g. `development`/`stable`, `stable`/`unstable`). |
| `group`, `tags`, `highlighted`, `sources` | Display/categorization metadata. |
| `license` | `{name?, url?}` — this block's license, already resolved from its own `bblock.json` or inherited from the register's `license` (see above). |
| `dependsOn` | Array of identifiers this block has a runtime dependency on. |
| `isProfileOf` | Array of identifiers this block profiles (stricter specialization). |
| `extensionPoints` | Substitution mappings letting this block's schema swap in a different block at a defined extension point. |
| `transforms` | Array of declared reusable conversion steps for this block — see [transforms.md](transforms.md) for how to run them yourself. |
| `schema` | `{mediatype: url}` dict — the **annotated** schema. See [schema-integration.md](schema-integration.md). |
| `sourceSchema` | URL of the unprocessed author-written schema (don't use for consumption). |
| `openAPIDocument`, `sourceOpenAPIDocument` | Same pattern as `schema`/`sourceSchema`, for OpenAPI blocks. |
| `ldContext`, `sourceLdContext` | Assembled vs. own-only JSON-LD context. See [semantic-uplift.md](semantic-uplift.md). |
| `ontology` | URL to an RDF ontology file, for RDF-only blocks. |
| `shaclShapes` | `{identifier: [url, ...]}` dict of SHACL shape files. See [validation.md](validation.md#shacl-validation). |
| `resolvedSchemaProperties` | URL of a flattened, tabular view of schema properties (what the viewer's "Data structure" tab renders). |
| `resources` | Array of external artifacts (data files, vocabularies, ...). |
| `sourceFiles` | URL/path to the block's source directory in its repo. |
| `validationPassed` | Boolean — whether the block's own bundled examples currently validate. |
| `testOutputs` | URL to this block's test resources. |
| `documentation` | Dict keyed by doc type (`json-full`, `markdown`, `bblocks-viewer`) → `{mediatype, url}`. See [examples-and-docs.md](examples-and-docs.md). |

## Resolving imports

`imports` is recursive: a register you depend on may itself import further registers. To find every
block reachable from a starting register, walk `imports` breadth- or depth-first, fetching each
`register.json` once (dedupe by URL — cycles and diamond-shaped import graphs are valid). Treat the
union of all `bblocks` arrays across the walk as the lookup space.

There is no separate "resolved/flattened" register file — flattening happens client-side, in whatever
tool consumes the register. Both `bblocks-client-python` and `bblocks-viewer` do this same walk; see
[python-client.md](python-client.md) and [no-library.md](no-library.md) for the pattern in code.

## Looking up a block

1. Search the starting register's `bblocks` array for a matching `itemIdentifier`.
2. If not found, search each imported register's `bblocks` array (recursively).
3. The summary is enough for most read-only purposes (which schema URL to fetch, whether it depends
   on something else, what status it's in). Only fetch the **full** block — via
   `documentation['json-full'].url` — when you need examples, the inline annotated schema text, or
   semantic uplift step definitions.

## Finding a block outside a known register

Everything above only finds a block if you already know which register (or import chain) it lives in. If you need
to resolve a `bblocks://` reference, a `dependsOn`/`isProfileOf` identifier, or just search by keyword, and it
isn't in any register you're already walking, the
[OGC Blocks meta-register](https://defs-dev.opengis.net/bblocks-meta-register) crawls and indexes every register in
the ecosystem — not just the ones a given register happens to `import`. Query it via:

- its [MCP server](https://defs-dev.opengis.net/bblocks-meta-register-backend/mcp) (streamable HTTP transport) if
  your environment supports MCP tools — hybrid keyword/semantic search, direct lookup by identifier,
  dependency-graph traversal in both directions (what a block depends on, and what depends on it — the latter
  isn't derivable from any single register's own `register.json`), and lookup by semantic binding (an RDF
  predicate/class URI a block's JSON-LD context or SHACL shape already maps to, when you have that URI rather
  than a keyword);
- its [REST API](https://defs-dev.opengis.net/bblocks-meta-register-backend/openapi.json) otherwise — fetch the
  OpenAPI doc to see available endpoints (the bare backend URL 404s; `/docs` is a Swagger UI meant for humans).

**Still a development project** — the deployment above is a dev instance; expect the URL to change once a
production ("definitive") register is available. Stay tuned.

## Relationships between blocks

These are derived from fields already present on each summary — there is no separate relationship
graph file:

| Relationship | Field(s) |
|---|---|
| Plain dependency | `dependsOn` (set of identifiers) |
| Profile (specialization) | `isProfileOf` / `profileOf` |
| Extension point | `extensionPoints` (base block + extension source/target identifiers) |

When walking dependencies across registers, stop expanding into a register you didn't import yourself
unless you actually need transitive detail — `bblocks-viewer` defaults to this behavior (only
expanding local blocks fully) to keep dependency graphs readable.

## Register-level RDF outputs

Besides `register.json`, a register also publishes `bblocks.jsonld`/`bblocks.ttl` — `register.json`
itself semantically uplifted to RDF, i.e. the register metadata and every block's summary in one
graph. (There is no separate `register.jsonld`/`register.ttl` pair — `bblocks.jsonld`/`bblocks.ttl`
is the only RDF form of the register.) Useful if you want to query register metadata with SPARQL
instead of walking JSON; most per-block consumption tasks don't need it.
