---
name: bblocks-consuming
description: "Reference skill for consuming published OGC Blocks (bblocks) registers: register.json, annotated schemas, JSON-LD contexts, SHACL shapes, examples, and test reports. Covers validating data, resolving bblocks:// refs, semantic uplift, and the bblocks-client-python library. Use when an agent needs to integrate with, validate against, or query an existing OGC Blocks register."
---

# OGC Blocks — Consuming Skill

This skill covers how to **consume OGC Blocks** (bblocks) from a published register: how to find a
block, fetch its outputs, validate data against it, and resolve its semantics — all from an external
project that depends on the register, not from inside the register's own repo.

If you are instead writing or maintaining the source files of a register, that's a different skill
(`bblocks-authoring`) — it may not be installed alongside this one, so this skill is fully
self-contained and doesn't assume it's available.

Official branding is **OGC Blocks**. The legacy name is *OGC Building Blocks*. `bblocks` is the
code-level identifier used in file names, identifiers, and tooling.

---

## What you get from a published register

A register is a static set of files (typically deployed to GitHub Pages) rooted at a `register.json`.
From it you can reach, per block: an annotated JSON Schema, a JSON-LD context, SHACL shapes, examples,
generated documentation, and test reports. Nothing requires a server — every output is a plain file
fetchable over HTTP.

---

## Key concepts

| Term | Meaning |
|------|---------|
| **register** | A published collection of blocks from one repo, indexed in `register.json` |
| **identifier** | Globally unique dot-separated string, e.g. `ogc.geo.features.feature` |
| **summary vs. full** | `register.json` holds a lightweight summary per block, enough for lookup/routing; the **full block** (`documentation['json-full'].url`) is the canonical, complete view — examples, inline annotated schema, semantic uplift steps — and is a separate fetch per block |
| **annotated schema** | The schema you should actually reference — source schema with `bblocks://` refs resolved to real URLs and `x-jsonld-*` annotations inlined |
| **assembled context** | The merged JSON-LD context (block's own + all imported blocks'), used for semantic uplift |
| **`bblocks://` URI** | Identifier-shaped `$ref`/link to another block, resolved against the register to a real HTTPS URL |

---

## Skill map

| File | What questions it answers |
|------|--------------------------|
| [register.md](register.md) | What does `register.json` contain? How do I look up a block by identifier? How do imports/dependencies chain across registers? How do I find a block that isn't in any register I already know about? |
| [schema-integration.md](schema-integration.md) | Which schema file should I reference? How do `bblocks://` refs resolve? How do I `$ref` a block's schema from my own? |
| [validation.md](validation.md) | How do I validate a JSON payload against a block's schema, including cross-block `$ref`s? |
| [semantic-uplift.md](semantic-uplift.md) | How do I turn JSON into JSON-LD/RDF using a block's context, and then SHACL-validate it? |
| [examples-and-docs.md](examples-and-docs.md) | How do I use a block's bundled examples or generated docs as grounding for an agent, without parsing raw schema? |
| [python-client.md](python-client.md) | What does the `bblocks-client-python` library do today, and what does it not (yet) cover? |
| [no-library.md](no-library.md) | How do I do all of the above with plain HTTP calls, in Python, JS, or any other language? |
| [viewer.md](viewer.md) | How do I visually inspect a register before integrating with it? |
| [transforms.md](transforms.md) | How do I run a block's declared transforms myself (built-in types and custom plugin types), since `bblocks-client-python` doesn't? |

---

## Example register

[ogcincubator/bblocks-examples](https://github.com/ogcincubator/bblocks-examples) publishes its
register at `https://ogcincubator.github.io/bblocks-examples/build/register.json` — used as the
worked example throughout this skill and in the [snippets/](snippets/) directory.
