import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMaps,
  buildTopologyShapes,
  flattenToFaces,
  getOpenShells,
  ringCoords,
  facePolygon,
  shapeCoordinates,
} from './topo-geometry.js';

const fixture = name => JSON.parse(readFileSync(new URL(`../../../harness/fixtures/${name}`, import.meta.url), 'utf8'));

// ─── Synthetic documents ──────────────────────────────────────────────────────────

const point = (id, coordinates) => ({ id, type: 'Feature', geometry: { type: 'Point', coordinates } });
const edge = (id, start, end) => ({ id, type: 'Feature', geometry: null, topology: { type: 'Edge', references: [start, end] } });
const directed = (type, id, refs) => ({
  id, type: 'Feature', geometry: null,
  topology: { type, directed_references: refs.map(r => (typeof r === 'string' ? { ref: r, orientation: '+' } : r)) },
});
const fc = features => [{ type: 'FeatureCollection', features }];

// A 10 m-ish square near Perth: p1..p4 anticlockwise, edges e1..e4 between them.
const SQUARE_POINTS = [
  point('p1', [115.8, -31.9, 5]),
  point('p2', [115.8001, -31.9, 5]),
  point('p3', [115.8001, -31.8999, 5]),
  point('p4', [115.8, -31.8999, 5]),
];
const SQUARE_EDGES = [edge('e1', 'p1', 'p2'), edge('e2', 'p2', 'p3'), edge('e3', 'p3', 'p4'), edge('e4', 'p4', 'p1')];

function squareDoc(extra = {}) {
  return { points: fc(SQUARE_POINTS), edges: fc(SQUARE_EDGES), ...extra };
}

const coordsOf = id => SQUARE_POINTS.find(p => p.id === id).geometry.coordinates;

// ─── Maps and coordinates ─────────────────────────────────────────────────────────

test('points keep their WGS84 geometry exactly — no re-centring, no projection', () => {
  const { pointMap } = buildMaps(squareDoc());
  assert.deepEqual(pointMap.get('p2'), [115.8001, -31.9, 5]);
});

test('2D points get height 0; place-only points are left out', () => {
  const { pointMap } = buildMaps({
    points: fc([
      point('flat', [115.8, -31.9]),
      { id: 'projected', type: 'Feature', geometry: null, place: { type: 'Point', coordinates: [48136.9, 369943.1, 17.5] } },
    ]),
  });
  assert.deepEqual(pointMap.get('flat'), [115.8, -31.9, 0]);
  assert.equal(pointMap.has('projected'), false);
});

test('subtended-angle edge collections and malformed edges are not topology', () => {
  const { edgeMap } = buildMaps({
    edges: [
      { type: 'FeatureCollection', featureType: 'SubtendedAngle', features: [edge('angle', 'p1', 'p2')] },
      { type: 'FeatureCollection', features: [edge('ok', 'p1', 'p2'), { id: 'bad', type: 'Feature', topology: { references: ['p1'] } }] },
    ],
  });
  assert.deepEqual([...edgeMap.keys()], ['ok']);
});

test('bare-Feature collection entries resolve like wrapped ones', () => {
  const { pointMap } = buildMaps({ points: [point('solo', [115.8, -31.9, 1])] });
  assert.deepEqual(pointMap.get('solo'), [115.8, -31.9, 1]);
});

// ─── Rings and faces ──────────────────────────────────────────────────────────────

test('ring vertices follow edge orientation: + takes the start point, - the end point', () => {
  const maps = buildMaps(squareDoc());
  const forward = directed('Ring', 'r', ['e1', 'e2', 'e3', 'e4']);
  assert.deepEqual(ringCoords(forward, maps), ['p1', 'p2', 'p3', 'p4'].map(coordsOf));

  const reversed = directed('Ring', 'r', [
    { ref: 'e4', orientation: '-' }, { ref: 'e3', orientation: '-' },
    { ref: 'e2', orientation: '-' }, { ref: 'e1', orientation: '-' },
  ]);
  assert.deepEqual(ringCoords(reversed, maps), ['p1', 'p4', 'p3', 'p2'].map(coordsOf));
});

test('a ring with an unresolvable edge or point, or under 3 vertices, is dropped', () => {
  const maps = buildMaps(squareDoc());
  assert.equal(ringCoords(directed('Ring', 'r', ['e1', 'missing', 'e3']), maps), null);
  assert.equal(ringCoords(directed('Ring', 'r', ['e1', 'e2']), maps), null);
});

