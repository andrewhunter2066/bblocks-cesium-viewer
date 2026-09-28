# Transform Plugins

Transform plugins add support for custom transform types that the postprocessor does not know about
natively. They are appropriate when you need a reusable transform type across multiple blocks — for
one-off conversions, a `python` or `node` transform in `transforms.yaml` is usually simpler.

---

## Declaration in `bblocks-config.yaml`

```yaml
plugins:
  transforms:
    - pip: git+https://github.com/example/my-bblocks-plugin.git
      modules:
        - my_bblocks_plugin
```

`pip` accepts any specifier that `pip install` understands: package names, version constraints,
GitHub URLs (`git+https://...`), local paths.

> **Legacy:** The old `transform-plugins.yml` file is deprecated. Move its contents to
> `plugins.transforms` in `bblocks-config.yaml`.

---

## Package layout

A transform plugin is an ordinary installable Python package — no entry points, decorators, or
special package metadata are needed. `pip` just needs to be able to install it; the postprocessor
then imports the module(s) listed under `modules` and scans them by duck typing.

Minimal layout:

```
my-bblocks-plugin/
├── pyproject.toml
└── my_bblocks_plugin/
    └── __init__.py       # defines the transformer class(es)
```

```toml
# pyproject.toml
[build-system]
requires = ["setuptools"]
build-backend = "setuptools.build_meta"

[project]
name = "my-bblocks-plugin"
version = "0.1.0"
dependencies = []          # runtime deps the transform code needs, e.g. "jinja2"
```

The distribution name (`my-bblocks-plugin`) and the importable module name
(`my_bblocks_plugin`, listed under `modules`) don't have to match.

**Local development loop:** while iterating, point `pip:` at the plugin's local directory instead
of a Git URL — a relative path resolves from wherever you invoke the postprocessor (the register
root, with the standard Docker invocation). The postprocessor reinstalls from that path on every
run, so edits take effect immediately with no publish step:

```yaml
plugins:
  transforms:
    - pip: ../my-bblocks-plugin
      modules:
        - my_bblocks_plugin
```

Then run the postprocessor against a scratch block with `--filter ... --skip-permissions true`
(see [local-iteration.md](local-iteration.md)) to exercise the plugin end to end. Switch `pip:`
back to the published Git URL/version before committing `bblocks-config.yaml`.

---

## How a plugin is recognized

The postprocessor scans the listed Python modules for classes that have:

- `transform_types`: a non-empty list of type name strings
- `transform(metadata)`: a callable accepting a metadata object

No base class or decorator is needed — recognition is by duck typing.

---

## The `metadata` object

The `metadata` argument passed to `transform()`:

| Attribute | Type | Description |
|-----------|------|-------------|
| `type` | `str` | The transform type string (e.g. `jinja2`) |
| `transform_content` | `str` | The code or script from `transforms.yaml` (`code` or `ref`) |
| `input_data` | `str` | The example snippet text |
| `source_mime_type` | `str` | MIME type of the input |
| `target_mime_type` | `str` | MIME type of the declared output |
| `metadata` | namespace | Extra metadata from the transform declaration (keys starting with `_` excluded). Supports both attribute and dict-style access |
| `ctx` | `SimpleNamespace` | Full [transform context](transforms.md#transform-context) |

---

## Return value and error handling

- Return a `str` or `bytes` to produce output.
- Return `None` to produce no output (not an error).
- Raise any exception to signal failure — the traceback is captured and reported.
- Output to `stdout` / `stderr` is captured and logged at DEBUG level.

---

## Optional class attributes

| Attribute | Description |
|-----------|-------------|
| `default_inputs` | Default input media types (used when `inputs` is not declared in `transforms.yaml`) |
| `default_outputs` | Default output media types (used when `outputs` is not declared) |

---

## Isolation

Each plugin runs in its own isolated virtualenv (auto-created under `.bblocks-sandbox/plugins/`),
so dependency conflicts with the postprocessor or other plugins are not a concern.

---

## Minimal plugin example

```python
# my_bblocks_plugin/__init__.py
import json

class MyTransformer:
    transform_types = ['my-type']
    default_inputs = ['application/json']
    default_outputs = ['text/plain']

    def transform(self, metadata):
        data = json.loads(metadata.input_data)
        # metadata.transform_content holds the code/expression from transforms.yaml
        return str(data)
```

A real-world example:
[bblocks-jinja2-transform-plugin](https://github.com/ogcincubator/bblocks-jinja2-transform-plugin)
— adds a `jinja2` type that renders Jinja2 templates against JSON input.

---

## Plugin metadata in the register

Plugin metadata (types, class names, pip reference, URL) is included in `register.json` under
`transformPlugins`. The postprocessor derives a display URL from the `pip` specifier automatically;
override it with an explicit `url` field:

```yaml
plugins:
  transforms:
    - pip: git+https://github.com/example/my-plugin.git
      url: https://github.com/example/my-plugin
      modules:
        - my_plugin
```
