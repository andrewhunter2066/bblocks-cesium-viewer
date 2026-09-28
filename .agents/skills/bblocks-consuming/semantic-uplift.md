# Semantic uplift: JSON → JSON-LD → RDF

## Why you'd do this

A block's JSON Schema describes syntax; its JSON-LD context describes meaning (which property maps to
which RDF predicate/class). "Uplift" is the process of combining a JSON document with a block's
context to get JSON-LD, then parsing that into an RDF graph — which you can then SHACL-validate,
SPARQL-query, or merge with other linked data.

## Finding a block by an RDF term you already have

If you're starting from the other direction — you have data (or a target ontology) that already uses a
specific RDF predicate/class URI, and want to know whether some bblock documents a JSON representation for
it — the [OGC Blocks meta-register](https://defs-dev.opengis.net/bblocks-meta-register)'s MCP server exposes
a semantic-binding lookup tool for exactly this: it searches by the URI a block's JSON-LD context or SHACL
shape actually maps to, rather than by keyword. (Still a development project — the URL may change once a
production deployment exists.)

## Which context to use

Each block has **two** context documents:

- **source context** (`sourceLdContext` / the block's own `context.jsonld` in its source tree) — only
  the mappings this block itself defines.
- **assembled context** (`ldContext` in the summary) — the source context merged with every imported
  block's context, transitively. **Use this one.** A JSON document conforming to the block's full
  schema will have properties from imported blocks too, which only the assembled context can map.

## The uplift steps

1. Fetch the assembled context (`ldContext` URL).
2. Wrap your JSON data with it: `{"@context": <fetched context>, **your_data}` (if your data already
   has a top-level `@context`, you need to merge rather than overwrite — check whether one is already
   present).
3. Parse the result as JSON-LD into an RDF graph (e.g. `rdflib.Graph().parse(data=..., format="json-ld")`).
4. Some blocks declare additional **pre-uplift** or **post-uplift** steps, published as
   `semanticUplift.additionalSteps` on the full block (`documentation['json-full'].url`):

   ```json
   "semanticUplift": {
     "additionalSteps": [
       { "type": "jq", "stage": "pre", "code": ".three = 3" },
       { "type": "sparql-update", "stage": "post", "ref": "https://.../update.sparql" }
     ]
   }
   ```

   | Field | Meaning |
   |---|---|
   | `type` | `shacl`, `sparql-update`, `sparql-construct`, or `jq`. |
   | `stage` | `pre` (runs before step 3, on the plain JSON/JSON-LD) or `post` (runs after, on the RDF graph). |
   | `code` / `ref` | Exactly one is present: inline step code, or a URL to fetch it from. |

   Skip this unless the block you're consuming actually declares such steps — most don't.

## Then validate

Once you have an RDF graph, run SHACL validation against it using the block's `shaclShapes` — see
[validation.md](validation.md#shacl-validation). A payload can pass JSON Schema validation but fail
SHACL validation (or vice versa, for SHACL constraints that JSON Schema can't express) — they check
different things and both are meaningful.

## Worked example

See [snippets/uplift_json.py](snippets/uplift_json.py) for a runnable version of steps 1–3 using
`bblocks-client-python`, and [no-library.md](no-library.md) for the equivalent without it.

## Displaying uplifted data

If the goal is showing uplifted JSON-LD to a human rather than just validating it,
[`@opengeospatial/jsonld-ui-utils`](https://github.com/ogcincubator/jsonld-ui-utils)
([npm](https://www.npmjs.com/package/@opengeospatial/jsonld-ui-utils)) is a JS/TS library that
renders a JSON-LD feature and its context as a nested HTML properties table, resolving property
names and values against RDF labels/descriptions fetched from the vocabularies they point to. It
also has a Leaflet plugin that renders a GeoJSON `FeatureCollection` as a map layer with these
semantically-enriched tables as popups, instead of raw property dumps — see
[viewer.md](viewer.md) for where this shows up in `bblocks-viewer`.
