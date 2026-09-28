# Test Resources

Schema for `tests.yaml`:
[`tests.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/tests.schema.yaml)

Test resources are separate from examples: examples are documentation-first; test resources are
validation-first. A block can have both, neither, or either.

---

## Auto-detected tests (`tests/` directory)

Files placed in the `tests/` subdirectory are automatically picked up. No configuration needed.

The built-in validators filter by file extension:

| Extension | What happens |
|-----------|-------------|
| `*.json` | JSON Schema validation → semantic uplift (if context present) → SHACL validation |
| `*.jsonld` | JSON Schema validation → SHACL validation |
| `*.ttl` | SHACL validation only |

Files with other extensions are silently skipped unless a [validator plugin](validation-plugins.md)
claims them via `mime_types` or `file_extensions`.

---

## Explicit tests (`tests.yaml`)

Useful for referencing test resources at known URLs (e.g., sample data published alongside a
specification) without duplicating files in the repository:

```yaml
- ref: https://example.org/samples/valid-feature.json
- ref: https://example.org/samples/invalid-feature.json
  require-fail: true
- ref: local-extra.json
  output-filename: renamed-output.json
- ref: assets/my-geometry.wkt
  media-type: text/wkt
```

### `tests.yaml` entry fields

| Field | Required | Description |
|-------|----------|-------------|
| `ref` | yes | URL or local filename (relative to `tests.yaml`) |
| `require-fail` | no | If `true`, validation passes only when the test **fails** (negative test). Default: `false` |
| `output-filename` | no | Filename for the uplifted output files. Defaults to the filename from `ref`. |
| `media-type` | no | Explicit MIME type. Use when the extension doesn't map to a standard type or a plugin requires a specific type. |

---

## Negative test cases

A test resource whose filename ends in `-fail` (e.g. `missing-required-field-fail.json`) is a
**negative test**: validation passes only if the resource actually fails validation.

The equivalent in `tests.yaml` is `require-fail: true`.

Use negative tests to verify that your schema correctly rejects invalid data.

---

## Validation pipeline

Each test resource (and each example snippet) goes through this pipeline:

1. **JSON Schema validation** — if the block has a schema
2. **Semantic uplift** — if JSON input and a context are present; produces `{name}.jsonld` and `{name}.ttl`
3. **SHACL validation** — if SHACL shapes are defined
4. **Plugin validation** — if [validator plugins](validation-plugins.md) are configured and the file
   type is claimed

Outputs are written to `build/tests/{block-id}/`. A summary report is at `build/tests/report.html`.

See [validation.md](validation.md) for how to run and interpret results.

---

**Example:** [examples/basic-schema/tests/feature-fail.json](examples/basic-schema/tests/feature-fail.json) — a negative test (filename ends in `-fail`) that passes only when validation rejects it.

---

## Examples vs. tests

| | Examples (`examples.yaml`) | Tests (`tests/` or `tests.yaml`) |
|-|---------------------------|----------------------------------|
| Primary purpose | Documentation | Validation coverage |
| Appears in generated docs | Yes | No |
| Auto-validated | Yes | Yes |
| Supports negative cases | No | Yes (`-fail` suffix or `require-fail: true`) |
| Supports external URLs | Via `ref` in snippets | Yes, directly in `tests.yaml` |
