import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OSM_CREDIT, OSM_MAX_LEVEL, OSM_TILE_URL, buildViewerOptions, fallBackFromIonErrors, setIonToken,
} from './viewer-options.js';
import { createFakeCesium } from '../test-support/fake-cesium.js';

test('setIonToken replaces the bundled demo token — blank when there is no token', () => {
  const Cesium = createFakeCesium();
  setIonToken(Cesium);
  assert.equal(Cesium.Ion.defaultAccessToken, '');
  setIonToken(Cesium, 'restricted-token');
  assert.equal(Cesium.Ion.defaultAccessToken, 'restricted-token');
});

test('default base layer is OpenStreetMap imagery with attribution, stopping at zoom 19', () => {
  const Cesium = createFakeCesium();
  const options = buildViewerOptions(Cesium);
  assert.ok(options.baseLayer instanceof Cesium.ImageryLayer);
  const provider = options.baseLayer.imageryProvider;
  assert.ok(provider instanceof Cesium.OpenStreetMapImageryProvider);
  assert.equal(provider.options.url, OSM_TILE_URL);
  assert.equal(OSM_TILE_URL, 'https://tile.openstreetmap.org/');
  assert.equal(provider.options.credit, OSM_CREDIT);
  assert.equal(OSM_MAX_LEVEL, 19, 'the deepest level the OSM tile server has');
  assert.equal(provider.options.maximumLevel, OSM_MAX_LEVEL);
});

test('default terrain is the flat ellipsoid, not ion world terrain', () => {
  const Cesium = createFakeCesium();
  const options = buildViewerOptions(Cesium, {});
  assert.ok(options.terrainProvider instanceof Cesium.EllipsoidTerrainProvider);
  assert.equal(options.terrain, undefined);
});

test('basemap "ion" uses ion world imagery', () => {
  const Cesium = createFakeCesium();
  const options = buildViewerOptions(Cesium, { basemap: 'ion' });
  assert.equal(options.baseLayer.imageryProvider, 'ion-world-imagery');
});

test('a custom basemap uses a URL template provider', () => {
  const Cesium = createFakeCesium();
  const basemap = { url: 'https://tiles.example.org/{z}/{x}/{y}.png', credit: 'Example', maximumLevel: 17 };
  const provider = buildViewerOptions(Cesium, { basemap }).baseLayer.imageryProvider;
  assert.ok(provider instanceof Cesium.UrlTemplateImageryProvider);
  assert.deepEqual(provider.options, basemap);
});

test('terrain "ion" uses ion world terrain instead of the ellipsoid', () => {
  const Cesium = createFakeCesium();
  const options = buildViewerOptions(Cesium, { terrain: 'ion' });
  assert.equal(options.terrain.name, 'ion-world-terrain');
  assert.equal(options.terrainProvider, undefined);
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

test('a rejected ion token falls back to the ellipsoid and OpenStreetMap, with warnings', () => {
  const Cesium = createFakeCesium();
  const options = buildViewerOptions(Cesium, { basemap: 'ion', terrain: 'ion' });
  const viewer = new Cesium.Viewer({}, options);
  const warnings = [];
  fallBackFromIonErrors(Cesium, viewer, options, w => warnings.push(w));

  options.terrain.errorEvent.raise(new Error('401'));
  assert.ok(viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider);

  options.baseLayer.errorEvent.raise(new Error('401'));
  assert.equal(viewer.imageryLayers.list.length, 1);
  assert.ok(viewer.imageryLayers.list[0].imageryProvider instanceof Cesium.OpenStreetMapImageryProvider);

  assert.equal(warnings.length, 2);
  assert.match(warnings.join(' '), /ion terrain failed.*ellipsoid.*ion imagery failed.*OpenStreetMap/);
});

test('ion failure fallbacks do nothing once the viewer is destroyed', () => {
  const Cesium = createFakeCesium();
  const options = buildViewerOptions(Cesium, { basemap: 'ion', terrain: 'ion' });
  const viewer = new Cesium.Viewer({}, options);
  fallBackFromIonErrors(Cesium, viewer, options, () => {});
  viewer.destroy();
  options.terrain.errorEvent.raise(new Error('late'));
  options.baseLayer.errorEvent.raise(new Error('late'));
  assert.equal(viewer.terrainProvider, null);
  assert.equal(viewer.imageryLayers.list[0], options.baseLayer);
});
