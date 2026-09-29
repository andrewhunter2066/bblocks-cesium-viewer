# bblocks-cesium-viewer

OGC Building Blocks register (`_sources/`) **and** a bblocks-viewer view plugin (`src/`) rendering
topo-feature documents on a CesiumJS globe. The agreed plan, decisions and stage list are in
[`PLAN.md`](PLAN.md) — read it before starting work, and tick off stages there as they land.

## Rules

- **Never commit secrets.** No Cesium ion tokens, passwords or account details in any tracked file,
  fixture, test or commit message. Tokens come from a gitignored `.env.local`
  (`VITE_CESIUM_ION_TOKEN`), the harness token box, or a CI secret. The default setup must work
  with no token.
- **Do not modify** `../bblocks-viewer-topo-feature-plugin`. Rule-engine files are copied from it
  (see `PLAN.md`) and keep their provenance headers.
- All development happens on `feature/cesium-viewer` (PR into `master`). Commit or push only when
  asked.
- Keep LF line endings (`.gitattributes`); the Windows checkout previously produced CRLF noise.

## Skills

The `bblocks-authoring` and `bblocks-consuming` skills live in `.agents/skills/`
(`view-plugins.md` and `local-iteration.md` are the most relevant here).

## Commands

`build.sh`/`view.sh` come from the template.

```bash
npm install
npm test          # unit tests (Node's built-in runner)
npm run dev       # harness with live reload
npm run build     # -> dist/ (deploy the whole directory)
npm run typecheck
./build.sh        # build the register locally into build-local/ (Docker)
npm run local-register  # point build-local/register.json at the local dist/ (after build.sh)
./view.sh         # serve the local register in bblocks-viewer at http://localhost:9090
```
