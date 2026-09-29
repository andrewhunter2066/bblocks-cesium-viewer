import { test } from 'node:test';
import assert from 'node:assert/strict';
import TopoFeatureCesiumPlugin from './topo-feature-cesium-plugin.js';
import { TopoFeatureCesiumPlugin as NamedExport } from './index.js';

const georeferenced = JSON.stringify({
  points: [{
    type: 'FeatureCollection',
    features: [{ id: 'a', type: 'Feature', geometry: { type: 'Point', coordinates: [115.8, -31.9, 17.5] } }],
  }],
});

const candidate = (overrides = {}) => ({
  type: 'application/json', content: georeferenced, url: null, label: 'JSON', ...overrides,
});

test('index.js exports the plugin class by name', () => {
  assert.equal(NamedExport, TopoFeatureCesiumPlugin);
});

test('static plugin contract', () => {
  assert.ok(TopoFeatureCesiumPlugin.supportedTypes.length > 0);
  assert.ok(TopoFeatureCesiumPlugin.supportedTypes.includes('application/json'));
  assert.equal(TopoFeatureCesiumPlugin.viewName, 'Globe');
  assert.equal(typeof TopoFeatureCesiumPlugin.icon, 'string');
});

test('constructor tolerates empty and null-content candidates', () => {
  assert.equal(new TopoFeatureCesiumPlugin([]).matches(), false);
  assert.equal(new TopoFeatureCesiumPlugin([candidate({ content: null })]).matches(), false);
  assert.equal(new TopoFeatureCesiumPlugin(undefined, undefined).matches(), false);
});

test('matches a georeferenced topo-feature document', () => {
  assert.equal(new TopoFeatureCesiumPlugin([candidate()]).matches(), true);
});

test('picks the first usable candidate among several representations', () => {
  const plugin = new TopoFeatureCesiumPlugin([
    candidate({ type: 'text/turtle', content: '@prefix x: <y> .', label: 'Turtle' }),
    candidate({ content: '{not json', label: 'broken' }),
    candidate({ type: 'application/ld+json', label: 'JSON-LD' }),
  ]);
  assert.equal(plugin.matches(), true);
  assert.equal(plugin._pickCandidate().label, 'JSON-LD');
});

test('does not match plain GeoJSON or ungeoreferenced topology', () => {
  const geojson = JSON.stringify({ type: 'Feature', geometry: { type: 'Point', coordinates: [115.8, -31.9] } });
  const projected = JSON.stringify({
    points: [{ features: [{ id: 'a', type: 'Feature', geometry: null, place: { type: 'Point', coordinates: [48136.9, 369943.1] } }] }],
  });
  assert.equal(new TopoFeatureCesiumPlugin([candidate({ content: geojson })]).matches(), false);
  assert.equal(new TopoFeatureCesiumPlugin([candidate({ content: projected })]).matches(), false);
});
