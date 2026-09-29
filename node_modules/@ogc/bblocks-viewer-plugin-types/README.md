# bblocks-viewer-plugin-types

Canonical, dependency-free type-only reference for [bblocks-viewer](https://github.com/opengeospatial/bblocks-viewer)'s
plugin contracts:

- the **view-plugin contract** (`view-plugin.d.ts`) — the interface a plugin class must satisfy
  (`ViewPluginClass`, `ViewPluginInstance`), the shape of each candidate a plugin receives
  (`ViewPluginCandidate`), and the `context` object bblocks-viewer constructs and passes to a
  plugin's constructor (`ViewPluginContext`, including the optional `DependencyResolver` for
  sharing a heavy CDN-loaded dependency between plugins);
- the **tab-plugin contract** (`tab-plugin.d.ts`) — the interface a plugin class must satisfy to
  render its own top-level bblock-detail tab (`TabPluginClass`, `TabPluginInstance`), and the
  richer `context` object passed to it (`TabPluginContext`, carrying the full bblock and register
  objects plus a curated document-fetching facade). Deliberately a separate, parallel contract
  from the view-plugin one, not a generalization of it — see bblocks-viewer's
  `.claude/tab-plugins-design.md`, "Relationship to view plugins".

Both are re-exported from the package root (`index.d.ts`), so a single import statement reaches
either contract.

bblocks-viewer is the runtime authority for both contracts — it constructs `context`, matches
plugins, and calls `render()`/`destroy()`. This repo holds only the type declarations, kept in one
place so `bblocks-viewer-base-plugins`, `bblocks-viewer-topo-feature-plugin`,
`bblocks-view-plugin-starter`, and any third-party plugin repo can all check against the same copy
instead of drifting.

## Why a separate repo

The types were previously duplicated by hand across three plugin repos, and briefly lived inside
`bblocks-viewer` itself (exported under a `./view-plugin` package subpath). Depending on
`bblocks-viewer` as a devDependency — even just for its types — meant `npm install` cloning the
entire app (250+ transitive packages) in every plugin repo and their CI. This repo has zero
dependencies, so installing it costs almost nothing by comparison.

## Usage

```json
// package.json
{
  "devDependencies": {
    "@ogc/bblocks-viewer-plugin-types": "github:ogcincubator/bblocks-viewer-plugin-types"
  }
}
```

```ts
// TypeScript
import type { ViewPluginCandidate, ViewPluginContext, ViewPluginClass } from '@ogc/bblocks-viewer-plugin-types';
import type { TabPluginContext, TabPluginClass } from '@ogc/bblocks-viewer-plugin-types';
```

```js
// Plain JS, via JSDoc
/** @implements {import('@ogc/bblocks-viewer-plugin-types').ViewPluginClass} */
export default class MyViewPlugin { /* ... */ }

/** @implements {import('@ogc/bblocks-viewer-plugin-types').TabPluginClass} */
export default class MyTabPlugin { /* ... */ }
```

This is a **types-only** devDependency — never a runtime dependency. A plugin has no runtime
dependency on bblocks-viewer or on this package; `import type`/JSDoc `@implements` comments are
erased by the TypeScript/Vite build and never end up in a built `dist/index.js`.
