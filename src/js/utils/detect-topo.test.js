import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGeographicPoint,
  isGeoreferencedTopoFeature,
  isTopoFeatureMultiCollection,
} from './detect-topo.js';

const point = (id, coordinates) => ({ id, type: 'Feature', geometry: { type: 'Point', coordinates } });

test('isGeographicPoint accepts lon/lat with and without height', () => {
  assert.equal(isGeographicPoint({ type: 'Point', coordinates: [115.8, -31.9] }), true);
  assert.equal(isGeographicPoint({ type: 'Point', coordinates: [115.8, -31.9, 17.5] }), true);
});

test('isGeographicPoint rejects out-of-range, non-numeric and non-Point geometry', () => {
  assert.equal(isGeographicPoint({ type: 'Point', coordinates: [48136.9, 369943.1, 17.5] }), false);
  assert.equal(isGeographicPoint({ type: 'Point', coordinates: [115.8, -91] }), false);
  assert.equal(isGeographicPoint({ type: 'Point', coordinates: ['115.8', -31.9] }), false);
  assert.equal(isGeographicPoint({ type: 'Point', coordinates: [115.8, -31.9, null] }), false);
  assert.equal(isGeographicPoint({ type: 'LineString', coordinates: [[0, 0], [1, 1]] }), false);
  assert.equal(isGeographicPoint(null), false);
});

test('isTopoFeatureMultiCollection accepts wrapped and bare-feature entries', () => {
  assert.equal(isTopoFeatureMultiCollection({ points: [{ features: [] }] }), true);
  assert.equal(isTopoFeatureMultiCollection({ edges: [{ type: 'Feature' }] }), true);
  assert.equal(isTopoFeatureMultiCollection({ type: 'FeatureCollection', features: [] }), false);
  assert.equal(isTopoFeatureMultiCollection([]), false);
});

test('isGeoreferencedTopoFeature needs at least one WGS84 point geometry', () => {
  assert.equal(isGeoreferencedTopoFeature({ points: [{ features: [point('a', [115.8, -31.9, 0])] }] }), true);
  assert.equal(isGeoreferencedTopoFeature({ points: [point('a', [115.8, -31.9])] }), true);
});

test('isGeoreferencedTopoFeature ignores projected `place` coordinates', () => {
  const projectedOnly = {
    points: [{
      features: [{
        id: 'a', type: 'Feature', geometry: null,
        place: { type: 'Point', coordinates: [48136.9, 369943.1, 17.5] },
      }],
    }],
  };
  assert.equal(isGeoreferencedTopoFeature(projectedOnly), false);
});

test('isGeoreferencedTopoFeature rejects documents without points', () => {
  assert.equal(isGeoreferencedTopoFeature({ edges: [{ features: [{ type: 'Feature', geometry: null }] }] }), false);
});
