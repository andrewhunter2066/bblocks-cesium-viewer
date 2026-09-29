import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  configResourceOf,
  ionConfigFileName,
  parseEnvToken,
  pointAtIonConfig,
  restoreResources,
  withIon,
} from './local-ion.mjs';
import { CESIUM_VIEWER_CONFIG_ROLE, TOPO_VIEWER_CONFIG_ROLE } from '../../src/js/utils/load-config.js';

const ION_REF = 'http://localhost:9090/register/build-local/ion-configs/x.json';
const cesiumResource = ref => ({ role: CESIUM_VIEWER_CONFIG_ROLE, ref, format: 'application/json' });

test('parseEnvToken reads the variable, quoted or not, ignoring comments and others', () => {
  assert.equal(parseEnvToken('VITE_CESIUM_ION_TOKEN=abc.def'), 'abc.def');
  assert.equal(parseEnvToken('# comment\nOTHER=1\nexport VITE_CESIUM_ION_TOKEN = "a b"\n'), 'a b');
  assert.equal(parseEnvToken("VITE_CESIUM_ION_TOKEN='xyz'\r\n"), 'xyz');
  assert.equal(parseEnvToken('VITE_CESIUM_ION_TOKEN=tok # inline comment'), 'tok');
});

test('parseEnvToken is empty for a blank, missing or commented-out token', () => {
  assert.equal(parseEnvToken('VITE_CESIUM_ION_TOKEN='), '');
  assert.equal(parseEnvToken('# VITE_CESIUM_ION_TOKEN=secret'), '');
  assert.equal(parseEnvToken('OTHER=1'), '');
  assert.equal(parseEnvToken(undefined), '');
});

test('withIon switches on ion imagery and terrain and adds the token, keeping the rules', () => {
  const rules = [{ source: 'solids', kind: 'solid', geometry: 'solid' }];
  assert.deepEqual(withIon({ rules }, 't'), { rules, cesium: { basemap: 'ion', terrain: 'ion', ionToken: 't' } });
  assert.deepEqual(withIon(undefined, 't'), { cesium: { basemap: 'ion', terrain: 'ion', ionToken: 't' } });
});

test('withIon keeps a basemap, terrain or camera the block chose', () => {
  const camera = { longitude: 1, latitude: 2, height: 3 };
  const { cesium } = withIon({ cesium: { basemap: 'osm', camera, ionToken: 'old' } }, 'new');
  assert.deepEqual(cesium, { basemap: 'osm', terrain: 'ion', camera, ionToken: 'new' });
});

test('pointAtIonConfig redirects the block\'s own Globe config and remembers the original', () => {
  const [redirected] = pointAtIonConfig([cesiumResource('orig.json')], ION_REF);
  assert.equal(redirected.ref, ION_REF);
  assert.equal(redirected.originalRef, 'orig.json');
});

test('pointAtIonConfig adds a Globe config when there is none, or only a Three.js one', () => {
  const topo = { role: TOPO_VIEWER_CONFIG_ROLE, ref: 'topo.json', format: 'application/json' };
  for (const resources of [[], [topo]]) {
    const result = pointAtIonConfig(resources, ION_REF);
    assert.equal(configResourceOf(result).ref, ION_REF, 'the added config takes precedence');
    assert.equal(result.at(-1).addedForLocalIon, true);
  }
});

test('restoreResources undoes an injection exactly, and is a no-op otherwise', () => {
  const original = [{ role: 'data', ref: 'd.ttl', format: 'text/turtle' }, cesiumResource('orig.json')];
  assert.deepEqual(restoreResources(pointAtIonConfig(original, ION_REF)), original);
  assert.deepEqual(restoreResources(pointAtIonConfig([], ION_REF)), []);
  assert.deepEqual(restoreResources(original), original);
  assert.deepEqual(restoreResources(undefined), []);
});

test('injecting twice gives the same result as once', () => {
  const once = pointAtIonConfig(restoreResources([cesiumResource('orig.json')]), ION_REF);
  const twice = pointAtIonConfig(restoreResources(once), ION_REF);
  assert.deepEqual(twice, once);
});

test('ionConfigFileName makes a safe file name from a block identifier', () => {
  assert.equal(ionConfigFileName('ogc.bbr.template.cesiumViewerDemo.parcel'), 'ogc.bbr.template.cesiumViewerDemo.parcel.json');
  assert.equal(ionConfigFileName('a/b:c'), 'a_b_c.json');
});
