# Contributing to an existing register (fork → PR)

Covers the fork-based contribution workflow: why `build/` causes merge conflicts, how
`create-clean-pr.sh` avoids them, and how to override fork-specific config without leaking it
upstream.

---

## The problem: `build/` merge conflicts

The postprocessing workflow commits its output (`build/`) to your fork on every push (see
[outputs.md](outputs.md)). If you open a Pull Request straight from your fork's `master`/`main`
branch, those generated artifacts get dragged into the review and collide with the same directory
on the upstream register — creating merge conflicts that have nothing to do with your actual
change.

## `create-clean-pr.sh`

Every register scaffolded from [bblocks-template](https://github.com/opengeospatial/bblocks-template) already
has `create-clean-pr.sh` at its root, alongside `build.sh`/`view.sh` — postprocessing keeps it up to date (and
adds it back if missing) automatically, so it usually doesn't need to be fetched manually. If a register predates
it or it's missing for some other reason, grab the current version directly:
[create-clean-pr.sh](https://github.com/opengeospatial/bblocks-template/raw/refs/heads/master/create-clean-pr.sh).
It produces a PR-ready branch with all `build/` history stripped out, so the Pull Request only shows the real
source changes.

Typical setup and use:

1. Fork the upstream register on GitHub, then enable Actions on the fork (GitHub disables them on
   forks by default — "Actions" tab → enable workflows) so postprocessing runs on your pushes.
2. The fork is a separate repository, so it needs its own **Pages** configuration too: **Settings →
   Pages → Source → GitHub Actions** (same setting as initial repo creation, see
   [quickstart.md](quickstart.md#enable-github-pages)). Without this the fork's preview build
   succeeds but isn't published anywhere.
3. The postprocessing workflow only runs automatically on a push. If you need output *before* your
   first push (or to confirm the setup works right after enabling Actions), trigger it manually:
   **Actions tab → "validate and postprocess" workflow → Run workflow** (`workflow_dispatch`), or
   `gh workflow run "validate and postprocess"` if the `gh` CLI is available.
4. Clone the fork and add the upstream repository as a remote, conventionally named `fork-parent`
   — this is the default remote name the script looks for (configurable to something else, e.g.
   `upstream`).
5. Work on the fork's `master`/`main` branch as usual: edit sources, commit, push. Each push
   triggers postprocessing and previews the register on the fork's own GitHub Pages site.
6. Before running the script, commit or stash any pending changes — it rewrites history and
   requires a clean working tree.
7. Run the script locally in the register's directory. It will:
   - create a new branch with a random name,
   - strip all changes to `build/` from that branch's history,
   - push the branch to your fork,
   - print a ready-to-use compare URL for opening the Pull Request.
8. Open the PR from the printed URL — **not** from `master`/`main`.

It depends on [`git-filter-repo`](https://github.com/newren/git-filter-repo) (a Python script): if
already installed it's used directly, otherwise the script downloads a temporary copy and deletes
it afterward. A working Python environment is required either way.

It's a bash script — see [Prerequisites](SKILL.md#prerequisites) for the Windows/Git-Bash/WSL note.

### Automating steps with `gh`

If the `gh` CLI is available, an agent can drive most of this workflow without a browser instead of
telling the user to click through the GitHub UI:

```bash
# Fork the upstream register and clone it, in one step
gh repo fork <upstream-owner>/<upstream-repo> --clone

# Enable Actions on the fork (the UI equivalent of the "Actions" tab's
# "I understand my workflows, enable them" button, which forks require)
gh api -X PUT repos/<your-user>/<upstream-repo>/actions/permissions -f enabled=true

# After create-clean-pr.sh prints its compare URL, open the PR directly instead of visiting it:
gh pr create --repo <upstream-owner>/<upstream-repo> \
  --head <your-user>:<printed-branch-name> \
  --title "..." --body "..."
```

Confirm with the user before forking a repository or opening a PR on their behalf — these are
visible, hard-to-fully-reverse actions on a shared/public repository.

### Updating an existing PR

Each run creates a brand-new temporary branch and a new compare URL — it does **not** update a
previously created branch or PR. If you keep committing to `master`/`main` after opening a PR,
re-run the script and either retarget the existing PR at the new branch, or close it and open a new
one from the newly printed URL. The old temporary branch can then be deleted.

---

## Fork-specific config overrides

While working on a fork you may want different `bblocks-config.yaml` settings than the ones you
intend to submit upstream — e.g. a different `identifier-prefix` or `imports` list for local
testing — without those changes leaking into the PR.

Create `bblocks-config-override.yml` (or `.yaml`) at the repository root. Any top-level key present
overrides the corresponding value from `bblocks-config.yaml`:

```yaml
# bblocks-config-override.yml
identifier-prefix: my-fork.
imports:
  - https://www.example.com/overriden-import-1
  - https://www.example.com/overriden-import-2
```

`create-clean-pr.sh` automatically excludes this file from the clean PR branch, so fork-specific
overrides never appear in the Pull Request.

**Pitfall — SPARQL push on forks.** If upstream's `bblocks-config.yaml` sets `sparql.push`, a fork inherits that
same endpoint, and postprocessing will try (and fail) to push to it since the fork isn't authorized. Disable it
per-fork with `sparql: false` (or `null`) in `bblocks-config-override.yml` — this silences both the postprocessor's
own push step and the separate "upload to triplestore" workflow job, without touching upstream's config. See
`register-config.md`.
