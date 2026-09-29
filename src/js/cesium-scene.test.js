import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE, addToScene, buildScenePrimitives, fillColor, frameData, setCameraView } from './cesium-scene.js';
import { buildTopologyShapes } from './utils/topo-geometry.js';
import { createFakeCesium } from './test-support/fake-cesium.js';

const fixture = name => JSON.parse(readFileSync(new URL(`../../harness/fixtures/${name}`, import.meta.url), 'utf8'));
const shapesOf = (name, config) => buildTopologyShapes(fixture(name), config);

// A one-solid document's shapes, restyled by a single rule.
function cubeWithRule(rule) {
  return shapesOf('cube.json', { rules: [{ source: 'solids', kind: 'solid', geometry: 'solid', ...rule }] });
}

test('each renderable gets a fill primitive with one coplanar polygon per face', () => {
  const Cesium = createFakeCesium();
  const { records } = buildScenePrimitives(Cesium, shapesOf('cube.json'));
  assert.equal(records.length, 1);
  const instances = records[0].fill.options.geometryInstances;
  assert.equal(instances.length, 6);
  assert.ok(records[0].fill instanceof Cesium.Primitive);
  assert.ok(instances.every(i => i.options.geometry instanceof Cesium.CoplanarPolygonGeometry));
  assert.ok(instances.every(i => i.options.id === records[0].id), 'instances carry the feature id for picking');
});

test('polygon positions are the WGS84 coordinates, holes included', () => {
  const Cesium = createFakeCesium();
  const shapes = shapesOf('cube-with-protrusion.json');
  const { records } = buildScenePrimitives(Cesium, shapes);
  const hierarchies = records[0].fill.options.geometryInstances.map(i => i.options.geometry.options.polygonHierarchy);
  assert.ok(hierarchies.some(h => h.holes.length), 'the face with a hole keeps it');
  const [lon, lat, height] = shapes.renderables[0].polygons[0].outer[0];
  assert.deepEqual(hierarchies[0].positions[0], { lon, lat, height });
});

test('outlines are straight white polylines, one per unique edge', () => {
  const Cesium = createFakeCesium();
  const { records } = buildScenePrimitives(Cesium, shapesOf('tetrahedron.json'));
  const segments = records[0].outline.options.geometryInstances;
  assert.equal(segments.length, 6);
  assert.ok(segments.every(s => s.options.geometry.options.arcType === Cesium.ArcType.NONE));
  assert.ok(segments.every(s => s.options.geometry.options.positions.length === 2));
  assert.deepEqual(records[0].outline.options.appearance.options.material, { type: 'Color', uniforms: { color: Cesium.Color.fromCssColorString('#ffffff') } });
});

test('default rules: fills cycle through the palette with per-kind opacity', () => {
  const Cesium = createFakeCesium();
  const { records } = buildScenePrimitives(Cesium, shapesOf('parcel.json'));
  const colors = records.map(r => r.fill.options.geometryInstances[0].options.attributes.color.color);
  assert.deepEqual(records.map(r => r.kind), ['solid', 'surface', 'parcel', 'parcel', 'parcel']);
  assert.deepEqual(colors.map(c => c.css), PALETTE.slice(0, 5));
  assert.deepEqual(colors.map(c => c.alpha), [1, 0.55, 0.35, 0.35, 0.35]);
  assert.equal(records[0].fill.options.appearance.options.translucent, false);
  assert.equal(records[1].fill.options.appearance.options.translucent, true);
});

test('a rule style sets fill colour, opacity, line colour and dashes', () => {
  const Cesium = createFakeCesium();
  const shapes = cubeWithRule({ style: { color: '#a1531a', opacity: 0.4, lineColor: '#06102b', lineStyle: 'dashed' } });
  const [record] = buildScenePrimitives(Cesium, shapes).records;
  const fill = record.fill.options.geometryInstances[0].options.attributes.color.color;
  assert.deepEqual([fill.css, fill.alpha], ['#a1531a', 0.4]);
  const { material } = record.outline.options.appearance.options;
  assert.equal(material.type, 'PolylineDash');
  assert.equal(material.uniforms.color.css, '#06102b');
});

test('an unparseable colour falls back to the palette; opacity is clamped to 0..1', () => {
  const Cesium = createFakeCesium();
  assert.equal(fillColor(Cesium, { color: 'notacolour' }, 2).css, PALETTE[2]);
  assert.equal(fillColor(Cesium, { opacity: 7 }, 0).alpha, 1);
  assert.equal(fillColor(Cesium, { opacity: -1 }, 0).alpha, 0);
  assert.equal(fillColor(Cesium, undefined, 0).alpha, 1);
});

test('initiallyVisible: false hides both fill and outline', () => {
  const Cesium = createFakeCesium();
  const [record] = buildScenePrimitives(Cesium, cubeWithRule({ initiallyVisible: false })).records;
  assert.equal(record.visible, false);
  assert.equal(record.fill.options.show, false);
  assert.equal(record.outline.options.show, false);
});

test('elevation "flatten" clamps fill and outline to the ground', () => {
  const Cesium = createFakeCesium();
  const [record] = buildScenePrimitives(Cesium, cubeWithRule({ elevation: 'flatten' })).records;
  assert.ok(record.fill instanceof Cesium.GroundPrimitive);
  assert.ok(record.fill.options.geometryInstances.every(i => i.options.geometry instanceof Cesium.PolygonGeometry));
  assert.equal(record.fill.options.geometryInstances.length, 1, 'top and bottom collapse onto one footprint');
  assert.ok(record.outline instanceof Cesium.GroundPolylinePrimitive);
  assert.equal(record.outline.options.geometryInstances.length, 4, 'walls collapse; the footprint keeps 4 edges');
});

test('elevation { flattenTo } keeps normal primitives at that height', () => {
  const Cesium = createFakeCesium();
  const [record] = buildScenePrimitives(Cesium, cubeWithRule({ elevation: { flattenTo: 42 } })).records;
  assert.ok(record.fill instanceof Cesium.Primitive);
  const positions = record.fill.options.geometryInstances[0].options.geometry.options.polygonHierarchy.positions;
  assert.ok(positions.every(p => p.height === 42));
});

test('records carry the rule-derived kind, group, kindLabel and label', () => {
  const Cesium = createFakeCesium();
  const shapes = cubeWithRule({ kind: 'building', group: 'structures', kindLabel: 'Building', label: { properties: ['properties.nope'], fallback: 'id' } });
  const [record] = buildScenePrimitives(Cesium, shapes).records;
  assert.deepEqual(
    [record.kind, record.group, record.kindLabel, record.label],
    ['building', 'structures', 'Building', shapes.renderables[0].id],
  );
});

test('bare edges and points get an edge primitive and a point collection', () => {
  const Cesium = createFakeCesium();
  const shapes = { renderables: [], edges: [[[115.8, -31.9, 0], [115.81, -31.9, 0]]], points: [[115.8, -31.9, 0], [115.81, -31.9, 0]] };
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

test('setCameraView converts the configured view to Cesium units', () => {
  const Cesium = createFakeCesium();
  const viewer = new Cesium.Viewer({}, {});
  setCameraView(Cesium, viewer, { longitude: 115.8, latitude: -31.9, height: 300, heading: 90, pitch: -45, roll: 0 });
  const [[call, view]] = viewer.camera.calls;
  assert.equal(call, 'setView');
  assert.deepEqual(view.destination, { lon: 115.8, lat: -31.9, height: 300 });
  assert.equal(view.orientation.heading, Math.PI / 2);
  assert.equal(view.orientation.pitch, -Math.PI / 4);
});
