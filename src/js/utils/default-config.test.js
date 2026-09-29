// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/default-config.test.js
// (unchanged apart from this header). Port later upstream fixes by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDefaultConfig } from './default-config.js';

const OPACITIES = { solid: 1, surface: 0.55, parcel: 0.35, face: 0.85, ring: 1 };

test('a document with solids, open shells and parcels gets all three primary-tier rules, in that order', () => {
  const { rules } = buildDefaultConfig(
    { solidCount: 2, openShellCount: 1, parcelCount: 3, faceCount: 0, ringCount: 0 },
    OPACITIES
  );
  assert.deepEqual(rules.map(r => r.source), ['solids', 'surfaces', 'parcels']);
  assert.deepEqual(rules.map(r => r.kind), ['solid', 'surface', 'parcel']);
  assert.equal(rules[0].style.opacity, OPACITIES.solid);
  assert.equal(rules[1].style.opacity, OPACITIES.surface);
  assert.equal(rules[2].style.opacity, OPACITIES.parcel);
});

test('parcels alone still trigger the primary tier, with a surface rule included even at zero count', () => {
  const { rules } = buildDefaultConfig(
    { solidCount: 0, openShellCount: 0, parcelCount: 2, faceCount: 0, ringCount: 0 },
    OPACITIES
  );
  // No 'solid' rule (solidCount is 0), but 'surface' is still present — matching the original's
  // unconditional openShells.forEach, which is simply a no-op when there are none.
  assert.deepEqual(rules.map(r => r.source), ['surfaces', 'parcels']);
});

test('open shells alone (no solids, no parcels) still trigger the primary tier', () => {
  const { rules } = buildDefaultConfig(
    { solidCount: 0, openShellCount: 1, parcelCount: 0, faceCount: 5, ringCount: 5 },
    OPACITIES
  );
  // Primary tier wins over faces/rings even though faces/rings are also present, matching the
  // original's `if (hasPrimaryTier) { ...; return; }` short-circuit.
  assert.deepEqual(rules.map(r => r.source), ['surfaces', 'parcels']);
});

test('faces render only when the primary tier is entirely absent', () => {
  const { rules } = buildDefaultConfig(
    { solidCount: 0, openShellCount: 0, parcelCount: 0, faceCount: 3, ringCount: 3 },
    OPACITIES
  );
  assert.deepEqual(rules, [
    { source: 'faces', kind: 'face', geometry: 'face', label: rules[0].label, style: { opacity: OPACITIES.face } },
  ]);
});

test('rings render only when there is no primary tier and no faces', () => {
  const { rules } = buildDefaultConfig(
    { solidCount: 0, openShellCount: 0, parcelCount: 0, faceCount: 0, ringCount: 2 },
    OPACITIES
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, 'rings');
  assert.equal(rules[0].style.opacity, OPACITIES.ring);
});

test('an empty document produces no rules at all (raw edges/points fallback is the renderer\'s job)', () => {
  const { rules } = buildDefaultConfig(
    { solidCount: 0, openShellCount: 0, parcelCount: 0, faceCount: 0, ringCount: 0 },
    OPACITIES
  );
  assert.deepEqual(rules, []);
});

test('every default rule uses the same appellation/description/name/id label fallback chain', () => {
  const { rules } = buildDefaultConfig({ solidCount: 1 }, OPACITIES);
  assert.deepEqual(rules[0].label.properties, [
    'properties.appellation.label',
    'properties.appellation',
    'properties.description',
    'properties.name',
  ]);
  assert.equal(rules[0].label.fallback, 'id');
});
