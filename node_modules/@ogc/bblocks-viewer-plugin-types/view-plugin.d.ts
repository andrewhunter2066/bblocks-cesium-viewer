// Canonical type-only reference for bblocks-viewer's view-plugin contract — the interface a
// register-declared or first-party plugin class must satisfy, and the shape of the `context`
// object bblocks-viewer always constructs and passes to it. bblocks-viewer itself is the runtime
// authority (see its src/composables/view-plugins.js for matching/context-construction and
// src/utils/dependency-resolver.js for the DependencyResolver implementation); this repo exists
// only so that authority's type contract can be depended on without pulling in the entire app.
//
// Consumers add this package as a devDependency (types only, never a runtime dependency — a
// plugin has no runtime dependency on bblocks-viewer or on this package) via
// `"@ogc/bblocks-viewer-plugin-types": "github:ogcincubator/bblocks-viewer-plugin-types"`, then
// `import type { ... } from '@ogc/bblocks-viewer-plugin-types'` (TypeScript) or
// `@implements {import('@ogc/bblocks-viewer-plugin-types').ViewPluginClass}` (JSDoc, for plain JS
// plugins). Do not keep a local duplicate of this file — bblocks-viewer-base-plugins,
// bblocks-viewer-topo-feature-plugin, and bblocks-view-plugin-starter all depend on this single
// copy so the contract can change in one place.

/** One representation of the content a plugin may render — a single example snippet, or the
 * single executed output of a transform. A plugin's `candidates` array holds one of these per
 * available representation (e.g. one per example snippet language); a plugin picks whichever one
 * it actually wants. */
export interface ViewPluginCandidate {
  /** MIME type, e.g. 'application/geo+json'. Never a bare language slug — the host always
   * resolves it to a real MIME type where one is known, and passes the raw declared value through
   * verbatim otherwise. May be null if the host has no type information at all. */
  type: string | null;
  /** Resolved text content, if the host already fetched/inlined it. Null if not yet resolved —
   * a plugin should treat a null-content candidate as unusable, not attempt its own fetch. */
  content: string | null;
  /** Absolute URL the content was (or would be) fetched from, if any. */
  url: string | null;
  /** Human-readable label for this candidate (e.g. the snippet's language label, or the
   * transform's id) — not meant for matching logic, only for a plugin's own UI if it needs one. */
  label: string;
}

/** Host information beyond the candidates themselves, passed as the constructor's second
 * argument. Always supplied by bblocks-viewer, whether a plugin is statically bundled in or
 * loaded from a register-declared url — a plugin that doesn't need it simply doesn't declare the
 * parameter. */
export interface ViewPluginContext {
  /** The full bblock (json-full shape) this candidate set belongs to. Null if unavailable. */
  bblock: Record<string, unknown> | null;
  /** The viewer's resolved runtime config (fallback Rainbow/SPARQL endpoints, etc). Null if
   * unavailable. */
  viewerConfig: Record<string, unknown> | null;
  /** Optional infra for sharing a runtime instance of a heavy CDN-loaded dependency (e.g.
   * bblocks-viewer-base-plugins' ThreeDPlugin and bblocks-viewer-topo-feature-plugin's
   * TopoFeaturePlugin both sharing one `three` instance) instead of each fetching an independent
   * copy. Always supplied by the host; using it is what's optional on the plugin's side. See
   * bblocks-viewer's .claude/shared-dependency-resolver-design.md for the full mechanism. */
  depResolver?: DependencyResolver;
}

/** A single shared-dependency cache, keyed by `name`. See `ViewPluginContext.depResolver`. Backed
 * at runtime by bblocks-viewer's src/utils/dependency-resolver.js `DependencyResolver` class. */
export interface DependencyResolver {
  /** Returns a cached, version-compatible module if one is already loaded or in flight for
   * `name`; otherwise calls `load()` and caches the resulting promise under `version` so a
   * concurrent or later caller with a compatible `range` gets the same instance instead of
   * loading its own. Rejection propagates to every caller sharing that promise; a failed `load()`
   * does not permanently poison the cache slot -- the next call after a failure retries. */
  resolve<T>(opts: {
    name: string;
    range: string;
    version: string;
    load: () => Promise<T>;
  }): Promise<T>;
}

/** An instantiated plugin — one instance per example/transform-output it was matched against, not
 * a global singleton. Instantiation itself may do content inspection (see `matches`); reuse
 * whatever state that computed in `render` rather than reparsing. */
export interface ViewPluginInstance {
  /** Content-based filter, for when the static `supportedTypes` soft filter isn't enough (e.g.
   * "is this actually valid GeoJSON with geometry"). Only called for candidates whose `content`
   * resolved. Return false to withdraw the match entirely — the host won't add a tab. Omit this
   * method (or always return true) to accept on type alone. */
  matches?(): boolean;
  /** Mount into `el`, an empty <div> the plugin owns. May be async — the host awaits it before
   * treating the tab as ready. */
  render(el: HTMLElement): void | Promise<void>;
  /** Optional teardown when the tab/component unmounts. Not called automatically on re-render;
   * only on actual unmount. */
  destroy?(el: HTMLElement): void;
}

/** A tab/button icon: either an MDI icon-class string (the existing/default form, resolved via
 * Vuetify's icon-set lookup), or an image URL (PNG, JPG, or SVG) rendered as a plain `<img>`.
 * Deliberately does not support a Vue component or raw inline SVG markup/path data — a plugin
 * bundles its own Vue copy, which the host cannot safely render, and an author wanting a custom
 * vector icon can already host an `.svg` file and use the `{ url }` form. Use an absolute URL:
 * a relative one resolves against the *viewer's own* page origin, not the plugin's. */
export type PluginIcon =
  | string
  | { url: string };

/** The class a plugin module exports (default or named) — constructed fresh per matching
 * candidate set, never reused across examples/transform-outputs. */
export interface ViewPluginClass {
  new(candidates: ViewPluginCandidate[], context?: ViewPluginContext): ViewPluginInstance;
  /** Soft filter: MIME types this plugin might handle, checked against each candidate's `type`
   * before instantiation. Supports wildcards ('text/*', '*\/*'). Required — a plugin with no
   * overlapping type is never instantiated. */
  supportedTypes: string[];
  /** Tab label. Required — also used to generate the tab's shareable link. */
  viewName: string;
  /** Icon for the tab: an MDI icon-class string, or `{ url }` for a custom image. Falls back to
   * 'mdi-puzzle-outline' if omitted. */
  icon?: PluginIcon;
}
