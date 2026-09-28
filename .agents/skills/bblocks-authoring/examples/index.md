# Authoring Examples

Concrete, minimal examples copied from the canonical example register:
**https://github.com/ogcincubator/bblocks-examples**

The full source tree is publicly browsable on GitHub. The `_sources/` directory contains all block
source files, organized by pattern category (`feature/`, `semantic-uplift/`, `transforms/`,
`validators/`, `observation/`, `rules/`, `ogcapi/`). When the examples here are insufficient,
browse or fetch files from that repository directly.

Each subdirectory below is a self-contained block source tree illustrating a specific pattern.

| Directory | Pattern | Key files |
|-----------|---------|-----------|
| [basic-schema/](basic-schema/) | Profile an imported block; negative test | `bblock.json`, `schema.yaml`, `examples.yaml`, `tests/` |
| [with-context/](with-context/) | JSON-LD context + semantic uplift steps | `context.jsonld`, `semantic-uplift.yaml` |
| [with-transforms/](with-transforms/) | Multiple transform types | `transforms.yaml` |
| [importing-block/](importing-block/) | Import SOSA; compose two bblocks in one schema | `bblock.json`, `schema.yaml`, `bblocks-config.yaml` |
| [validator-plugins/](validator-plugins/) | Validator plugins for custom file types | `bblock.json`, `bblocks-config.yaml` |

## What the `bblocks-config.yaml` looks like for these examples

All examples in bblocks-examples share a single register config. The key parts are:

```yaml
identifier-prefix: ogc.bbr.examples.
name: Building Blocks Examples
imports:
  - default
  - https://opengeospatial.github.io/ogcapi-sosa
plugins:
  transforms:
    - pip: git+https://github.com/ogcincubator/bblocks-jinja2-transform-plugin.git
      modules: [bbplugin_jinja2]
  validators:
    - pip: git+https://github.com/ogcincubator/bblocks-sample-validator-plugins.git
      modules: [bbplugin_sample_validators]
```

The `imports` entries make `bblocks://ogc.sosa.*` references resolvable.
The `plugins` entries enable the custom transform and validator types shown in the examples.
