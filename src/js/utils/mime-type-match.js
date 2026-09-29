// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/mime-type-match.js
// (unchanged). Port later upstream fixes by hand.
// Wildcard-aware MIME type matcher. Kept as a local copy (not a shared dependency) since this
// package has no runtime dependency on bblocks-viewer or bblocks-viewer-base-plugins — each
// plugin package is standalone. Must stay behaviorally identical to bblocks-viewer's
// src/utils/mime-type-match.js, which the host uses to match `static supportedTypes` before ever
// instantiating a plugin; this copy is only used internally by the plugin's own matches() to pick
// which candidate(s) it actually wants to render.
export function mimeTypeMatches(pattern, type) {
  if (!pattern || !type) return false;
  if (pattern === '*/*' || pattern === type) return true;
  const [pType, pSub] = pattern.split('/');
  const [tType, tSub] = type.split('/');
  return pType === tType && (pSub === '*' || pSub === tSub);
}
