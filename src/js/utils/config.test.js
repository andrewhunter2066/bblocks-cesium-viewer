// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/config.test.js
// (unchanged apart from this header). Port later upstream fixes by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, normalizeConfig, mergeConfig } from './config.js';

test('parseConfig parses a valid JSON string', () => {
  const config = parseConfig('{"rules":[{"source":"parcels","kind":"parcel"}]}');
  assert.equal(config.rules.length, 1);
  assert.equal(config.rules[0].source, 'parcels');
});

test('parseConfig accepts an already-parsed object', () => {
  const config = parseConfig({ rules: [{ source: 'solids', kind: 'solid' }] });
  assert.equal(config.rules[0].kind, 'solid');
});

test('parseConfig falls back to an empty config on invalid JSON rather than throwing', () => {
  assert.deepEqual(parseConfig('{not valid json'), { rules: [], defaults: {}, kindOrder: [] });
});

test('parseConfig falls back to an empty config for null/undefined/non-object input', () => {
  assert.deepEqual(parseConfig(null), { rules: [], defaults: {}, kindOrder: [] });
  assert.deepEqual(parseConfig(undefined), { rules: [], defaults: {}, kindOrder: [] });
  assert.deepEqual(parseConfig('"just a string"'), { rules: [], defaults: {}, kindOrder: [] });
  assert.deepEqual(parseConfig(['not', 'an', 'object']), { rules: [], defaults: {}, kindOrder: [] });
});

test('normalizeConfig drops malformed individual fields instead of propagating them', () => {
  const config = normalizeConfig({ rules: 'not-an-array', defaults: 'nope', kindOrder: 42 });
  assert.deepEqual(config, { rules: [], defaults: {}, kindOrder: [] });
});

test('mergeConfig lets an override fully replace the base rule set', () => {
  const base = { rules: [{ source: 'parcels', kind: 'parcel' }] };
  const override = { rules: [{ source: 'parcels', kind: 'former-tenure-parcel' }] };
  const merged = mergeConfig(base, override);
  assert.deepEqual(merged.rules, override.rules);
});

test('mergeConfig keeps the base rule set when the override supplies none', () => {
  const base = { rules: [{ source: 'parcels', kind: 'parcel' }] };
  const merged = mergeConfig(base, {});
  assert.deepEqual(merged.rules, base.rules);
});

test('mergeConfig shallow-merges defaults, and defaults.style within that', () => {
  const base = { defaults: { elevation: 'preserve', style: { opacity: 1, color: '#fff' } } };
  const override = { defaults: { style: { opacity: 0.5 } } };
  const merged = mergeConfig(base, override);
  assert.deepEqual(merged.defaults, {
    elevation: 'preserve',
    style: { opacity: 0.5, color: '#fff' },
  });
});
