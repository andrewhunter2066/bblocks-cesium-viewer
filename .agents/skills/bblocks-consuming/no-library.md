# Consuming a register without a client library

Every operation in this skill reduces to plain HTTP GETs plus standard JSON Schema / JSON-LD / SHACL
tooling available in any language. This file gives the language-agnostic contract first, then worked
examples in Python and JavaScript, so you can adapt the pattern to whatever language an agent is
generating code in.

## The contract

1. **Fetch the register.** `GET <register-url>/register.json`. Parse `imports` (array of further
   register URLs) and `bblocks` (array of summaries). Recurse into `imports`, deduping by URL, to
   build the full lookup space. See [register.md](register.md).
2. **Find a block.** Search `bblocks[]` (across the register and its imports) for the matching
   `itemIdentifier`. You now have its `schema`, `ldContext`, `shaclShapes`, and `documentation` URLs.
3. **To validate JSON:** `GET` the `schema['application/json']` URL. Run it through a JSON Schema
   validator capable of resolving remote `$ref`s — either by giving it a live HTTP-fetching retrieval
   hook, or by pre-walking the schema, fetching every `$ref` URL yourself, and registering each as a
   known schema before validating. See [validation.md](validation.md).
4. **To get RDF:** `GET` the `ldContext` URL, merge it into your JSON document as `@context`, and parse
   the result with any JSON-LD-capable RDF library. See [semantic-uplift.md](semantic-uplift.md).
5. **To SHACL-validate:** `GET` each URL in `shaclShapes`, parse and merge them into one shapes graph,
   then run any SHACL engine against your data graph + that shapes graph.
6. **To read human/agent-friendly docs:** `GET` `documentation['json-full'].url` for everything about
   the block in one document (description, examples, resolved schema, dependencies), or
   `documentation['markdown'].url` for a prose rendering. See [examples-and-docs.md](examples-and-docs.md).

None of these require write access or authentication — registers are static files. CORS is generally
open (GitHub Pages default); if a fetch fails from a browser context, it's worth checking that first.

## Cache what you fetch

`register.json`, `json-full` documents, schemas, contexts, and shapes are static published build
artifacts — they only change when the register is rebuilt (its top-level `modified` timestamp moves;
see [register.md](register.md)). Fetch each URL at most once per task and reuse the result: don't
refetch the same register while walking multiple blocks, and don't refetch a block's schema for
every payload you validate against it. The `load_all_blocks` helpers below already dedupe by URL
within one walk via `seen` — extend that to a simple `url → parsed content` dict for the whole task,
not just the import walk. For anything longer-lived than a single task, persist that cache and use
the register's `modified` field (or plain HTTP conditional requests, since these are static files) to
decide when to refresh an entry instead of refetching unconditionally.

## Python (no `bblocks_client`)

```python
import json
from urllib.request import urlopen

def get_json(url):
    with urlopen(url) as resp:
        return json.load(resp)

def load_all_blocks(register_url, _seen=None):
    seen = _seen if _seen is not None else set()
    if register_url in seen:
        return []
    seen.add(register_url)
    reg = get_json(register_url)
    blocks = reg.get("bblocks", reg) if isinstance(reg, dict) else reg  # legacy bare-array form
    for imp_url in reg.get("imports", []) if isinstance(reg, dict) else []:
        blocks += load_all_blocks(imp_url, seen)
    return blocks

blocks = load_all_blocks("https://ogcincubator.github.io/bblocks-examples/build/register.json")
block = next(b for b in blocks if b["itemIdentifier"] == "ogc.bbr.examples.observation.vectorObservation")
schema = get_json(block["schema"]["application/json"])
```

For validation with remote `$ref` resolution, see the `jsonschema` + `referencing.Registry(retrieve=...)`
pattern in [validation.md](validation.md) — it's the same idea: a retrieval callback that calls
`get_json` on any URI it doesn't already have.

## JavaScript

```js
async function getJson(url) {
  const resp = await fetch(url);
  return resp.json();
}

async function loadAllBlocks(registerUrl, seen = new Set()) {
  if (seen.has(registerUrl)) return [];
  seen.add(registerUrl);
  const reg = await getJson(registerUrl);
  let blocks = Array.isArray(reg) ? reg : reg.bblocks; // legacy bare-array form
  for (const importUrl of reg.imports ?? []) {
    blocks = blocks.concat(await loadAllBlocks(importUrl, seen));
  }
  return blocks;
}

const blocks = await loadAllBlocks("https://ogcincubator.github.io/bblocks-examples/build/register.json");
const block = blocks.find(b => b.itemIdentifier === "ogc.bbr.examples.observation.vectorObservation");
const schema = await getJson(block.schema["application/json"]);
```

For JSON Schema validation with remote `$ref`s in JS, libraries like AJV support an async ref-loading
option (`loadSchema`) that you can point at `getJson`. For JSON-LD parsing, `jsonld.js` accepts a
custom `documentLoader` for the same purpose — fetch-on-demand for any URL the library doesn't already
have. `bblocks-viewer` (a Vue app) is a real reference implementation of this exact pattern in JS; see
[viewer.md](viewer.md).

## Other languages

The shape is identical regardless of language: an HTTP client, a JSON parser, a JSON Schema validator
with pluggable remote-ref resolution, and (only if you need RDF) a JSON-LD parser and a SHACL engine.
Almost every mainstream language has a library for each of those four pieces; the bblocks-specific
part is only steps 1–2 above (walking `imports`, looking up by `itemIdentifier`), which is a few lines
of plain JSON traversal.
