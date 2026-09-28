# Running a block's transforms

`bblocks-client-python` doesn't execute transforms (see [python-client.md](python-client.md)) — if
you need to actually run one, you dispatch on `type` yourself. This file covers the built-in types
and custom types added via transform plugins.

## Media type values

`inputs.mediaTypes`/`outputs.mediaTypes` (and a snippet's declared language, see
[examples-and-docs.md](examples-and-docs.md)) are already canonicalized by the register's
postprocessor before publishing — you'll only ever see the canonical MIME string, never a bare
alias/shorthand. As of this writing the known set is: `application/json`, `text/turtle`,
`application/rdf+xml`, `application/ld+json`, `application/xml`, `application/x-yaml`, `text/csv`,
`application/geo+json`. Match against these exactly; don't also try to match aliases like `ttl`,
`jsonld`, `turtle`, or `rdf/xml` — those never appear in published output.

## What you already have

A block's `transforms` array (present directly in the `bblocks[]` summary — see
[register.md](register.md) — no extra fetch needed) is a list of objects with `id`, `description`,
`type`, `code` (already inlined as text, even if the source declared a separate `ref` file),
`inputs.mediaTypes`/`outputs.mediaTypes`, and for `python`/`node` types, optionally
`metadata.dependencies` (`pip`/`python` or `npm`/`node` version constraints).

## Built-in types — how to run each yourself

These all run `code` through a normal library call; none of them need anything beyond what you'd
already install for validation/uplift in this skill.

