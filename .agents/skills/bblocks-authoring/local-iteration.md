# Local iteration with the postprocessor

This file covers how to run the postprocessor efficiently in a tight edit→run→inspect loop,
whether you are iterating on a schema, a JSON-LD context, semantic uplift, transforms, or tests.

Working on a fork to submit changes upstream? See [contributing.md](contributing.md) for the
fork → PR workflow and how to avoid `build/`-directory merge conflicts. Need to test against an
unreleased `bblocks-postprocess` feature rather than the released image? See [dev-build.md](dev-build.md).

**If you are an LLM/agent, do not run `build.sh` or `view.sh` directly.** Both scripts' `docker run`
call includes `-it` (interactive, pseudo-TTY), which hangs or fails outside a real terminal. Either
ask the user to run the script themselves, or run the equivalent `docker run` command yourself
without `-it`, adding `--skip-permissions true` (see the flags table below) so it doesn't block on
an interactive prompt. That prompt is what would otherwise ask a human to confirm each plugin
install and each transform-code execution against examples — read [security.md](security.md)
before passing `--skip-permissions` on a register you haven't already reviewed.

---

## Postprocessor CLI reference

Full invocation:

```bash
docker run -it --pull=always --rm --workdir /workspace \
  -v "$(pwd):/workspace" \
  ghcr.io/opengeospatial/bblocks-postprocess \
  [flags]
```

### All flags

| Flag | Default | Description |
|------|---------|-------------|
| `--items-dir` | `_sources` | Directory containing block sources |
| `--register-file` | `build-local/register.json` | Path for the output register JSON |
| `--annotated-path` | `build-local/annotated` | Directory for annotated schema outputs |
| `--generated-docs-path` | `build-local/generateddocs` | Directory for generated documentation |
| `--test-outputs-path` | `build-local/tests` | Directory for test/validation outputs |
| `--base-url` | auto-detected | Base URL for hyperlink generation; auto-detected from the git remote when inside a GitHub repo. Set to `http://localhost:9090/register/` for local preview with the viewer. |
| `--github-base-url` | auto-detected | Base URL for GitHub source links; auto-detected from the git remote |
| `--config-file` | `bblocks-config.yaml` | Path to the bblocks config file |
| `--ref-root` | OGC master build URL | Value substituted for `$_ROOT_` in `$ref` values inside JSON schemas |
| `--clean` | `false` | Delete output directories before running. **Silently ignored when `--filter` or `--steps` is used** (see below) |
| `--filter` | (none) | Process only one block — by identifier (e.g. `ogc.geo.features.feature`) or by path to its `bblock.json`. Forces `--clean` to `false` |
| `--steps` | (all steps) | Comma-separated subset of steps to run. Forces `--clean` to `false` |
| `--fail-on-error` | `true` | Exit non-zero if any error is encountered. Set to `false` to continue past errors |
| `--skip-permissions` | `false` | Skip interactive permission prompts for transforms and plugins. Set to `true` for non-interactive (agent or CI) runs |
| `--log-level` | `INFO` | Logging verbosity: `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `--log-file` | (none) | Write log output to a file in addition to stdout |
| `--deploy-viewer` | `false` | Deploy the JavaScript viewer alongside the register |
| `--viewer-path` | `.` | Directory where the viewer is deployed |
| `--enable-sparql` | `false` | Push the register to a SPARQL endpoint (requires `sparql` config in `bblocks-config.yaml` — see [register-config.md](register-config.md)) |

---

## Pipeline steps

`--steps` accepts a comma-separated list of these step names:

| Step | What it does |
|------|-------------|
| `annotate` | Resolves `$ref` chains and inlines `x-jsonld-*` annotations into the annotated schema |
| `jsonld` | Assembles the JSON-LD context from the block's own context and all imported blocks' contexts |
| `tests` | Validates examples and test resources against the schema, uplifts them to JSON-LD/Turtle, and runs SHACL |
| `transforms` | Executes declared transforms and writes their outputs |
| `doc` | Generates HTML documentation for each block |
| `register` | Writes `register.json` and performs the register-level semantic uplift to JSON-LD and Turtle |

Steps run in the order listed above regardless of the order supplied in `--steps`.

---

## Iterative workflows

### Key rule: `--clean` is ignored with `--filter` or `--steps`

The postprocessor automatically disables `--clean` when `--filter` or `--steps` is set,
so outputs from other blocks or prior runs are preserved. You can pass `--clean true`
alongside these flags without error — it will simply have no effect.

### Iterate on a single block (all steps)

```bash
docker run -it --pull=always --rm --workdir /workspace \
  -v "$(pwd):/workspace" \
  ghcr.io/opengeospatial/bblocks-postprocess \
  --filter ogc.my.namespace.myblock \
  --skip-permissions true \
  --base-url http://localhost:9090/register/
```

Or by path:

```bash
  --filter _sources/my/namespace/myblock/bblock.json
```

### Iterate on semantic uplift only

Edit the JSON-LD context or uplift config, then run only the steps needed to see the effect:

```bash
docker run -it --pull=always --rm --workdir /workspace \
  -v "$(pwd):/workspace" \
  ghcr.io/opengeospatial/bblocks-postprocess \
  --filter ogc.my.namespace.myblock \
  --steps annotate,jsonld,tests \
  --skip-permissions true \
  --base-url http://localhost:9090/register/
```

Inspect `build-local/tests/<block-id>/` for the uplifted `.jsonld` and `.ttl` files.

### Iterate on transforms only

```bash
docker run -it --pull=always --rm --workdir /workspace \
  -v "$(pwd):/workspace" \
  ghcr.io/opengeospatial/bblocks-postprocess \
  --filter ogc.my.namespace.myblock \
  --steps transforms \
  --skip-permissions true \
  --base-url http://localhost:9090/register/
```

### Iterate on schema / validation only

```bash
docker run -it --pull=always --rm --workdir /workspace \
  -v "$(pwd):/workspace" \
  ghcr.io/opengeospatial/bblocks-postprocess \
  --filter ogc.my.namespace.myblock \
  --steps annotate,tests \
  --skip-permissions true \
  --fail-on-error false \
  --base-url http://localhost:9090/register/
```

### Full clean run (e.g. before committing)

```bash
docker run -it --pull=always --rm --workdir /workspace \
  -v "$(pwd):/workspace" \
  ghcr.io/opengeospatial/bblocks-postprocess \
  --clean true \
  --skip-permissions true \
  --fail-on-error true \
  --base-url http://localhost:9090/register/
```

---

## Capturing output

Use `--log-level DEBUG` for verbose output showing each annotation step, uplift, and SHACL evaluation.
Use `--log-file` to write the log to a file:

```bash
  --log-level DEBUG \
  --log-file /workspace/build-local/postprocess.log
```

---

## Running without Docker

If `bblocks-postprocess` is installed in the current Python environment:

```bash
python -m ogc.bblocks.bootstrap \
  --filter ogc.my.namespace.myblock \
  --steps annotate,jsonld,tests \
  --skip-permissions true \
  --log-level DEBUG
```