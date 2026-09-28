# bblocks-client-python

[ogcincubator/bblocks-client-python](https://github.com/ogcincubator/bblocks-client-python) ·
[PyPI: `bblocks_client`](https://pypi.org/project/bblocks-client/)

A small Python library that wraps the patterns in this skill (register loading, JSON Schema
validation with cross-block `$ref` resolution, semantic uplift, SHACL validation) so you don't have to
reimplement them by hand.

**Status: early/Beta.** It covers the common read + validate + uplift path well, but it is not a
complete consumption layer yet — notably, it does **not** currently support running a block's
`transforms`, and it has no offline/caching mode beyond an in-memory dict for the duration of one
process. Treat it as a convenience for the common case, not as the only way to consume a register —
[no-library.md](no-library.md) covers the same ground without it, and remains correct regardless of
the library's pace of development.

## Install

```bash
pip install bblocks_client          # core: load_register
pip install bblocks_client[jsonschema]  # + validate_json
pip install bblocks_client[rdf]         # + validate_shacl, uplift_json (rdflib, pyshacl, jq)
pip install bblocks_client[all]
```

Import path is `ogc.bblocks.*` (different from the PyPI distribution name `bblocks_client`).

## API surface

| Module | Provides |
|---|---|
| `ogc.bblocks.register` | `load_register(url, load_dependencies=True)` → `BuildingBlockRegister`; `.get_item_summary(id)`, `.get_item_full(id)` |
| `ogc.bblocks.validate` | `validate_json(bblock, data)`, `validate_shacl(bblock, graph)` → `ValidationResult` with `.valid`, `.raise_for_invalid()` |
| `ogc.bblocks.semantic_uplift` | `uplift_json(bblock, data, base_uri=None)` → `rdflib.Graph` |
| `ogc.bblocks.util` | `fetch_yaml(url)`, `fetch_url(url)` — injectable as `load_register`'s `yaml_loader` if you want to add your own caching |

`load_register` recursively follows `imports`, so dependency registers are loaded automatically unless
you pass `load_dependencies=False`. `get_item_summary` searches the local register first, then each
imported register.

## Worked examples

See [snippets/load_register.py](snippets/load_register.py), [snippets/validate_json.py](snippets/validate_json.py),
[snippets/uplift_json.py](snippets/uplift_json.py), and [snippets/validate_shacl.py](snippets/validate_shacl.py) —
all runnable as-is against the live `bblocks-examples` register, adapted from the library's own
`test/basic.py`.

## What it doesn't do (yet)

- No transform execution — if a block declares `transforms` (see [register.md](register.md)), this
  library has no support for interpreting or running them; see [transforms.md](transforms.md) for
  how to run them yourself.
- No persistent/offline cache — every `load_register` call fetches live over HTTP.
- `test_outputs` and `source_*` fields exist on the data model but nothing in the library fetches or
  parses them automatically.

Check the repo for current status before relying on a capability not listed above as supported.
