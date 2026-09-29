// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/resolve-config.js
// (unchanged apart from this header). Port later upstream fixes by hand.
// Resolves a per-block topo-viewer rendering config declared as a `bblock.json` `resources`
// entry, delivered to this plugin via `context.bblock` — the full bblock metadata the host's
// view-plugin contract already provides (see `ViewPluginContext` in
// @ogc/bblocks-viewer-plugin-types). `resources[].role` accepts any URI (the bblocks-authoring
// skill's metadata.md notes PROF explicitly allows applications to add roles beyond its own set),
// so no change to bblocks-viewer or bblocks-postprocess is required to carry this.
//
// One assumption this relies on, not yet verified against a real published register: that a
// `resources[].ref` written as a relative path in `bblock.json` is resolved to a fetchable
// absolute URL by the time it reaches `context.bblock` here. If that turns out not to hold, this
// module still degrades safely — a relative `ref` would simply fail to fetch, and the catch below
// falls back to the plugin's own built-in defaults.
import { mergeConfig, normalizeConfig, parseConfig } from './config.js';

export const VIEWER_CONFIG_RESOURCE_ROLE =
  'https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin/role/viewer-config';

// Finds this plugin's own config resource among a bblock's declared `resources`, if any. A
// missing/malformed `bblock` (no `resources` array, wrong shape) simply yields "no override" —
// never a throw.
export function findViewerConfigResource(bblock) {
  const resources = Array.isArray(bblock?.resources) ? bblock.resources : [];
  return resources.find(resource => resource?.role === VIEWER_CONFIG_RESOURCE_ROLE) ?? null;
}

// Resolves the effective rule config for one render: `defaultConfig` (the plugin's own built-in
// rule set — see default-config.js) with a per-block override merged over it, if the current
// bblock declares one. Never throws and never lets a bad network/parse outcome block rendering —
// every failure path (no `context.bblock`, no matching resource, a failed fetch, invalid JSON)
// falls back to `defaultConfig` alone, exactly matching pre-Stage-2 behaviour.
export async function loadViewerConfig(context, defaultConfig, fetchImpl = fetch) {
  const resource = findViewerConfigResource(context?.bblock);
  if (!resource?.ref) return normalizeConfig(defaultConfig);
  try {
    const response = await fetchImpl(resource.ref);
    if (!response.ok) return normalizeConfig(defaultConfig);
    const text = await response.text();
    return mergeConfig(defaultConfig, parseConfig(text));
  } catch {
    return normalizeConfig(defaultConfig);
  }
}
