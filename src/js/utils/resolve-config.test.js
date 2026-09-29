// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/resolve-config.test.js
// (unchanged apart from this header). Port later upstream fixes by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWER_CONFIG_RESOURCE_ROLE, findViewerConfigResource, loadViewerConfig } from './resolve-config.js';

const DEFAULT_CONFIG = { rules: [{ source: 'parcels', kind: 'parcel' }], defaults: { style: { opacity: 1 } } };

test('findViewerConfigResource finds the resource by its well-known role', () => {
  const bblock = {
    resources: [
      { role: 'https://www.w3.org/ns/dx/prof/role/example', ref: 'example.json', format: 'application/json' },
      { role: VIEWER_CONFIG_RESOURCE_ROLE, ref: 'viewer-config.json', format: 'application/json' },
    ],
  };
  assert.equal(findViewerConfigResource(bblock).ref, 'viewer-config.json');
});

test('findViewerConfigResource returns null when no resource matches, or bblock is missing/malformed', () => {
  assert.equal(findViewerConfigResource({ resources: [{ role: 'other', ref: 'x' }] }), null);
  assert.equal(findViewerConfigResource({}), null);
  assert.equal(findViewerConfigResource(null), null);
  assert.equal(findViewerConfigResource(undefined), null);
  assert.equal(findViewerConfigResource({ resources: 'not-an-array' }), null);
});

test('loadViewerConfig falls back to the defaults when context.bblock is missing', async () => {
  const result = await loadViewerConfig(null, DEFAULT_CONFIG, () => { throw new Error('should not fetch'); });
  assert.deepEqual(result.rules, DEFAULT_CONFIG.rules);
});

test('loadViewerConfig falls back to the defaults when no resource matches the role', async () => {
  const context = { bblock: { resources: [{ role: 'other', ref: 'x.json' }] } };
  const result = await loadViewerConfig(context, DEFAULT_CONFIG, () => { throw new Error('should not fetch'); });
  assert.deepEqual(result.rules, DEFAULT_CONFIG.rules);
});

test('loadViewerConfig fetches and merges a matching resource over the defaults', async () => {
  const context = {
    bblock: { resources: [{ role: VIEWER_CONFIG_RESOURCE_ROLE, ref: 'https://example.org/viewer-config.json' }] },
  };
  const override = { rules: [{ source: 'parcels', kind: 'former-tenure-parcel' }] };
  const fetchImpl = async url => {
    assert.equal(url, 'https://example.org/viewer-config.json');
    return { ok: true, text: async () => JSON.stringify(override) };
  };
  const result = await loadViewerConfig(context, DEFAULT_CONFIG, fetchImpl);
  assert.deepEqual(result.rules, override.rules);
  // defaults.style is preserved from the base config since the override didn't set its own.
  assert.equal(result.defaults.style.opacity, 1);
});

test('loadViewerConfig falls back to the defaults on a non-ok response, without throwing', async () => {
  const context = { bblock: { resources: [{ role: VIEWER_CONFIG_RESOURCE_ROLE, ref: 'x.json' }] } };
  const fetchImpl = async () => ({ ok: false, status: 404, text: async () => '' });
  const result = await loadViewerConfig(context, DEFAULT_CONFIG, fetchImpl);
  assert.deepEqual(result.rules, DEFAULT_CONFIG.rules);
});

test('loadViewerConfig falls back to the defaults when fetch rejects, without throwing', async () => {
  const context = { bblock: { resources: [{ role: VIEWER_CONFIG_RESOURCE_ROLE, ref: 'x.json' }] } };
  const fetchImpl = async () => { throw new Error('network down'); };
  const result = await loadViewerConfig(context, DEFAULT_CONFIG, fetchImpl);
  assert.deepEqual(result.rules, DEFAULT_CONFIG.rules);
});

test('loadViewerConfig falls back to the defaults when the fetched body is not valid JSON', async () => {
  const context = { bblock: { resources: [{ role: VIEWER_CONFIG_RESOURCE_ROLE, ref: 'x.json' }] } };
  const fetchImpl = async () => ({ ok: true, text: async () => '{not valid json' });
  const result = await loadViewerConfig(context, DEFAULT_CONFIG, fetchImpl);
  assert.deepEqual(result.rules, DEFAULT_CONFIG.rules);
});

test('loadViewerConfig has no resource.ref -> falls back to defaults without fetching', async () => {
  const context = { bblock: { resources: [{ role: VIEWER_CONFIG_RESOURCE_ROLE }] } };
  const result = await loadViewerConfig(context, DEFAULT_CONFIG, () => { throw new Error('should not fetch'); });
  assert.deepEqual(result.rules, DEFAULT_CONFIG.rules);
});
