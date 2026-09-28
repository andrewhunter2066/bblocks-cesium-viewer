# Imports and Profiles

## Importing other registers

A bblocks repository can import any other register so that references to blocks in those registers
(via `bblocks://` URIs in schemas, or in `bblock.json` metadata) are automatically resolved.

Imports are declared in `bblocks-config.yaml`:

```yaml
imports:
  - default                                             # the main OGC Building Blocks register
  - "@acme/other-register"                              # preferred over a raw URL — see below
  - https://example.org/other-register/build/register.json
```

- If `imports` is **omitted**, the main OGC register is imported by default.
- `default` is an alias for the main OGC register.
- An **empty array** `[]` imports nothing.
- If the URL ends with `build/register.json` or `register.json`, you can omit the suffix — the
  postprocessor tries the base URL and common suffixes automatically.
- `"@org/register"` is an alias resolved against a meta-registry — see
  [register-config.md](register-config.md#imports) for the full syntax and the `meta-registry`
  config key. Prefer it over a raw URL: it survives the target register moving host or repo.

### Local URL mappings (offline / restricted registers)

If an imported register isn't publicly reachable — internal network, air-gapped environment, or
just to avoid hitting the network on every run — redirect its URL to a local checkout with
`bblocks-config-local.yml` (gitignored, sits next to `bblocks-config.yaml`):

```yaml
url-mappings:
  'https://example.com/bbr/': '/imports/ogc/bblock-prov-schema'
  'https://example.com/relative/': '../../ogc/bblock-prov-schema'
```

Any request to `https://example.com/bbr/...` is redirected to `/imports/ogc/bblock-prov-schema/...`
(and similarly for the relative-path mapping) — for example
`https://example.com/bbr/path/to/file.txt` resolves to `/imports/ogc/bblock-prov-schema/path/to/file.txt`.

When running the postprocessor via Docker, the local checkout must also be mounted as a volume so the
container can see it at that path:

```bash
docker run ... -v "$(pwd)/../../ogc/bblock-prov-schema:/imports/ogc/bblock-prov-schema" ...
```

If you're using `build.sh` (see [local-iteration.md](local-iteration.md)), add the mapping to a
`.volumes` file instead of editing the Docker command by hand — one `<local path>:<container mount path>`
pair per line:

```
/absolute/path/to/mount:/mount/absolute
../relative/path:/mount/relative
```

To run fully offline, also drop `--pull=always` from the `docker run` invocation — otherwise Docker
tries to check for a newer image on every run even when one is already cached locally.

### Finding blocks to reuse

Before you can reference a block via `bblocks://<identifier>`, you need its identifier. The
[OGC Blocks meta-register](https://defs-dev.opengis.net/bblocks-meta-register) offers hybrid keyword/semantic
search across every register it knows about, not just the ones you've imported, without a manual per-register
fetch — prefer it when available, via its
[MCP server](https://defs-dev.opengis.net/bblocks-meta-register-backend/mcp) if your environment supports MCP
tools, or its [REST API](https://defs-dev.opengis.net/bblocks-meta-register-backend/openapi.json) otherwise (fetch
the OpenAPI doc first to see available endpoints — the bare backend URL has no index page). (It's still a
development project — the URL may change once a production deployment exists.) Otherwise, query the imported
register's `register.json` directly: it publishes a `bblocks` array of summary objects, each with at least
`itemIdentifier`, `name`, `abstract`, `status`, and `dependsOn`.

If you're about to model a JSON-LD term or SHACL shape for a concept that already has a well-known ontology
URI (e.g. `geosparql:hasGeometry`, `schema:startDate`), check the meta-register's semantic-binding lookup first
(its MCP server exposes this as a distinct tool from keyword/semantic search) — an existing bblock may already
bind that exact predicate/class, and reusing it beats minting a competing binding that can't interoperate with
data uplifted through the other one.

```bash
curl -s https://<register-base-url>/build/register.json -o /tmp/register.json

# List every identifier with its name, to skim for a candidate
jq '.bblocks[] | {itemIdentifier, name, status}' /tmp/register.json

# Search by keyword in name/abstract
jq '.bblocks[] | select((.name + " " + .abstract) | test("feature"; "i")) |
    {itemIdentifier, name}' /tmp/register.json
```

Only `stable` (or at least non-`retired`/non-`invalid`) blocks are safe to build on for anything
beyond experimentation — check `status` before committing to a dependency.

### What importing gives you

- `bblocks://` URIs in schema `$ref` are resolved to the imported block's annotated schema URL.
- `bblocks://` URIs in metadata fields (`isProfileOf`, `dependsOn`, `extensionPoints`) are resolved to the referenced block. Bare identifiers are also accepted in these fields, but `bblocks://` URIs are preferred for consistency.
- The imported block's JSON-LD context is inherited into the assembled context.
- The imported block's SHACL shapes are inherited for validation.
- The imported block's SHACL closure graph — declared `shaclClosures`, its `ontology`, and any
  RDF (not e.g. CSV/NetCDF) `resources` with `role: data` — is inherited too. See
  [semantic/shacl.md](semantic/shacl.md#inheritance).

---

## `isProfileOf` — declaring a profile

A **profile** is a block that specialises another: it is a stricter, backward-compatible
extension. Any data valid for the profile is also valid for the base block.

Declare this relationship in `bblock.json`:

```json
{
  "isProfileOf": "bblocks://ogc.geo.features.feature"
}
```

Or as an array for multiple bases:

```json
{
  "isProfileOf": [
    "bblocks://ogc.geo.features.feature",
    "bblocks://ogc.ogc-utils.geojson"
  ]
}
```

Bare identifiers (e.g. `"ogc.geo.features.feature"`) are also accepted.

`isProfileOf` is a metadata declaration — it records the relationship in the register and
exposes it to tools and validators. The actual stricter constraints are expressed through the
block's JSON Schema (using `allOf` and additional constraints) and SHACL shapes.

---

## `isProfileOf` vs. `dependsOn`

| | `isProfileOf` | `dependsOn` |
|-|---------------|-------------|
| Semantic meaning | This block specialises (is a stricter subset of) the referenced block | This block requires the referenced block at runtime |
| Inherits context / shapes | Yes | No |
| Constraint relationship | Implied (profile is stricter) | None |

---

## Conformance and requirement classes

For blocks that relate to OGC/ModSpec specifications:

- `requirementClasses`: URIs of requirement classes that can be used to validate this block.
- `conformanceClasses`: URIs of conformance classes that this block refers to.

These are informational metadata — they are recorded in the register and can be used by
conformance testing tools, but the postprocessor does not enforce them directly.

---

**Example:** [examples/importing-block/](examples/importing-block/) — imports the SOSA register, then profiles two SOSA blocks in a single schema using `bblocks://`.

---

## `bblocks://` URI scheme in schemas

To reference another block's schema from your own:

```yaml
"$ref": "bblocks://ogc.geo.features.feature"
```

At postprocessing time, this is resolved to the actual annotated schema URL from the imported register.
The referenced block's JSON-LD context, SHACL shapes, and SHACL closure graph (closures, ontology,
RDF data resources) are automatically inherited.

This only works for blocks in imported registers. If the register is not listed in `imports`, the
`bblocks://` URI will fail to resolve.
