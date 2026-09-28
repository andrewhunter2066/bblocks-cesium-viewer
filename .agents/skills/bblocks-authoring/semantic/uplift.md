# Semantic Uplift

Semantic uplift is the process of converting a JSON document to RDF. The basic approach — embedding
the block's JSON-LD context and parsing the result — is automatic and requires no configuration.

When that basic approach is not enough (e.g., the JSON structure doesn't map cleanly to the target
RDF model), you can define **additional uplift steps** in `semantic-uplift.yaml`.

Schema:
[`semantic-uplift.schema.yaml`](https://raw.githubusercontent.com/opengeospatial/bblocks-postprocess/master/ogc/bblocks/schemas/semantic-uplift.schema.yaml)

---

## When is `semantic-uplift.yaml` needed?

- The JSON has a structure that requires reshaping before a JSON-LD context can be applied.
- The RDF model expected by SHACL shapes requires triples that cannot be expressed through
  JSON-LD context alone (e.g., inverting a relationship, computing derived values).
- You are working with a legacy JSON format that cannot be changed.

If your JSON maps cleanly to RDF via a context, you do not need `semantic-uplift.yaml`.

---

## `semantic-uplift.yaml` format

```yaml
additionalSteps:
  - type: jq
    code: |
      .features |= map(.properties.observedAt = .timestamp)
  - type: sparql-construct
    ref: uplift/add-types.sparql
```

Steps run in order. Pre-processing steps run on the JSON document; post-processing steps run on
the RDF graph produced by JSON-LD uplift.

---

## Step types

### Pre-processing (on JSON, before context embedding)

| Type | Description |
|------|-------------|
| `jq` | A [jq](https://jqlang.org) expression applied to the JSON document. The result must still be valid JSON. |

Use pre-processing to reshape the JSON so that the JSON-LD context can apply cleanly.

### Post-processing (on RDF graph, after JSON-LD uplift)

| Type | Description |
|------|-------------|
| `shacl` | A [SHACL-AF](https://www.w3.org/TR/shacl-af/#rules) ruleset. Entailed triples are added to the graph. |
| `sparql-construct` | A [SPARQL CONSTRUCT](https://www.w3.org/TR/sparql11-query/#construct) query. Its result **replaces** the graph. |
| `sparql-update` | A [SPARQL UPDATE](https://www.w3.org/TR/2013/REC-sparql11-update-20130321/) statement. Modifies the graph in-place; the full result is returned. |

Use post-processing to add, remove, or restructure triples after JSON-LD parsing.

---

## Code vs. `ref`

Steps can declare code inline or reference a separate file:

```yaml
additionalSteps:
  - type: jq
    code: |
      .value = (.value * 1000)          # inline

  - type: sparql-construct
    ref: uplift/my-query.sparql         # file reference (relative to bblock.json)
```

---

## Semantic uplift as a transform type

Uplift steps can also be used as a **transform** in `transforms.yaml`:

```yaml
transforms:
  - id: my-uplift
    type: semantic-uplift
    ref: uplift/config.yaml
    inputs:
      mediaTypes: [application/json]
    outputs:
      mediaTypes: [text/turtle]
```

This allows clients to discover and apply the uplift steps as a reusable conversion artifact,
separate from the automated test/example processing.

---

**Example:** [examples/with-context/semantic-uplift.yaml](../examples/with-context/semantic-uplift.yaml) — jq pre-step adds computed fields, SPARQL UPDATE post-step derives further triples.

---

## Runtime reuse

If a JSON instance will be processed at runtime (not just during postprocessing), the uplift steps
must also be applied at runtime. The `semantic-uplift.yaml` file is published in `build/` for
exactly this purpose — clients can fetch it and apply the same steps.

Whether to apply these steps at runtime is an implementation concern; the postprocessor makes the
steps discoverable but does not enforce their runtime use.