test("a face's first ring is the outer boundary, the rest are holes", () => {
  const doc = squareDoc({
    points: fc([...SQUARE_POINTS, point('h1', [115.80003, -31.89997, 5]), point('h2', [115.80006, -31.89997, 5]), point('h3', [115.80006, -31.89994, 5])]),
    edges: fc([...SQUARE_EDGES, edge('he1', 'h1', 'h2'), edge('he2', 'h2', 'h3'), edge('he3', 'h3', 'h1')]),
    rings: fc([directed('Ring', 'outer', ['e1', 'e2', 'e3', 'e4']), directed('Ring', 'hole', ['he1', 'he2', 'he3'])]),
  });
  const maps = buildMaps(doc);
  const polygon = facePolygon(directed('Face', 'f', ['outer', 'hole']), maps);
  assert.equal(polygon.outer.length, 4);
  assert.equal(polygon.holes.length, 1);
  assert.equal(polygon.holes[0].length, 3);
});

// ─── Shells and solids ────────────────────────────────────────────────────────────

function nestedShellDoc() {
  return squareDoc({
    rings: fc([directed('Ring', 'r', ['e1', 'e2', 'e3', 'e4'])]),
    faces: fc([directed('Face', 'f1', ['r']), directed('Face', 'f2', ['r'])]),
    shells: fc([
      directed('Shell', 'inner', ['f2']),
      directed('Shell', 'outer', ['f1', 'inner']),
      directed('Shell', 'loopA', ['loopB', 'f1']),
      directed('Shell', 'loopB', ['loopA']),
      directed('Shell', 'open', ['f1']),
    ]),
    solids: fc([directed('Solid', 's', ['outer'])]),
  });
}

test('solids flatten through nested shells to their leaf faces', () => {
  const doc = nestedShellDoc();
  const maps = buildMaps(doc);
  const solid = doc.solids[0].features[0];
  assert.deepEqual(flattenToFaces(solid, maps).map(f => f.id), ['f1', 'f2']);
});

test('shell reference cycles terminate', () => {
  const maps = buildMaps(nestedShellDoc());
  const loopA = maps.shellMap.get('loopA');
  assert.deepEqual(flattenToFaces(loopA, maps).map(f => f.id), ['f1']);
});

test('open shells are those no solid uses, directly or through nesting', () => {
  const doc = nestedShellDoc();
  const open = getOpenShells(doc, buildMaps(doc)).map(s => s.id);
  assert.deepEqual(open, ['loopA', 'loopB', 'open']);
});

// ─── Polygon parcels ──────────────────────────────────────────────────────────────

test('Polygon parcels order an unordered bag of edges into a ring', () => {
  const doc = squareDoc({
    parcels: fc([{ id: 'lot', type: 'Feature', geometry: null, topology: { type: 'Polygon', references: ['e3', 'e1', 'e4', 'e2'] } }]),
  });
  const [parcel] = buildTopologyShapes(doc).renderables;
  assert.equal(parcel.kind, 'parcel');
  assert.equal(parcel.polygons[0].outer.length, 4);
  assert.equal(new Set(parcel.polygons[0].outer.map(String)).size, 4, 'each corner once');
  assert.equal(parcel.segments.length, 4);
});

test('Polygon parcels accept the nested GeoJSON-style ring shape', () => {
  const doc = squareDoc({
    parcels: fc([{ id: 'lot', type: 'Feature', topology: { type: 'Polygon', references: [['e1', 'e2', 'e3', 'e4']] } }]),
  });
  assert.equal(buildTopologyShapes(doc).renderables[0].polygons[0].outer.length, 4);
});

test('non-Polygon parcels (e.g. Solid parcels) produce no parcel fill', () => {
  const doc = squareDoc({
    parcels: fc([{ id: 'vol', type: 'Feature', topology: { type: 'Solid', directed_references: [{ ref: 's', orientation: '+' }] } }]),
  });
  assert.equal(buildTopologyShapes(doc).renderables.length, 0);
});

// ─── Tiering ──────────────────────────────────────────────────────────────────────

test('standalone faces render when there are no solids, open shells or parcels', () => {
  const doc = squareDoc({ rings: fc([directed('Ring', 'r', ['e1', 'e2', 'e3', 'e4'])]), faces: fc([directed('Face', 'f', ['r'])]) });
  const { renderables, edges, points } = buildTopologyShapes(doc);
  assert.deepEqual(renderables.map(r => r.kind), ['face']);
  assert.equal(renderables[0].segments.length, 4);
  assert.deepEqual([edges.length, points.length], [0, 0]);
});

