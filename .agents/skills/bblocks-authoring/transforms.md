# Transforms (`transforms.yaml`)

Schema:
[`transforms.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/transforms.schema.yaml)

A block's transforms declare reusable conversion scripts: for data that conforms to this block,
here is how to convert it to another format, encoding, or representation. Clients can discover
these from the register and use them without reimplementing the conversion logic.

During postprocessing, example snippets whose media type matches a transform's declared inputs are
automatically run through it — both as a correctness check and to generate illustrative output.
The transform library is the primary artifact; the snippet outputs are illustrative.

---

## `transforms.yaml` structure

```yaml
transforms:
  - id: my-transform           # required; alphanumeric and dashes only
    description: What it does  # optional; Markdown accepted
    type: jq                   # required; see types below
    inputs:
      mediaTypes:
        - application/json
    outputs:
      mediaTypes:
        - application/json
    code: |
      .foo = "bar"
```

Code can be inline (`code`) or in a separate file (`ref`):

```yaml
  - id: my-transform
    type: jq
    ref: transforms/my-script.jq
```

Output media types can include a default file extension:

```yaml
    outputs:
      mediaTypes:
        - mimeType: text/csv
          defaultExtension: csv
```

Short-form aliases (`json`, `xml`, `turtle`) are accepted and normalized to canonical MIME types.

---

## Built-in transform types

### `jq`
Applies a [jq](https://jqlang.org) expression to JSON input.
Default inputs: `application/json`. Default outputs: `application/json`.

```yaml
  - id: add-type
    type: jq
    code: '.type = "ex:MyFeature"'
```

### `sparql-construct`
Runs a SPARQL CONSTRUCT query on RDF input, producing an RDF graph.
Default inputs: `application/ld+json`, `text/turtle`. Default outputs: `text/turtle`.

### `sparql-update`
Runs a SPARQL UPDATE on an RDF graph in-place.
Default inputs: `application/ld+json`, `text/turtle`. Default outputs: same as input.

### `shacl-af-rule`
Applies [SHACL Advanced Features](https://www.w3.org/TR/shacl-af/) rules to an RDF graph.
Default inputs: `application/ld+json`, `text/turtle`. Default outputs: `text/turtle`.

### `xslt`
Applies an XSLT stylesheet to XML input.
Default inputs: `application/xml`. Default outputs: `application/xml`.

### `json-ld-frame`
Applies a [JSON-LD frame](https://www.w3.org/TR/json-ld11-framing/) to JSON-LD or RDF input.
Default inputs: `application/ld+json`, `text/turtle`. Default outputs: `application/ld+json`.

### `semantic-uplift`
Applies a semantic uplift mapping (ogc-na-tools format) to JSON, producing RDF.
Default inputs: `application/json`. Default outputs: `text/turtle`.
See [semantic/uplift.md](semantic/uplift.md) for the uplift config format.

### `python`
Runs a Python snippet. The snippet receives `input_data` (string or bytes) and must assign its
result to `output_data`.

```yaml
  - id: uppercase-keys
    type: python
    inputs:
      mediaTypes: [application/json]
    outputs:
      mediaTypes: [application/json]
    code: |
      import json
      data = json.loads(input_data)
      output_data = json.dumps({k.upper(): v for k, v in data.items()}, indent=2)
```

With pip dependencies:

```yaml
    metadata:
      dependencies:
        pip: pandas>=1.5
        python: ">=3.10"   # skipped if not met
```

A `transform_metadata` namespace is available with `source_mime_type`, `target_mime_type`,
`metadata` (extra fields from the declaration), and `context` (see [Transform context](#transform-context)).

### `node`
Runs a Node.js snippet. Receives `inputData` (string or Buffer), must assign to `outputData`.
Same capabilities as `python` but using `npm` for dependencies.

```yaml
    metadata:
      dependencies:
        npm: json2csv
        node: ">=18"
```

A `transformMetadata` object is available with the same fields as `transform_metadata` (snake_case keys).

---

## Composing transforms: `get_transformer` / `getTransformer`

Python and Node transforms can call any other supported transform (in the same or another block):

```python
# Python
convert = get_transformer('ogc.example.other-bblock', 'my-jq-transform')
output_data = convert(input_data)
```

```javascript
// Node
const convert = getTransformer('ogc.example.other-bblock', 'my-jq-transform');
outputData = convert(inputData, { sourceMimeType: 'application/json' });
```

Supported target types: `python`, `node`, `jq`, `xslt`, `json-ld-frame`.
SPARQL, SHACL-AF, and `semantic-uplift` are not supported as targets.

Cycle detection raises an error if a transform is called recursively.

Each invoked transform receives **its own** declared `metadata` from `transforms.yaml`, not the
caller's — pass `extra_metadata` (Python) / `opts.extraMetadata` (Node) to forward values
explicitly; they're merged on top of (and take priority over) the target's own declared metadata.

The target transform's metadata also gains `_nested_transform: true` when invoked this way, letting
a transform behave differently as a sub-transform versus running as a top-level postprocessing step.

---

## Output profile validation

A transform's outputs can be validated against one or more block profiles:

```yaml
transforms:
  - id: to-feature
    type: jq
    outputs:
      mediaTypes: [application/geo+json]
      profiles:
        - bblocks://ogc.geo.features.feature
```

During postprocessing, every output file is validated against each declared profile (JSON Schema +
JSON-LD + SHACL). Results are written to `build/tests/.../transforms/` and summarized in `register.json`.

---

## Transform context

All executable transform types receive a `context` (or `ctx`) with metadata about the block, example,
and run. Key fields:

| Field | Description |
|-------|-------------|
| `bblock_id` | Block identifier |
| `bblock_files_path` | Absolute path to the block's source directory |
| `bblock_metadata` | Full block metadata snapshot at transform time |
| `working_dir` | Working directory at postprocessing time |
| `source_schema_path` | Relative path to the source schema |
| `annotated_schema_path` | Relative path to the annotated schema |
| `jsonld_context_path` | Relative path to the generated JSON-LD context |
| `example_index` | Zero-based index of the current example |
| `example` | Full example object (title, prefixes, etc.) — `snippets` excluded |
| `snippet_index` | Zero-based index of the current snippet |
| `snippet` | Full snippet object (language, url, ref, json-path, prefixes, etc.) — `code` excluded (use `input_data`/`inputData` instead) |
| `output_file` | Absolute path where transform output will be written |
| `base_url` | Base URL for generated output |

> `bblock_metadata` reflects the state at transform time — fields populated later (e.g., `documentation`)
> will not be present yet.

> When a snippet uses `json-path` (see [examples.md](examples.md)), `snippet['full-code']` holds the
> complete content of the referenced file *before* path extraction — useful when the transform needs
> more context than the extracted value alone.

> `snippet['shacl-closure']` holds the merged, deduplicated list of SHACL closure entries from both
> the block's `shaclClosures` (`bblock.json`) and the snippet's own `shacl-closure` (`examples.yaml`).
> Entries may be URLs or paths relative to the block's source directory:
> ```python
> import os
> closures = context.snippet.get('shacl-closure') or []
> resolved = [c if c.startswith('http') else os.path.join(context.working_dir, context.bblock_files_path, c)
>             for c in closures]
> ```

---

**Examples:**
- [examples/with-transforms/transforms.yaml](examples/with-transforms/transforms.yaml) — jq, sparql-update, python (with/without deps), node, output profile validation.
- [ogcincubator/bblocks-examples `transforms-reuse`](https://github.com/ogcincubator/bblocks-examples/tree/main/_sources/transforms/transforms-reuse) — cross-block `get_transformer` / `getTransformer` composition.

---

## Custom transform types

To use a transform type not in the built-in list, declare it in `transforms.yaml` — it will be
recorded in the register for external tools. To also execute it during postprocessing, add a
transform plugin. See [transform-plugins.md](transform-plugins.md).
