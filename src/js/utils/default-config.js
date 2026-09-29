// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/default-config.js
// (unchanged apart from this header). Port later upstream fixes by hand.
// The plugin's built-in default rule set, expressed as rules (see rules.js) rather than as
// bespoke branches in the renderer — so that Stage 2 (a per-block config) can override or extend
// exactly what a document renders by default without the renderer's classification logic
// changing. Deliberately has no import of topo-geometry.js or Three.js: every fact this needs
// about a document (how many solids/open shells/parcels/faces/rings it has, and what opacity each
// tier should use) is passed in by the caller, which already computes them for geometry-building
// regardless — this keeps the branch decision itself pure and unit-testable on its own.

const DEFAULT_LABEL = {
  properties: ['properties.appellation.label', 'properties.appellation', 'properties.description', 'properties.name'],
  fallback: 'id',
};

// Mirrors the pre-rule-engine _buildScene(): solids, open shells and Polygon-topology parcels
// render together as one "primary" tier whenever any of the three is present (an open-shell or
// parcel rule is included even with a zero count for that source — matching every renderable's
// worth of the original's unconditional `openShells.forEach`/`parcels.forEach`, which is simply a
// no-op over an empty array). Only when none of the three is present does a single-tier fallback
// (faces, else rings) apply. Bare edges/points have no per-feature kind or label to configure and
// stay outside the rule engine entirely — the renderer draws them directly.
export function buildDefaultConfig(counts, opacities) {
  const { solidCount = 0, openShellCount = 0, parcelCount = 0, faceCount = 0, ringCount = 0 } = counts;
  const hasPrimaryTier = solidCount > 0 || openShellCount > 0 || parcelCount > 0;
  const rules = [];

  if (hasPrimaryTier) {
    if (solidCount > 0) {
      rules.push({ source: 'solids', kind: 'solid', geometry: 'solid', label: DEFAULT_LABEL, style: { opacity: opacities.solid } });
    }
    rules.push({ source: 'surfaces', kind: 'surface', geometry: 'open-shell', label: DEFAULT_LABEL, style: { opacity: opacities.surface } });
    rules.push({ source: 'parcels', kind: 'parcel', geometry: 'polygon', label: DEFAULT_LABEL, style: { opacity: opacities.parcel } });
  } else if (faceCount > 0) {
    rules.push({ source: 'faces', kind: 'face', geometry: 'face', label: DEFAULT_LABEL, style: { opacity: opacities.face } });
  } else if (ringCount > 0) {
    rules.push({ source: 'rings', kind: 'ring', geometry: 'ring', label: DEFAULT_LABEL, style: { opacity: opacities.ring } });
  }

  return { rules };
}