test('standalone rings render when there are no faces', () => {
  const doc = squareDoc({ rings: fc([directed('Ring', 'r', ['e1', 'e2', 'e3', 'e4'])]) });
  assert.deepEqual(buildTopologyShapes(doc).renderables.map(r => r.kind), ['ring']);
});

test('bare edges draw every edge plus the points', () => {
  const { renderables, edges, points } = buildTopologyShapes(squareDoc());
  assert.equal(renderables.length, 0);
  assert.equal(edges.length, 4);
  assert.equal(points.length, 4);
});

test('bare points draw just the points', () => {
  const { renderables, edges, points } = buildTopologyShapes({ points: fc(SQUARE_POINTS) });
  assert.deepEqual([renderables.length, edges.length, points.length], [0, 0, 4]);
});

// ─── Real fixtures ────────────────────────────────────────────────────────────────

function summarise(shapes) {
  const kinds = {};
  shapes.renderables.forEach(r => {
    const k = (kinds[r.kind] ??= { features: 0, polygons: 0, holes: 0, segments: 0 });
    k.features += 1;
    k.polygons += r.polygons.length;
    k.holes += r.polygons.reduce((n, p) => n + p.holes.length, 0);
    k.segments += r.segments.length;
  });
  return kinds;
}

const EXPECTED = {
  'cube.json': { solid: { features: 1, polygons: 6, holes: 0, segments: 12 } },
  'tetrahedron.json': { solid: { features: 1, polygons: 4, holes: 0, segments: 6 } },
  // Outer shell plus an inner void shell: 6 + 6 faces.
  'cube-with-void.json': { solid: { features: 1, polygons: 12, holes: 0, segments: 24 } },
  'cube-with-protrusion.json': { solid: { features: 1, polygons: 11, holes: 1, segments: 24 } },
  '4-unit-up-down.json': { solid: { features: 5, polygons: 47, holes: 0, segments: 108 } },
  'utility-network-georeferenced.json': { solid: { features: 4, polygons: 24, holes: 0, segments: 80 } },
  'parcel.json': {
    solid: { features: 1, polygons: 12, holes: 0, segments: 22 },
    surface: { features: 1, polygons: 2, holes: 0, segments: 5 },
    parcel: { features: 3, polygons: 3, holes: 0, segments: 12 },
  },
  'derived-3d-solid.json': {
    solid: { features: 1, polygons: 12, holes: 0, segments: 22 },
    surface: { features: 1, polygons: 2, holes: 0, segments: 5 },
    parcel: { features: 3, polygons: 3, holes: 0, segments: 12 },
  },
  'georeferenced-square.json': { ring: { features: 1, polygons: 1, holes: 0, segments: 4 } },
};

for (const [name, expected] of Object.entries(EXPECTED)) {
  test(`fixture ${name} assembles the expected features, faces and edges`, () => {
    assert.deepEqual(summarise(buildTopologyShapes(fixture(name))), expected);
  });
}

test('holes and voids make solids translucent', () => {
  assert.equal(buildTopologyShapes(fixture('cube-with-void.json')).translucent, true);
  assert.equal(buildTopologyShapes(fixture('cube-with-protrusion.json')).translucent, true);
  assert.equal(buildTopologyShapes(fixture('cube.json')).translucent, false);
});

test('every drawn coordinate is one of the document\'s own point geometries', () => {
  const doc = fixture('parcel.json');
  const own = new Set(doc.points.flatMap(c => c.features).map(p => String(p.geometry.coordinates)));
  const drawn = shapeCoordinates(buildTopologyShapes(doc));
  assert.ok(drawn.length > 0);
  assert.ok(drawn.every(c => own.has(String(c))));
});

test('a projected-only document produces nothing to draw', () => {
  const shapes = buildTopologyShapes(fixture('projected-only-square.json'));
  assert.equal(shapeCoordinates(shapes).length, 0);
});

test('the georeferenced utility network keeps local metres in place and sits 2–10 m underground', () => {
  const doc = fixture('utility-network-georeferenced.json');
  const points = doc.points.flatMap(c => c.features);
  const heights = points.map(p => p.geometry.coordinates[2]);
  // Within a millimetre: the ellipsoid curves away from the local plane over the 55 m network.
  assert.ok(Math.abs(Math.min(...heights) + 10) < 0.001);
  assert.ok(Math.abs(Math.max(...heights) + 2) < 0.001);
  const origin = points.find(p => p.place.coordinates.every(v => v === 0));
  assert.deepEqual(origin.geometry.coordinates, [115.8605, -31.9535, -10]);
});
