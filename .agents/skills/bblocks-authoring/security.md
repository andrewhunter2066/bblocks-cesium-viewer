# Security

Publishing a register is not just publishing data — postprocessing can **execute code**, either
your own or code pulled in from a register you import. Every register you import extends what
you're implicitly asking consumers to trust.

---

## `SECURITY.md`

Every register repository should carry a `SECURITY.md` alongside `README.md` and `LICENSE`. At
minimum, state:

- **Where to report a suspected issue** — a monitored email or a private channel (e.g. [GitHub
  private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)),
  not a public issue tracker.
- **What's in scope** — this repository's own sources (`transforms.yaml`, `plugins.transforms`/
  `plugins.validators` declarations, CI/CD workflows, `bblocks-config.yaml`). Most maintainers
  cannot vouch for imported registers — say so explicitly.
- **What a report should include** — the affected block identifier, the specific transform/plugin/
  import declaration, and whether the issue could propagate to registers that import this one.

[`bblock-template`](https://github.com/opengeospatial/bblock-template) doesn't ship a `SECURITY.md`
yet — write one by hand until the tooling generates and maintains it automatically.

---

## Code execution surface

A register with **no code of its own** can still execute code when built, from three sources:

- **`transforms.yaml`** — inline `python`, `node`, `jq`, `xslt`, SPARQL, or `semantic-uplift` logic,
  run automatically against matching example snippets during postprocessing. See
  [transforms.md](transforms.md).
- **Transform/validator plugins** — declared under `plugins.transforms` / `plugins.validators` in
  `bblocks-config.yaml`, installed via `pip`, which accepts any specifier `pip install` understands
  — including `git+https://...` URLs, i.e. code from anywhere the declaration points to. See
  [transform-plugins.md](transform-plugins.md) / [validation-plugins.md](validation-plugins.md).
- **Cross-block `get_transformer` / `getTransformer` calls** — can invoke a transform defined in a
  *different* block, including one reached only through an import.

A register that declares no transforms of its own is **not automatically free of executable
content** — it may have inherited some through an import (see [Imports and trust](#imports-and-trust)).

**How this runs depends on the environment:**

- **In CI**, the postprocessor runs unattended. Declared transforms and plugins execute
  automatically with whatever access the CI job has — secrets, network, write access. A slow or
  heavy transform also inflates CI cost.
- **Locally**, tooling asks for explicit confirmation before installing a plugin or running Python/
  Node transform code — this is what the `--skip-permissions` flag (see
  [local-iteration.md](local-iteration.md), [validation.md](validation.md)) bypasses. Reserve
  `--skip-permissions` for CI/agent runs you've already vetted; don't reach for it just to silence
  local prompts, since the prompt is the one point where a human actually looks at what's about to run.

Per-plugin virtualenv isolation prevents dependency conflicts — it is **not** a security boundary. A
plugin runs with whatever access the process running it has, regardless of which virtualenv it's in.

**Recommendations:**

- Review any new or changed `transforms.yaml` entry or plugin declaration like application code —
  because it is.
- Before adding/updating a `pip`/`git+https` plugin reference, check who maintains it and when it
  was last reviewed.
- Never commit CI credentials (e.g. `sparql.push` in `bblocks-config.yaml`, see
  [register-config.md](register-config.md)) to version control — use repository/organization
  secrets.
- Avoid broadening CI/CD workflow permissions beyond what postprocessing and publishing actually
  require.

---

## Imports and trust

`imports` in `bblocks-config.yaml` (see [imports-profiles.md](imports-profiles.md)) can reference
any register URL, OGC or not. Once imported, its `bblocks://` schema references, JSON-LD context,
and SHACL shapes are all inherited automatically — and any block in your repository can invoke a
transform defined in it.

- **Imports are transitive.** Importing one register also pulls in whatever *that* register
  imports, recursively — your real dependency set is a transitive closure, not the list you wrote.
- **Silence is still an import.** Omitting `imports` imports the main OGC register and everything
  it imports by default. Declare `imports: []` explicitly if you want none.
- **Imports aren't pinned.** Entries resolve by URL at build time — no version/commit/digest
  pinning, no lockfile. The same config rebuilt tomorrow may pull in different content.

Review a new import like a new dependency (maintainer, activity), and periodically re-check
existing imports, not just when adding them.

---

## Checking a register before trusting it

From a register's published `register.json` alone, without cloning it, you can check:

- which transform/validator plugins it declares, including the exact `pip` specifier each was
  installed from;
- the transform code each block declares, published alongside the blocks themselves;
- its import edges, and — resolving those recursively — its full transitive closure;
- the license applying to the register and to each block (`license` in `bblocks-config.yaml` or a
  block's own `bblock.json`, see [metadata.md](metadata.md)).

The [OGC Blocks meta-register catalog](https://defs-dev.opengis.net/bblocks-meta-register) indexes this across
known registers so you can look up declared plugins, imports, and license without cloning — via its
[REST API](https://defs-dev.opengis.net/bblocks-meta-register-backend/openapi.json) or, for MCP-capable tools, its
[MCP server](https://defs-dev.opengis.net/bblocks-meta-register-backend/mcp). Still a development project — the
URL above is a dev deployment and may change once a production register exists.

None of this proves the content was actually *reviewed*, by whom, or whether an import's target has
changed since you last checked — that tracking is on the consumer.