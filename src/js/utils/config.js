// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/config.js
// (unchanged apart from this header). Port later upstream fixes by hand.
// Safe parsing/merging for a per-block topo-viewer rendering config (see the plugin's config
// model design). Every function here is total — malformed input is dropped rather than thrown, on
// the same principle the host's own plugin contract requires of matches()/render(): a bad config
// must degrade to "render nothing extra," never crash the tab. Stage 1 is what actually feeds this
// module the plugin's built-in default rule set; this module only guarantees a safe, predictable
// shape to merge onto.

const EMPTY_CONFIG = Object.freeze({ rules: [], defaults: {}, kindOrder: [] });

// Fills in the top-level shape so a caller (classifyFeatures) never has to null-check
// `config.rules`/`config.defaults`/`config.kindOrder` — a malformed individual field is dropped
// rather than allowed to crash a later `.map()`/`.filter()` call.
export function normalizeConfig(config) {
  return {
    rules: Array.isArray(config?.rules) ? config.rules : [],
    defaults: (config?.defaults && typeof config.defaults === 'object' && !Array.isArray(config.defaults))
      ? config.defaults
      : {},
    kindOrder: Array.isArray(config?.kindOrder) ? config.kindOrder : [],
  };
}

// Parses a fetched per-block viewer-config resource, which may arrive as a JSON string (fetched
// text) or an already-parsed object. Never throws: missing input, invalid JSON, or a non-object
// top level all resolve to an empty-but-structurally-valid config.
export function parseConfig(raw) {
  if (raw == null) return { ...EMPTY_CONFIG };
  let candidate = raw;
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return { ...EMPTY_CONFIG };
    }
  }
  if (typeof candidate !== 'object' || Array.isArray(candidate)) return { ...EMPTY_CONFIG };
  return normalizeConfig(candidate);
}

// Merges a per-block config over a base (the plugin's built-in defaults, once Stage 1 defines
// them). `rules`/`kindOrder` replace the base entirely when `override` supplies any non-empty
// list — a block's config fully describes its own rule set rather than appending to a base rule
// set it never sees — while `defaults` (and `defaults.style` within it) shallow-merge, so a block
// can override just e.g. the default opacity without restating everything else.
export function mergeConfig(base, override) {
  const b = normalizeConfig(base);
  const o = normalizeConfig(override);
  return {
    rules: o.rules.length ? o.rules : b.rules,
    kindOrder: o.kindOrder.length ? o.kindOrder : b.kindOrder,
    defaults: {
      ...b.defaults,
      ...o.defaults,
      style: { ...b.defaults.style, ...o.defaults.style },
    },
  };
}
