import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE, addToScene, buildScenePrimitives, fillOpacity, frameData } from './cesium-scene.js';
import { buildTopologyShapes } from './utils/topo-geometry.js';
import { createFakeCesium } from './test-support/fake-cesium.js';

const fixture = name => JSON.parse(readFileSync(new URL(`../../harness/fixtures/${name}`, import.meta.url), 'utf8'));
const shapesOf = name => buildTopologyShapes(fixture(name));

test('each renderable gets a fill primitive with one coplanar polygon per face', () => {
  const Cesium = createFakeCesium();
  const { records } = buildScenePrimitives(Cesium, shapesOf('cube.json'));
  assert.equal(records.length, 1);
  const instances = records[0].fill.options.geometryInstances;
  assert.equal(instances.length, 6);
  assert.ok(instances.every(i => i.options.geometry instanceof Cesium.CoplanarPolygonGeometry));
  assert.ok(instances.every(i => i.options.id === records[0].id), 'instances carry the feature id for picking');
});

test('polygon positions are the WGS84 coordinates, holes included', () => {
  const Cesium = createFakeCesium();
  const shapes = shapesOf('cube-with-protrusion.json');
  const { records } = buildScenePrimitives(Cesium, shapes);
  const hierarchies = records[0].fill.options.geometryInstances.map(i => i.options.geometry.options.polygonHierarchy);
  const withHole = hierarchies.find(h => h.holes.length);
  assert.ok(withHole, 'the face with a hole keeps it');

  const [lon, lat, height] = shapes.renderables[0].polygons[0].outer[0];
  assert.deepEqual(hierarchies[0].positions[0], { lon, lat, height });
});

test('outlines are straight polylines, one per unique edge', () => {
  const Cesium = createFakeCesium();
  const { records } = buildScenePrimitives(Cesium, shapesOf('tetrahedron.json'));
  const segments = records[0].outline.options.geometryInstances;
  assert.equal(segments.length, 6);
  assert.ok(segments.every(s => s.options.geometry.options.arcType === Cesium.ArcType.NONE));
  assert.ok(segments.every(s => s.options.geometry.options.positions.length === 2));
});

test('fills cycle through the palette with per-kind opacity', () => {
  const Cesium = createFakeCesium();
  const { records } = buildScenePrimitives(Cesium, shapesOf('parcel.json'));
  const colors = records.map(r => r.fill.options.geometryInstances[0].options.attributes.color.color);
  assert.deepEqual(records.map(r => r.kind), ['solid', 'surface', 'parcel', 'parcel', 'parcel']);
  assert.deepEqual(colors.map(c => c.css), PALETTE.slice(0, 5));
  assert.deepEqual(colors.map(c => c.alpha), [1, 0.55, 0.35, 0.35, 0.35]);
  assert.equal(records[0].fill.options.appearance.options.translucent, false);
  assert.equal(records[1].fill.options.appearance.options.translucent, true);
});

test('solids with voids are drawn translucent', () => {
  assert.equal(fillOpacity('solid', true), 0.85);
  assert.equal(fillOpacity('solid', false), 1);
  assert.equal(fillOpacity('surface', true), 0.55, 'surfaces keep their own opacity');
});

test('bare edges and points get an edge primitive and a point collection', () => {
  const Cesium = createFakeCesium();
  const shapes = { renderables: [], edges: [[[115.8, -31.9, 0], [115.81, -31.9, 0]]], points: [[115.8, -31.9, 0], [115.81, -31.9, 0]], translucent: false };
  const { records, primitives, positions } = buildScenePrimitives(Cesium, shapes);
  assert.equal(records.length, 0);
  assert.equal(primitives.length, 2);
  assert.equal(primitives[1].points.length, 2);
  assert.equal(positions.length, 4);
});

test('addToScene adds every primitive and requests a render', () => {
  const Cesium = createFakeCesium();
  const viewer = new Cesium.Viewer({}, {});
  const { primitives } = buildScenePrimitives(Cesium, shapesOf('parcel.json'));
  addToScene(viewer, primitives);
  assert.equal(viewer.scene.primitives.list.length, primitives.length);
  assert.ok(viewer.scene.renderRequests > 0);
});

test('frameData views the data then releases the camera', () => {
  const Cesium = createFakeCesium();
  const viewer = new Cesium.Viewer({}, {});
  const { positions } = buildScenePrimitives(Cesium, shapesOf('cube.json'));
  frameData(Cesium, viewer, positions);
  const [[call, sphere, offset], [release, transform]] = viewer.camera.calls;
  assert.equal(call, 'viewBoundingSphere');
  assert.equal(sphere.points.length, positions.length);
  assert.ok(offset.pitch < 0, 'looking down');
  assert.ok(offset.range >= 150, 'never closer than the minimum range');
  assert.deepEqual([release, transform], ['lookAtTransform', Cesium.Matrix4.IDENTITY]);
});

test('frameData leaves the camera alone when there is nothing to frame', () => {
  const Cesium = createFakeCesium();
  const viewer = new Cesium.Viewer({}, {});
  frameData(Cesium, viewer, []);
  assert.equal(viewer.camera.calls.length, 0);
});