| `type` | What you need | How |
|---|---|---|
| `jq` | `pip install jq` | `jq.compile(code).input_text(input_str).text()` |
| `sparql-update` | `rdflib` | Parse input into a `Graph`, then `graph.update(code)` (mutates in place). |
| `sparql-construct` | `rdflib` | `graph.query(code).graph` — produces a new graph. |
| `shacl-af-rule` | `rdflib` + `pyshacl` | `pyshacl.validate(data_graph=graph, shacl_graph=Graph().parse(data=code), advanced=True, inplace=True)` — mutates `graph` via the SHACL Advanced Features rules. |
| `xslt` | `lxml` | `lxml.etree.XSLT(lxml.etree.XML(code.encode()))(lxml.etree.XML(input_xml.encode()))`. |
| `json-ld-frame` | `pyld`, `rdflib` (if input isn't already JSON-LD) | `pyld.jsonld.frame(input_doc, json.loads(code))` — if input is Turtle/RDF-XML, parse with `rdflib` and serialize to `json-ld` first. |
| `python` | A Python interpreter; install whatever `metadata.dependencies.pip` lists | Bind `input_data` plus a `transform_metadata` namespace (see below) in the exec globals, run `code`, read back `output_data` — see [wiring metadata and context](#wiring-metadata-and-context). |
| `node` | A working Node.js install (`node` on `PATH`); `npm install` whatever `metadata.dependencies.npm` lists | The snippet is plain statements (not a function) that read an `inputData` variable and a `transformMetadata` object, and assign to `outputData` — wrap it before running: write a temporary `.js` file that defines `inputData`/`transformMetadata` from your input, then the transform's `code` verbatim, then prints `outputData`; run with `node thatfile.js`. See [wiring metadata and context](#wiring-metadata-and-context). |
| `semantic-uplift` | [`ogc-na-tools`](https://pypi.org/project/ogc-na/) | This type uses that library's own uplift-mapping format — out of scope for `bblocks-client-python`; install `ogc-na` if you need to run this specific type. |

`sparql-update`/`sparql-construct`/`shacl-af-rule` expect RDF input — Turtle or RDF/XML, matching
`inputs.mediaTypes`; parse with `rdflib.Graph().parse(data=..., format=...)` first if your data isn't
already a graph.

## Wiring metadata and context

`python`/`node` transform `code` is written assuming the postprocessor's runtime environment, so it
may reference more than just the input variable. To run such code faithfully outside the
postprocessor, bind these before `exec`/writing the wrapper file:

- **`transform_metadata.metadata`** (Python) / **`transformMetadata.metadata`** (Node) — the
  transform's own `metadata` object from `transforms.yaml` (keys starting with `_` excluded). You
  already have this: it's the `metadata` field on the transform object from the block's `transforms`
  array (see [What you already have](#what-you-already-have)).
- **`source_mime_type`/`sourceMimeType`**, **`target_mime_type`/`targetMimeType`** — the actual
  input media type you're feeding it and the transform's declared output media type
  (`inputs.mediaTypes[0]`/`outputs.mediaTypes[0]`, or whichever one matches your data).
- **`context`/`ctx`** — a namespace describing the building block, register, and run. Populate the
  fields you can derive from the register summary you already have (see [register.md](register.md)):
  `bblock_id` (the summary's `itemIdentifier`), `bblock_name` (`name`), `bblock_version`
  (`version`), `bblock_tags` (`tags`), `bblock_metadata` (the summary object itself). Leave
  build-only fields — `bblock_files_path`, `bblock_annotated_path`, `source_schema_path`,
  `annotated_schema_path`, `jsonld_context_path`, `shacl_shapes_paths`, `output_file`, `output_dir`,
  `working_dir`, `example`, `example_index`, `snippet`, `snippet_index` — as `None`/empty: they
  point into a checked-out source tree and a postprocessing run that don't exist for you. Code that
  branches on these (rather than just logging them) won't run correctly standalone; treat that as a
  hard limitation, not something to fake.
- **`base_url`, `github_base_url`, `git_repository`, `id_prefix`, `imported_register_urls`,
  `transform_plugins`** — register-level context fields; if needed, fill from the register's
  `baseURL`, `gitHubRepository`, `gitRepository`, and `imports`/`transformPlugins` (see
  [register.md](register.md)). `id_prefix` has no register.json equivalent — leave it `None`.

In Python, build a `SimpleNamespace` (or any object with these attributes — plugins use duck typing)
and put it in the `exec` globals alongside `input_data`:

```python
from types import SimpleNamespace

context = SimpleNamespace(bblock_id=summary['itemIdentifier'], bblock_name=summary.get('name'),
                           bblock_version=summary.get('version'), bblock_tags=summary.get('tags', []),
                           bblock_metadata=summary, bblock_files_path=None, bblock_annotated_path=None,
                           source_schema_path=None, annotated_schema_path=None, jsonld_context_path=None,
                           shacl_shapes_paths=[], output_file=None, output_dir=None, working_dir=None,
                           example=None, example_index=None, snippet=None, snippet_index=None,
                           base_url=None, github_base_url=None, git_repository=None, id_prefix=None,
                           imported_register_urls=[], transform_plugins=[])
transform_metadata = SimpleNamespace(type=transform['type'], transform_content=transform['code'],
                                      input_data=input_str, source_mime_type=source_mime,
                                      target_mime_type=target_mime,
                                      metadata=transform.get('metadata', {}), context=context)
ns = {'input_data': input_str, 'transform_metadata': transform_metadata}
exec(code, ns)
result = ns['output_data']
```

In Node, build the equivalent plain object (camelCase keys, snake_case only inside `context`) and
define it in the wrapper file before the transform's `code`.

### `get_transformer` / `getTransformer`

Some `python`/`node` transforms call other blocks' transforms via a built-in composition helper
(`get_transformer(bblock_id, transform_id)` in Python, `getTransformer(bblockId, transformId)` in
Node) instead of duplicating logic. To support this yourself, inject a callable that:

1. Looks up `bblock_id` in the register (and its imports) you already have, finds the matching
   transform by `id` in its `transforms` array.
2. Runs that transform using the same dispatch logic you're using for the outer one (recursing for
   `python`/`node`, or the relevant built-in/plugin handler for other types).
3. Returns the result string/bytes, or raises/throws if the target type is unsupported as a
   composition target (`sparql-*`, `shacl-af-rule`, `semantic-uplift` are not supported targets —
   match this restriction) or if the same `(bblock_id, transform_id)` is already in the current call
   chain (cycle).
4. Merges any caller-supplied `extra_metadata`/`extraMetadata` on top of the target transform's own
   declared `metadata` before constructing its `transform_metadata`/`transformMetadata`.

If the code you're running doesn't call this helper, you can skip implementing it.

There's no reference implementation of `transform_metadata`/`context`/`get_transformer` wiring to
copy from — `bblocks-client-python` only carries the raw `transforms` array on a block, it doesn't
execute anything (see [python-client.md](python-client.md)). The construction shown above is the
guidance, not a pointer to existing code.

## Custom types — transform plugins (Python only)

If a `type` isn't in the table above, the register most likely supports it via a **transform
plugin** declared in the register's top-level `transformPlugins` array (pip reference, module name,
declared types — see [register.md](register.md)). Plugins are Python-only: the mechanism itself is a
duck-typed Python class loaded into a Python process, regardless of what the plugin does internally.

To run one yourself:

1. Find the plugin's `pip` spec and module path in `transformPlugins`.
2. `pip install <that spec>` — it's a normal pip target (package name, version, `git+https://...`, or
   local path).
3. Import the module and find the class whose `transform_types` list contains your `type`.
   Instantiate it and call `.transform(metadata)`, where `metadata` exposes at least: `type`,
   `transform_content` (the transform's `code`), `input_data`, `source_mime_type`,
   `target_mime_type` — a plain object or `SimpleNamespace` with those attributes is enough; the
   class doesn't require a particular base class, just those attributes by duck typing.
4. There's no sandboxing for you here — you're installing the plugin straight into your own
   environment, not into an isolated venv as the register's own build does.

A real example: [bblocks-jinja2-transform-plugin](https://github.com/ogcincubator/bblocks-jinja2-transform-plugin)
adds a `jinja2` type that renders a Jinja2 template (the transform's `code`) against JSON input.
