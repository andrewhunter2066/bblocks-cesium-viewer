// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/curie.js
// (unchanged apart from this header). Port later upstream fixes by hand.
// Generic value matching for topo-viewer rendering rules (see the plugin's config model design).
// This module has no vocabulary of its own — it only knows how to mechanically expand a CURIE
// against a document's own inline JSON-LD `@context` and compare values. A rule config author can
// write a literal ("decommissioned"), a CURIE ("wa-parcel-state:former-tenure"), or a full URI
// ("http://example.org/utility-status#planned") and this module treats all three the same way.

// Expands `value` against `context` (a flat { prefix: baseUri } map, as found verbatim in a
// topo-feature document's own `@context`). A value with no ':', or whose prefix isn't a key in
// `context`, is returned unchanged — that covers bare literals, already-absolute URIs (their
// "prefix" up to the first ':' is 'http'/'https', never a context key), and CURIEs the document's
// own context doesn't define.
export function expandCurie(value, context = {}) {
  if (typeof value !== 'string') return value;
  const separatorIndex = value.indexOf(':');
  if (separatorIndex === -1) return value;
  const prefix = value.slice(0, separatorIndex);
  const base = context[prefix];
  if (typeof base !== 'string') return value;
  return base + value.slice(separatorIndex + 1);
}

// True if `actual` (a feature property's raw value, possibly an array) matches any of
// `candidates` (a rule's configured match values), after expanding both sides against the same
// `context`. Expanding both sides is what lets a document's CURIE match a rule written as a full
// URI, or vice versa, without either side needing to already agree on form; a literal expands to
// itself on both sides, so literal-literal comparison falls out of the same code path.
export function valuesMatch(actual, candidates, context = {}) {
  if (actual === undefined || actual === null) return false;
  const actualValues = (Array.isArray(actual) ? actual : [actual]).map(v => expandCurie(v, context));
  return candidates.some(candidate => actualValues.includes(expandCurie(candidate, context)));
}
