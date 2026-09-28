# Testing against the development build

Covers how to run the postprocessor against `bblocks-postprocess`'s `develop` branch/Docker image
instead of the released one — for validating a register against an upcoming feature, or helping
test one before it ships in a `v1.*.*` release.

`develop` is the absolute bleeding edge: unlike the release-tagged image (the untagged/`latest`/`v1`
image used by default), `@develop`/`:develop` is a moving pointer, not a fixed version — it can pick
up new, experimental, potentially breaking behavior on every run, with no compatibility guarantee
and no notice. Use it to test something specific, then switch back — never leave a real/production
register pinned to it, and don't suggest it unless the user is deliberately testing something on
`bblocks-postprocess`'s own `develop` branch (e.g. they're contributing to that repo, or a
maintainer asked them to verify an unreleased fix).

---

## Locally

Every register scaffolded from bblocks-template already has `build-devel.sh` at its root, alongside
`build.sh`/`view.sh`/`create-clean-pr.sh` (postprocessing keeps all four in sync automatically, same
as `create-clean-pr.sh` — see [contributing.md](contributing.md)). It's
`BBP_IMAGE_TAG=develop exec build.sh "$@"` — `build.sh` with the image tag overridden, forwarding any
extra arguments straight through to the postprocessor. Run it plain for a full clean build against
the `develop` image:

```bash
./build-devel.sh
```

Or pass any of the [local-iteration.md](local-iteration.md) flags (`--filter`, `--steps`, and so on)
for finer-grained iteration against `develop`:

```bash
./build-devel.sh --filter ogc.my.namespace.myblock --steps annotate,jsonld,tests
```

If a register's `build.sh` predates the flag-passthrough fix (no `"$@"` at the end of its
`docker run` line — postprocessing auto-updates an unmodified stock copy to the current template on
its next run, but only then) or you need to run outside a register directory, use the equivalent
`docker run` directly with the `develop` tag instead:

```bash
docker run -it --pull=always --rm --workdir /workspace \
  -v "$(pwd):/workspace" \
  ghcr.io/opengeospatial/bblocks-postprocess:develop \
  [flags]
```

`--pull=always` matters more here than usual: without it, Docker won't notice a newer `develop`
image has been pushed since your last pull, and you'll silently keep testing a stale build.

## In CI

Point the register's `.github/workflows/process-bblocks.yml` caller at `@develop` instead of the
`@master` pin shown in [register-config.md](register-config.md#authentication-github-secrets):

```yaml
jobs:
  validate-and-process:
    uses: opengeospatial/bblocks-postprocess/.github/workflows/validate-and-process.yml@develop
    secrets:
      sparql_username: ${{ secrets.sparql_username }}
      sparql_password: ${{ secrets.sparql_password }}
```

No other change is needed — on `develop`, `validate-and-process.yml` resolves against develop's own
postprocessing action and Docker image automatically. The same applies to a register's PR-check
caller workflow (`.github/workflows/pr-check.yml`, scaffolded from bblocks-template — not every
register has one): pin it at `@develop` the same way to test upcoming PR-validation behavior too.
