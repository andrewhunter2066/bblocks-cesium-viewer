// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/rules.js
// (unchanged apart from this header). Port later upstream fixes by hand.
import { valuesMatch } from './curie.js';

// A points/edges/rings/faces/shells/solids/parcels-or-whatever-else array entry is either a
// nested FeatureCollection wrapper (`{ features: [...] }`) or a bare Feature itself — see the
// identical helper in topo-geometry.js. Duplicated rather than imported: that module also pulls
// in earcut and is loaded lazily at render() time (topo-feature-plugin.js), while
// classifyFeatures() below must run independently of the render path — including from plain unit
// tests that never touch Three.js/earcut at all.
function collectionFeatures(item) {
  return Array.isArray(item?.features) ? item.features : [item];
}

// Every feature reachable from `data[sourceKey]`, regardless of collection-wrapper shape. Unlike
// topo-geometry.js's getFeatures(), the source key itself is a parameter here rather than a
// hard-coded call site (`data.parcels`, `data.solids`, ...) — a rule names whichever top-level
// collection it wants classified.
function sourceFeatures(data, sourceKey) {
  const collections = data?.[sourceKey];
  return Array.isArray(collections) ? collections.flatMap(collectionFeatures) : [];
}

// Resolves a dot-path against an object (e.g. getPath(feature, 'properties.parcelState')).
// Missing/non-object segments resolve to undefined rather than throwing.
export function getPath(obj, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), obj);
}

// A resolved property value counts as a usable label only if it's a non-empty primitive, or an
// object exposing a string `.label` (covers a JSON-LD-style `{ "label": "..." }` value without
// hard-coding which property names use that shape — the config decides which paths to try).
function usableLabelValue(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'object') return typeof value.label === 'string' ? value.label : undefined;
  return String(value);
}

// Picks the first configured label property that resolves to a usable value, falling back to
// `labelConfig.fallback` (itself a dot-path, defaulting to 'id') and finally the feature's own id.
// Generalizes today's hard-coded appellation/description/name/id chain (topo-feature-plugin.js)
// into a config-supplied property list — this module never names "appellation" itself.
export function resolveLabel(feature, labelConfig = {}) {
  const properties = labelConfig.properties || [];
  for (const path of properties) {
    const value = usableLabelValue(getPath(feature, path));
    if (value !== undefined) return value;
  }
  const fallbackValue = usableLabelValue(getPath(feature, labelConfig.fallback || 'id'));
  return fallbackValue ?? String(feature.id);
}

// True if `rule` claims `feature`. A rule with no `match` is a catch-all for its `source`.
function matchesRule(feature, rule, context) {
  if (!rule.match) return true;
  const actual = getPath(feature, rule.match.property);
  return valuesMatch(actual, rule.match.values || [], context);
}

// Classifies every feature reachable from any rule's `source` collection against the ordered rule
// list: for a given feature, the first rule (in `config.rules` order) whose `source` matches the
// collection it came from AND whose `match` (if any) applies to it wins. A feature no rule claims
// is left out of the result rather than guessing at a default — Stage 1 supplies the plugin's
// built-in rule set that gives every structural kind (solid/surface/parcel/...) a catch-all.
//
// `context` defaults to the document's own inline `@context` (the shape topo-feature/JSON-LD
// examples carry today) so a caller doesn't have to extract it separately in the common case.
export function classifyFeatures(data, config, context = data?.['@context'] || {}) {
  const rules = config?.rules || [];
  const sources = [...new Set(rules.map(rule => rule.source))];
  const descriptors = [];

  sources.forEach(source => {
    const rulesForSource = rules.filter(rule => rule.source === source);
    sourceFeatures(data, source).forEach(feature => {
      const rule = rulesForSource.find(candidate => matchesRule(feature, candidate, context));
      if (!rule) return;
      descriptors.push({
        feature,
        source,
        kind: rule.kind,
        // `group` lets several rules with distinct `kind`s (e.g. one per parcelState value) share
        // one panel heading / one inline toggle button, while still being individually toggleable
        // by their own `kind` underneath it. Defaults to the rule's own `kind` — a rule that never
        // sets `group` is its own group of one, identical to every kind's behaviour before `group`
        // existed.
        group: rule.group || rule.kind,
        // Human-friendly label for this specific kind's sub-heading in the panel (e.g. "Former
        // Tenure" for a `kind` of "parcel-former-tenure"). Left undefined when unset — the
        // renderer falls back to its own built-in labels or a humanized kind slug.
        kindLabel: rule.kindLabel,
        geometry: rule.geometry,
        label: resolveLabel(feature, rule.label),
        style: { ...config?.defaults?.style, ...rule.style },
        initiallyVisible: rule.initiallyVisible ?? true,
        elevation: rule.elevation || config?.defaults?.elevation || 'preserve',
      });
    });
  });

  return descriptors;
}

// Interprets a descriptor's `elevation` value into a concrete Z to flatten a feature's geometry
// to, or null if its original Z should be left alone. Two shapes are recognised: the string
// 'flatten' (Z=0), and `{ flattenTo: <number> }` for a specific datum other than zero. Anything
// else — including 'preserve', the default every rule gets when it doesn't set its own `elevation`
// — means "leave Z alone," so this returns null for it rather than guessing.
export function resolveFlattenZ(elevation) {
  if (elevation === 'flatten') return 0;
  if (elevation && typeof elevation === 'object' && typeof elevation.flattenTo === 'number') {
    return elevation.flattenTo;
  }
  return null;
}
