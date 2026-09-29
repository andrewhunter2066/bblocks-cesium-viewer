import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CESIUM_OPTIONS, resolveCesiumOptions } from './cesium-options.js';

test('no cesium key gives the token-free defaults and no warnings', () => {
  const { options, warnings } = resolveCesiumOptions(undefined);
  assert.deepEqual(options, { ...DEFAULT_CESIUM_OPTIONS });
  assert.deepEqual(options, { basemap: 'osm', terrain: 'ellipsoid', camera: null, ionToken: '' });
  assert.deepEqual(warnings, []);
});

test('a full valid config is kept', () => {
  const raw = {
    basemap: 'ion',
    terrain: 'ion',
    camera: { longitude: 115.8, latitude: -31.9, height: 300, heading: 10, pitch: -30, roll: 1 },
    ionToken: '  tok  ',
  };
  const { options, warnings } = resolveCesiumOptions(raw);
  assert.deepEqual(options, { ...raw, ionToken: 'tok' });
  assert.deepEqual(warnings, []);
});

test('ion imagery and terrain without a token fall back, with a warning each', () => {
  const { options, warnings } = resolveCesiumOptions({ basemap: 'ion', terrain: 'ion' });
  assert.equal(options.basemap, 'osm');
  assert.equal(options.terrain, 'ellipsoid');
  assert.equal(warnings.length, 2);
  assert.match(warnings.join(' '), /needs an ion token/);
});

test('camera defaults heading 0, pitch -45, roll 0', () => {
  const { options } = resolveCesiumOptions({ camera: { longitude: 1, latitude: 2, height: 3 } });
  assert.deepEqual(options.camera, { longitude: 1, latitude: 2, height: 3, heading: 0, pitch: -45, roll: 0 });
});

test('an invalid camera is dropped (the data is framed instead)', () => {
  for (const camera of [{ longitude: 200, latitude: 0, height: 1 }, { longitude: 1, latitude: 2 }, { longitude: 1, latitude: 2, height: 3, pitch: -120 }, 'north']) {
    const { options, warnings } = resolveCesiumOptions({ camera });
    assert.equal(options.camera, null, JSON.stringify(camera));
    assert.equal(warnings.length, 1);
  }
});

test('a custom tile template basemap must be https with {z}/{x}/{y}', () => {
  const good = { url: 'https://tiles.example.org/{z}/{x}/{y}.png', credit: 'Ex', maximumLevel: 18, extra: 'dropped' };
  assert.deepEqual(resolveCesiumOptions({ basemap: good }).options.basemap, { url: good.url, credit: 'Ex', maximumLevel: 18 });

  for (const url of ['http://tiles.example.org/{z}/{x}/{y}.png', 'https://tiles.example.org/{z}/{x}.png', 'javascript:alert(1)//{z}{x}{y}']) {
    const { options, warnings } = resolveCesiumOptions({ basemap: { url } });
    assert.equal(options.basemap, 'osm', url);
    assert.equal(warnings.length, 1);
  }
});

test('unknown basemap and terrain names fall back with warnings', () => {
  const { options, warnings } = resolveCesiumOptions({ basemap: 'bing', terrain: 'mars' });
  assert.deepEqual([options.basemap, options.terrain], ['osm', 'ellipsoid']);
  assert.equal(warnings.length, 2);
});

test('a non-object cesium value or non-string token is ignored', () => {
  assert.equal(resolveCesiumOptions([]).warnings.length, 1);
  assert.deepEqual(resolveCesiumOptions('ion').options, { ...DEFAULT_CESIUM_OPTIONS });
  const { options, warnings } = resolveCesiumOptions({ ionToken: 42 });
  assert.equal(options.ionToken, '');
  assert.equal(warnings.length, 1);
});
