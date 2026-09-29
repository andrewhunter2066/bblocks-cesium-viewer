// Canonical type-only reference for bblocks-viewer's tab-plugin contract — the interface a
// register-declared plugin class must satisfy to render its own top-level bblock-detail tab, and
// the shape of the `context` object bblocks-viewer always constructs and passes to it.
// bblocks-viewer itself is the runtime authority (see its src/composables/tab-plugins.js for
// matching/context-construction and .claude/tab-plugins-design.md for the full design rationale);
// this repo exists only so that authority's type contract can be depended on without pulling in
// the entire app.
//
// Deliberately a separate, parallel contract from the view-plugin one in view-plugin.d.ts, not a
// generalization of it — the inputs differ in kind (a whole bblock vs. one example/transform-output
// candidate set) and this file's types are not meant to be interchanged with that one's. See
// bblocks-viewer's design doc, "Relationship to view plugins", for why.
//
// Usage is identical to the view-plugin contract — see this package's README.

import type {DependencyResolver, PluginIcon} from './view-plugin';

/** Host information passed as the constructor's only argument. Always supplied by bblocks-viewer.
 * Unlike ViewPluginContext, this carries the full bblock and register objects directly (there's
 * nothing to eagerly fetch/normalize — the full bblock is already in memory by match time) plus a
 * curated document-fetching facade, since a tab plugin's decision/render isn't expected to be
 * scoped to a single bblock field. */
export interface TabPluginContext {
  /** The full, already-fetched bblock (json-full shape) this tab belongs to. */
  bblock: Record<string, unknown>;
  /** The full, already-constructed register object this bblock belongs to (post-`imports`
   * resolution, colors assigned) — not a re-fetched or trimmed copy. */
  register: Record<string, unknown> | null;
  /** The viewer's resolved runtime config (fallback Rainbow/SPARQL endpoints, etc). Null if
   * unavailable. */
  viewerConfig: Record<string, unknown> | null;
  /** Optional infra for sharing a runtime instance of a heavy CDN-loaded dependency between
   * plugins. See ViewPluginContext.depResolver and the shared-dependency-resolver design doc. */
  depResolver?: DependencyResolver;
  /** Fetches a bblock's document by one of its own declared properties (e.g. 'schema',
   * 'ontology') — same helper regular viewer components use via composables/bblock.js. */
  fetchDocument(bblock: Record<string, unknown>, property: string): Promise<unknown>;
  /** Fetches a document by an absolute URL, honoring the same size-limit/caching behavior as
   * regular viewer components. */
  fetchDocumentByUrl(bblock: Record<string, unknown>, url: string, options?: {maxSize?: number}): Promise<unknown>;
  /** Looks up a single other bblock by itemIdentifier, across every loaded register. */
  getBBlock(itemIdentifier: string): Promise<Record<string, unknown> | undefined>;
  /** Looks up the full bblock index. Pass `true` to include bblocks from imported registers, not
   * just the local register. */
  getBBlocks(includeRemote?: boolean): Promise<Record<string, Record<string, unknown>>>;
}

/** An instantiated plugin — one instance per bblock it was matched against, not a global
 * singleton. */
export interface TabPluginInstance {
  /** Whole-context predicate deciding whether this plugin contributes a tab for this bblock — not
   * bound to checking a single named field. May be async. Return false (or reject) to withdraw
   * the match entirely; a throwing/rejecting `matches()` is treated as a non-match, logged and
   * skipped, not surfaced as an error tab. Default true if unimplemented. */
  matches?(): boolean | Promise<boolean>;
  /** Mount into `el`, an empty container the plugin owns for the *entire* tab body — not a small
   * chrome-wrapped box like a view plugin's. No fullscreen-toggle chrome is provided; a plugin
   * wanting overlay/fullscreen behavior implements it itself. May be async. */
  render(el: HTMLElement): void | Promise<void>;
  /** Teardown when the tab is unmounted (bblock changes, or — for a `cacheable: false` plugin —
   * whenever its tab is simply left). Not called for a `cacheable: true` (default) plugin on a
   * same-bblock tab switch, only on navigation to a different bblock. */
  destroy?(el: HTMLElement): void;
}

/** The class a plugin module exports (default or named) — constructed once per bblock, reused
 * across repeated `matches()`/`render()` calls for that same bblock. */
export interface TabPluginClass {
  new(context: TabPluginContext): TabPluginInstance;
  /** Route `section` slug and DOM/Vue `:key`. Required for a plugin to be considered valid
   * (recoverable if simply *missing*: the host synthesizes one by slugifying `tabLabel`, or the
   * module export name as a last resort — but a plugin should still declare it explicitly for a
   * stable link across rebuilds, the same reason `viewName` is required for view plugins). Must
   * be a stable string across rebuilds — never a minified class name. On collision with a
   * built-in tab id or another loaded plugin's `tabId`, the host suffixes it deterministically
   * (the colliding plugin's module export name, then a counter) rather than silently dropping a
   * tab. */
  tabId?: string;
  /** v-tab display text. Required — a plugin missing this is skipped entirely (logged), since
   * there's no sensible placeholder for user-facing text. */
  tabLabel: string;
  /** Icon for the tab: an MDI icon-class string, or `{ url }` for a custom image. Falls back to
   * 'mdi-puzzle-outline' if omitted. */
  icon?: PluginIcon;
  /** Ordering among other matched tab plugins for the same bblock (not relative to the fixed
   * built-in tabs, which this mechanism always renders after). Higher sorts first. Default 0. */
  weight?: number;
  /** Whether the instance + rendered DOM persist across same-bblock tab switches (`true`,
   * default) or are torn down (`destroy()`) the moment the tab is left and rebuilt (`render()`) on
   * reactivation (`false`). Set `false` for anything holding a live connection/poller that
   * shouldn't keep running in a backgrounded tab. Either way, the instance is always destroyed
   * when the user navigates to a *different* bblock. */
  cacheable?: boolean;
}
