import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CESIUM_VIEWER_CONFIG_ROLE, TOPO_VIEWER_CONFIG_ROLE, findConfigResource, loadConfig } from './load-config.js';

const DEFAULT_CONFIG = { rules: [{ source: 'solids', kind: 'solid', geometry: 'solid' }] };

const respond = body => async () => ({ ok: true, status: 200, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
const context = (...resources) => ({ bblock: { resources } });
const resource = (role, ref) => ({ role, ref, format: 'application/json' });

test('the roles are distinct, well-known URIs', () => {
  assert.equal(CESIUM_VIEWER_CONFIG_ROLE, 'https://github.com/ogcincubator/bblocks-cesium-viewer/role/viewer-config');
  assert.equal(TOPO_VIEWER_CONFIG_ROLE, 'https://github.com/ogcincubator/bblocks-viewer-topo-feature-plugin/role/viewer-config');
});

test('the Cesium role wins over a Three.js viewer config on the same block', () => {
  const bblock = { resources: [resource(TOPO_VIEWER_CONFIG_ROLE, 'topo.json'), resource(CESIUM_VIEWER_CONFIG_ROLE, 'cesium.json')] };
  assert.equal(findConfigResource(bblock).ref, 'cesium.json');
});

test('a Three.js viewer config is used when there is no Cesium one', () => {
  assert.equal(findConfigResource({ resources: [resource(TOPO_VIEWER_CONFIG_ROLE, 'topo.json')] }).ref, 'topo.json');
});

test('no resource, or a malformed bblock, gives no resource', () => {
  assert.equal(findConfigResource({ resources: [resource('other', 'x.json')] }), null);
  assert.equal(findConfigResource({ resources: [{ role: CESIUM_VIEWER_CONFIG_ROLE }] }), null, 'a resource without ref');
  assert.equal(findConfigResource(null), null);
  assert.equal(findConfigResource({ resources: 'nope' }), null);
});

test('without a config resource: defaults, no fetch', async () => {
  const loaded = await loadConfig({}, DEFAULT_CONFIG, () => assert.fail('must not fetch'));
  assert.deepEqual(loaded.config.rules, DEFAULT_CONFIG.rules);
  assert.equal(loaded.cesium.basemap, 'osm');
  assert.equal(loaded.ref, null);
  assert.deepEqual(loaded.warnings, []);
});

test('a block config replaces the rules and supplies cesium options', async () => {
  const rules = [{ source: 'parcels', kind: 'parcel', geometry: 'polygon' }];
  const body = { rules, cesium: { camera: { longitude: 1, latitude: 2, height: 3 }, ionToken: 't', basemap: 'ion' } };
  const loaded = await loadConfig(context(resource(CESIUM_VIEWER_CONFIG_ROLE, 'https://r.example/c.json')), DEFAULT_CONFIG, respond(body));
  assert.deepEqual(loaded.config.rules, rules);
  assert.equal(loaded.cesium.basemap, 'ion');
  assert.equal(loaded.cesium.ionToken, 't');
  assert.equal(loaded.cesium.camera.height, 3);
  assert.equal(loaded.ref, 'https://r.example/c.json');
});

test('a cesium-only config keeps the built-in rules', async () => {
  const loaded = await loadConfig(context(resource(CESIUM_VIEWER_CONFIG_ROLE, 'c.json')), DEFAULT_CONFIG, respond({ cesium: { terrain: 'ellipsoid' } }));
  assert.deepEqual(loaded.config.rules, DEFAULT_CONFIG.rules);
});

test('fetch failures, HTTP errors and bad JSON fall back to the defaults with a warning', async () => {
  const ctx = context(resource(CESIUM_VIEWER_CONFIG_ROLE, 'c.json'));
  const cases = [
    async () => { throw new Error('offline'); },
    async () => ({ ok: false, status: 404, text: async () => '' }),
    respond('{not json'),
    respond('[1, 2]'),
  ];
  for (const fetchImpl of cases) {
    const loaded = await loadConfig(ctx, DEFAULT_CONFIG, fetchImpl);
    assert.deepEqual(loaded.config.rules, DEFAULT_CONFIG.rules);
    assert.equal(loaded.cesium.basemap, 'osm');
    assert.equal(loaded.warnings.length, 1);
  }
});

test('cesium option warnings are passed through', async () => {
  const loaded = await loadConfig(context(resource(CESIUM_VIEWER_CONFIG_ROLE, 'c.json')), DEFAULT_CONFIG, respond({ cesium: { terrain: 'ion' } }));
  assert.equal(loaded.cesium.terrain, 'ellipsoid');
  assert.match(loaded.warnings[0], /needs an ion token/);
});
