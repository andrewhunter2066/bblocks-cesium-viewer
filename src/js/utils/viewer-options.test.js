import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OSM_CREDIT, OSM_MAX_LEVEL, OSM_TILE_URL, buildViewerOptions, disableIonDefaults } from './viewer-options.js';
import { createFakeCesium } from '../test-support/fake-cesium.js';

test('disableIonDefaults blanks the bundled demo ion token', () => {
  const Cesium = createFakeCesium();
  disableIonDefaults(Cesium);
  assert.equal(Cesium.Ion.defaultAccessToken, '');
});

test('base layer is OpenStreetMap imagery with attribution', () => {
  const Cesium = createFakeCesium();
  const options = buildViewerOptions(Cesium);
  assert.ok(options.baseLayer instanceof Cesium.ImageryLayer);
  const provider = options.baseLayer.imageryProvider;
  assert.ok(provider instanceof Cesium.OpenStreetMapImageryProvider);
  assert.equal(provider.options.url, OSM_TILE_URL);
  assert.equal(OSM_TILE_URL, 'https://tile.openstreetmap.org/');
  assert.equal(provider.options.credit, OSM_CREDIT);
});

test('OSM imagery stops at zoom 19, the deepest level the tile server has', () => {
  const Cesium = createFakeCesium();
  const provider = buildViewerOptions(Cesium).baseLayer.imageryProvider;
  assert.equal(OSM_MAX_LEVEL, 19);
  assert.equal(provider.options.maximumLevel, OSM_MAX_LEVEL);
});

test('terrain is the flat ellipsoid, not ion world terrain', () => {
  const Cesium = createFakeCesium();
  const options = buildViewerOptions(Cesium);
  assert.ok(options.terrainProvider instanceof Cesium.EllipsoidTerrainProvider);
  assert.equal(options.terrain, undefined);
});

test('ion-backed and unwanted widgets are disabled', () => {
  const options = buildViewerOptions(createFakeCesium());
  for (const widget of ['baseLayerPicker', 'geocoder', 'timeline', 'animation']) {
    assert.equal(options[widget], false, `${widget} must be explicitly false`);
  }
});

test('renders on demand rather than continuously', () => {
  const options = buildViewerOptions(createFakeCesium());
  assert.equal(options.requestRenderMode, true);
  assert.equal(options.maximumRenderTimeChange, Infinity);
});
