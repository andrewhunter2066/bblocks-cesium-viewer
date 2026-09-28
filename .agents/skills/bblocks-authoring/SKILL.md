---
name: bblocks-authoring
description: "Reference skill for authoring OGC Blocks (bblocks): source file structure, metadata (bblock.json), JSON Schema, examples, tests, JSON-LD contexts, SHACL shapes, semantic uplift, transforms, validation, and register publishing. Use when working with bblock.json, schema.yaml, examples.yaml, bblocks-postprocess, or any OGC Building Blocks register."
---

# OGC Blocks — Authoring Skill

This skill covers how to **author OGC Blocks** (bblocks): how to write, structure, and test the source
files that the postprocessor turns into reusable, machine-readable specification components.

Official branding is **OGC Blocks**. The legacy name is *OGC Building Blocks*. `bblocks` is the
code-level identifier used in file names, identifiers, and tooling.

---

## Prerequisites

Running the postprocessor or viewer locally (see [local-iteration.md](local-iteration.md),
[quickstart.md](quickstart.md)) requires **Docker**. All commands in this skill are written for a
POSIX shell (bash-style syntax, e.g. `$(pwd)`). **On Windows**, run them from
[Git Bash](https://git-scm.com/downloads/win) (bundled with Git for Windows) or, for the smoothest
experience, [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) with Docker Desktop's WSL 2
integration enabled — there is no `.bat`/PowerShell equivalent.

---

## What is an OGC Block?

An OGC Block is a reusable specification component packaged as a directory of source files. Each block
combines some or all of:

- a **JSON Schema** (the data model)
- a **JSON-LD context** (semantic annotations mapping JSON properties to RDF predicates)
- **SHACL shapes** (RDF graph constraints)
- **examples** with inline or file-referenced snippets
- **test resources** (additional files for automated validation)
- **transforms** (reusable conversion scripts)
- **metadata** (`bblock.json`)

The postprocessor reads these sources and produces:

- annotated schemas with semantic properties inlined
- assembled JSON-LD contexts
- generated HTML documentation
- validation reports
- a `register.json` index

A **register** is a collection of blocks published from a single repository.

---

## Design patterns

Blocks are commonly combined in a handful of recurring patterns. These aren't mutually exclusive —
a block can combine several — but naming the pattern you're after helps you find the right file:

| Pattern | What it is | See |
|---------|-----------|-----|
| **Aggregation/Composition** | A schema built by aggregating other blocks (e.g. via `$ref`/`allOf`) | [schema.md](schema.md) |
| **Extension** | Adds properties to another schema/model. Also a form of profiling: it constrains what an "open to extension" schema's extra content must look like | [schema.md](schema.md) |
| **Specialisation** | Constrains an existing attribute with a more specific model — e.g. fixing a `FeatureCollection`'s feature type | [extension-points.md](extension-points.md) |
| **Semantic annotation** | Binds schema elements to definitions via JSON-LD. Matters most when one schema could map to more than one ontology | [semantic/context.md](semantic/context.md) |
| **Profiling** | Adds constraints for a particular context; may combine specialisation, extension, rules, or vocabulary bindings. Declared via `isProfileOf` in `bblock.json` — the same relationship as `prof:isProfileOf` in the W3C [Profiles Vocabulary (PROF)](https://www.w3.org/TR/dx-prof/) | [imports-profiles.md](imports-profiles.md) |
| **Vocabulary Bindings** | Constrains a value to a controlled vocabulary — static, or dynamic/service-backed (the latter needs a custom validator, since no standard covers it) | [validation-plugins.md](validation-plugins.md) |
| **Transformations** | A block defined around a transformation between specifications; validated against the post-transform target if that target is itself a block | [transforms.md](transforms.md) |
| **Testing examples** | A block scoped purely to supplying/testing examples for another specification | [examples.md](examples.md), [tests.md](tests.md) |
| **Documenting validators** | A block whose job is providing test cases, docs, and CI for a validation tool — typically tied to specific profiles | [validation-plugins.md](validation-plugins.md) |

The `resources` well-known role vocabulary (see [metadata.md](metadata.md#well-known-resource-roles))
is likewise reused directly from PROF's Resource Role instances, not invented independently.

---

## Key concepts

| Term | Meaning |
|------|---------|
| **register** | A published collection of blocks from one repo, indexed in `register.json` |
| **identifier** | Globally unique dot-separated string, e.g. `ogc.geo.features.feature` |
| **identifier prefix** | Per-repo string from `bblocks-config.yaml`; concatenated with the block's directory path to form its identifier |
| **annotated schema** | The postprocessor output schema: source schema + inherited `x-jsonld-*` annotations resolved |
| **assembled context** | The merged JSON-LD context built from a block's own context plus all imported blocks' contexts |
| **profile** | A block that specialises another via stricter constraints (see [Imports & Profiles](imports-profiles.md)) |
| **extension point** | A mechanism to substitute referenced blocks inside a base block's schema (see [Extension Points](extension-points.md)) |

---

## Skill map

Start here and follow links for the topic you need:

| File | What questions it answers |
|------|--------------------------|
| [quickstart.md](quickstart.md) | How do I create a new bblocks repo and author my first block? |
| [register-config.md](register-config.md) | Full `bblocks-config.yaml` reference: identifier prefix, imports, viewer depth, SPARQL push endpoint and GitHub Secrets auth. |
| [structure.md](structure.md) | What files go where? How are identifiers constructed? Also use as a file-to-doc index: each source file in the directory tree links to the skill doc that covers it. |
| [metadata.md](metadata.md) | What fields does `bblock.json` accept? Which are required? |
| [schema.md](schema.md) | How do I write or reference a JSON Schema for a block? How do I annotate it semantically? |
| [examples.md](examples.md) | How do I write examples? How do they feed into docs and validation? |
| [tests.md](tests.md) | How do I add test resources? What is `tests.yaml`? What are negative tests? |
| [semantic/index.md](semantic/index.md) | JSON-LD contexts, SHACL shapes, semantic uplift — overview and navigation |
| [transforms.md](transforms.md) | How do I declare transforms? What built-in types are available? |
| [transform-plugins.md](transform-plugins.md) | How do I add a custom transform type via a plugin? |
| [validation.md](validation.md) | How does validation work? How do I interpret errors? |
| [local-iteration.md](local-iteration.md) | How do I run the postprocessor locally for a fast edit→run loop? All CLI flags, step descriptions, and workflow examples for iterating on schema, uplift, transforms, or tests. |
| [dev-build.md](dev-build.md) | How do I test against an unreleased `bblocks-postprocess` feature — locally or in CI — before it ships in a release? |
| [contributing.md](contributing.md) | How do I submit a PR to an existing register from a fork? How do I avoid `build/`-directory merge conflicts? What does `create-clean-pr.sh` do? How do I override config on my fork without it leaking into the PR? |
| [validation-plugins.md](validation-plugins.md) | How do I add a custom validator? |
| [imports-profiles.md](imports-profiles.md) | How do I import another register? How do I find a block to reuse/profile? How do I profile a block? How do I work with an imported register that's offline or on a restricted network? |
| [extension-points.md](extension-points.md) | How do I specialize a block's referenced components? |
| [rdf-only.md](rdf-only.md) | How do I define a block with no JSON Schema — only RDF/ontology content? |
| [outputs.md](outputs.md) | What does the postprocessor produce, and where? |
| [view-plugins.md](view-plugins.md) | How do I add a custom viewer visualization to a register? How do I write a view plugin, and is a given implementation correct? |
| [security.md](security.md) | What should `SECURITY.md` say? What can transforms/plugins/imports execute, and when? What should I check before trusting an import or a plugin reference? |

---

## Schemas (authoritative)

All configuration file schemas live at:

```
https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/
```

| File | Schema |
|------|--------|
| `bblock.json` | [`bblock.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/bblock.schema.yaml) |
| `examples.yaml` | [`examples.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/examples.schema.yaml) |
| `tests.yaml` | [`tests.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/tests.schema.yaml) |
| `transforms.yaml` | [`transforms.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/transforms.schema.yaml) |
| `bblocks-config.yaml` | [`bblocks-config.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/bblocks-config.schema.yaml) |
| `semantic-uplift.yaml` | [`semantic-uplift.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/semantic-uplift.schema.yaml) |
| `transform-plugins.yml` (deprecated) | [`transform-plugins.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/transform-plugins.schema.yaml) |

---

## Example repository

[ogcincubator/bblocks-examples](https://github.com/ogcincubator/bblocks-examples) is the canonical
example register. Its `_sources/` tree is organized by pattern:

| Directory | What it demonstrates |
|-----------|---------------------|
| `feature/` | Schema-only blocks (GeoJSON feature, override context) |
| `semantic-uplift/` | Pre- and post-uplift steps |
| `transforms/` | Transform declarations and reuse |
| `rules/` | SHACL rules |
| `validators/` | Validator plugin integration |
| `observation/` | Blocks importing SOSA/OGC-API blocks |

Concrete snippets from this repo are copied into [examples/](examples/) alongside this skill.
See [examples/index.md](examples/index.md) for the full index with what each example demonstrates.