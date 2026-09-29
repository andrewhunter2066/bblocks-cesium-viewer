// Resolves a topo-feature document's topology references (points → edges → rings → faces →
// shells → solids, plus Polygon-topology parcels) into plain WGS84 coordinate structures:
// polygons ({ outer, holes }) and line segments ([start, end]), each coordinate
// [lon, lat, height]. No Cesium dependency — cesium-scene.js turns the result into primitives.
//
// The traversal logic (shell nesting, open shells, Polygon parcels) is adapted from
// ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/topo-geometry.js and
// TopoFeaturePlugin._buildScene(). Which features are drawn, and how, comes from the rule
// engine (rules.js, default-config.js — copied unchanged). Differences: coordinates come
// only from each point's WGS84 `geometry` (never `place`) and are not re-centred, and nothing is
// triangulated here (Cesium triangulates each planar polygon itself).

import { collectionFeatures, isGeographicPoint } from './detect-topo.js';
import { classifyFeatures, resolveFlattenZ } from './rules.js';
import { buildDefaultConfig } from './default-config.js';

const REVERSED_ORIENTATION = '-';
const FACE_TOPOLOGY_TYPE = 'Face';
const SHELL_TOPOLOGY_TYPE = 'Shell';
const SUBTENDED_ANGLE_FEATURE_TYPE = 'SubtendedAngle';
const MAX_SHELL_NESTING_DEPTH = 16;

export function getFeatures(featureCollections = []) {
  return (Array.isArray(featureCollections) ? featureCollections : []).flatMap(collectionFeatures);
}

// Vector observation / subtended-angle edge collections describe survey angles, not topology.
function edgeFeatureCollections(edgeCollections = []) {
  return (Array.isArray(edgeCollections) ? edgeCollections : [])
    .filter(fc => fc?.featureType !== SUBTENDED_ANGLE_FEATURE_TYPE);
}

function mapFeaturesById(featureCollections, getValue = f => f) {
  const map = new Map();
  getFeatures(featureCollections).forEach(f => {
    if (f?.id == null) return;
    const value = getValue(f);
    if (value != null) map.set(f.id, value);
  });
  return map;
}

// pointMap holds only points with a usable WGS84 `geometry`; a 2D point gets height 0. Anything
// referencing a point missing from it (e.g. a `place`-only point) is skipped downstream.
export function buildMaps(data) {
  return {
    pointMap: mapFeaturesById(data?.points, f => {
      if (!isGeographicPoint(f.geometry)) return null;
      const [lon, lat, height = 0] = f.geometry.coordinates;
      return [lon, lat, height];
    }),
    edgeMap: mapFeaturesById(edgeFeatureCollections(data?.edges), f => {
      const refs = f.topology?.references;
      return Array.isArray(refs) && refs.length === 2 ? refs : null;
    }),
    ringMap: mapFeaturesById(data?.rings),
    faceMap: mapFeaturesById(data?.faces),
    shellMap: mapFeaturesById(data?.shells),
  };
}

function directedReferences(feature) {
  const refs = feature?.topology?.directed_references;
  return Array.isArray(refs) ? refs : [];
}

function edgeEndpoints(edgeId, maps) {
  const pts = maps.edgeMap.get(edgeId);
  if (!pts) return null;
  const start = maps.pointMap.get(pts[0]);
  const end = maps.pointMap.get(pts[1]);
  return start && end ? [start, end] : null;
}

// ─── Rings, faces, outlines ─────────────────────────────────────────────────────

// A ring's vertices in order: each directed edge contributes its start point ('+') or its end
// point ('-'), so the ring closes implicitly. Null if any edge or point is unresolvable.
export function ringCoords(ring, maps) {
  const coords = [];
  for (const member of directedReferences(ring)) {
    const pts = maps.edgeMap.get(member.ref);
    const coord = pts && maps.pointMap.get(pts[member.orientation === REVERSED_ORIENTATION ? 1 : 0]);
    if (!coord) return null;
    coords.push(coord);
  }
  return coords.length >= 3 ? coords : null;
}

// A Face's first ring is its outer boundary; any further rings are holes.
export function facePolygon(face, maps) {
  const [outerRef, ...holeRefs] = directedReferences(face);
  const outer = ringCoords(maps.ringMap.get(outerRef?.ref), maps);
  if (!outer) return null;
  const holes = holeRefs.map(r => ringCoords(maps.ringMap.get(r.ref), maps)).filter(Boolean);
  return { outer, holes };
}

export function ringPolygon(ring, maps) {
  const outer = ringCoords(ring, maps);
  return outer ? { outer, holes: [] } : null;
}

function segmentsForEdgeIds(edgeIds, maps) {
  return [...edgeIds].map(id => edgeEndpoints(id, maps)).filter(Boolean);
}

function ringEdgeIds(ring) {
  return directedReferences(ring).map(r => r.ref);
}

function faceEdgeIds(face, maps) {
  return directedReferences(face).flatMap(r => ringEdgeIds(maps.ringMap.get(r.ref)));
}

// ─── Solids and shells ──────────────────────────────────────────────────────────

// Faces and shells share one ID space, so a directed_reference carries no hint of its target's
// kind. Faces are looked up first; `topology.type` guards an ID present in both maps.
function resolveBoundaryReference(ref, maps) {
  const face = maps.faceMap.get(ref);
  if (face && face.topology?.type !== SHELL_TOPOLOGY_TYPE) return { kind: FACE_TOPOLOGY_TYPE, feature: face };
  const shell = maps.shellMap.get(ref);
  if (shell) return { kind: SHELL_TOPOLOGY_TYPE, feature: shell };
  return null;
}

// Flattens a solid or shell boundary into its leaf faces, descending through nested shells
// (e.g. an offset-derived solid whose shell references upper/lower offset shells). The cycle
// guard is per path, so a shell referenced from two separate branches is expanded in both; the
// starting container counts as visited, so a cycle back to it isn't expanded a second time.
export function flattenToFaces(container, maps, visitedShellIds = new Set([container?.id]), depth = 0) {
  if (depth > MAX_SHELL_NESTING_DEPTH) return [];
  return directedReferences(container).flatMap(ref => {
    const resolved = resolveBoundaryReference(ref.ref, maps);
    if (!resolved) return [];
    if (resolved.kind === FACE_TOPOLOGY_TYPE) return [resolved.feature];
    if (visitedShellIds.has(ref.ref)) return [];
    return flattenToFaces(resolved.feature, maps, new Set(visitedShellIds).add(ref.ref), depth + 1);
  });
}

// Every shell that bounds a solid, directly or through a nested shell.
function collectSolidShellIds(solids, maps) {
  const ids = new Set();
  const visit = (container, depth) => {
    if (depth > MAX_SHELL_NESTING_DEPTH) return;
    directedReferences(container).forEach(ref => {
      const resolved = resolveBoundaryReference(ref.ref, maps);
      if (resolved?.kind !== SHELL_TOPOLOGY_TYPE || ids.has(ref.ref)) return;
      ids.add(ref.ref);
      visit(resolved.feature, depth + 1);
    });
  };
  solids.forEach(solid => visit(solid, 0));
  return ids;
}

// Shells no solid uses as part of its boundary. A solid already draws its own shells' faces, so
// only these open shells describe a surface not otherwise visible.
export function getOpenShells(data, maps) {
  const solidShellIds = collectSolidShellIds(getFeatures(data?.solids), maps);
  return getFeatures(data?.shells).filter(shell => !solidShellIds.has(shell.id));
}

function containerShape(container, maps) {
  const faces = flattenToFaces(container, maps);
  const edgeIds = new Set(faces.flatMap(face => faceEdgeIds(face, maps)));
  return {
    polygons: faces.map(face => facePolygon(face, maps)).filter(Boolean),
    segments: segmentsForEdgeIds(edgeIds, maps),
  };
}

// ─── Polygon-topology parcels ───────────────────────────────────────────────────
//
// A cadastral "Polygon" parcel lists its boundary as `topology.references`: an unordered bag of
// edge ids per ring, with no orientation. The edges are walked as an adjacency graph to recover
// an ordered ring. Other parcel topology types (Solid, AggregatePolygon, …) have no references
// of this shape and resolve to nothing here.

function resolvePolygonRing(edgeRefs, maps) {
  const adjacency = new Map();
  let startPointId = null;
  const addNeighbor = (pointId, neighborId) => {
    if (!adjacency.has(pointId)) adjacency.set(pointId, new Set());
    adjacency.get(pointId).add(neighborId);
  };
  edgeRefs.forEach(edgeRef => {
    const pts = maps.edgeMap.get(edgeRef);
    if (!pts || !maps.pointMap.has(pts[0]) || !maps.pointMap.has(pts[1])) return;
    if (startPointId == null) startPointId = pts[0];
    addNeighbor(pts[0], pts[1]);
    addNeighbor(pts[1], pts[0]);
  });
  if (startPointId == null) return [];

  const ids = [startPointId];
  const visited = new Set(ids);
  let previousId = null;
  let currentId = startPointId;
  for (let step = 0; step < adjacency.size + 1; step++) {
    const neighbors = [...(adjacency.get(currentId) ?? [])];
    const nextId = neighbors.find(id => id !== previousId) ?? neighbors[0];
    if (nextId == null || (nextId === startPointId && ids.length > 2)) break;
    if (visited.has(nextId)) break;
    ids.push(nextId);
    visited.add(nextId);
    previousId = currentId;
    currentId = nextId;
  }
  return ids.map(id => maps.pointMap.get(id));
}

// Accepts both the flat legacy shape (["e1", "e2", …], one outer boundary) and the GeoJSON
// Polygon shape ([["e1", …], ["hole-e1", …]]).
function polygonRingEdgeRefs(feature) {
  const references = feature?.topology?.references;
  if (!Array.isArray(references) || !references.length) return [];
  return Array.isArray(references[0]) ? references : [references];
}

function polygonShape(feature, maps) {
  const rings = polygonRingEdgeRefs(feature)
    .map(edgeRefs => resolvePolygonRing(edgeRefs, maps))
    .filter(coords => coords.length >= 3);
  if (!rings.length) return { polygons: [], segments: [] };
  const [outer, ...holes] = rings;
  return {
    polygons: [{ outer, holes }],
    segments: segmentsForEdgeIds(new Set(polygonRingEdgeRefs(feature).flat()), maps),
  };
}

// ─── Geometry strategies ────────────────────────────────────────────────────────
//
// One entry per way of turning a feature into a shape, keyed by the rule engine's `geometry`
// names. Each returns { polygons, segments }.
export const GEOMETRY_STRATEGIES = {
  solid: containerShape,
  'open-shell': containerShape,
  polygon: polygonShape,
  face: (feature, maps) => ({
    polygons: [facePolygon(feature, maps)].filter(Boolean),
    segments: segmentsForEdgeIds(new Set(faceEdgeIds(feature, maps)), maps),
  }),
  ring: (feature, maps) => ({
    polygons: [ringPolygon(feature, maps)].filter(Boolean),
    segments: segmentsForEdgeIds(new Set(ringEdgeIds(feature)), maps),
  }),
};

// True if any face has a hole or any solid has a void — the default rules then make solids/faces
// translucent so the interior stays visible.
export function hasHolesOrVoids(data) {
  return getFeatures(data?.faces).some(face => directedReferences(face).length > 1)
    || getFeatures(data?.solids).some(solid => directedReferences(solid).length > 1);
}

// ─── Default rules ──────────────────────────────────────────────────────────────

// Per-kind fill opacity for the built-in rules, matching the Three.js TopoFeaturePlugin.
export const DEFAULT_OPACITY = { solid: 1, face: 1, ring: 1, surface: 0.55, parcel: 0.35 };
const TRANSLUCENT_OPACITY = 0.85; // solids/faces when the document has a hole or void

// The built-in rule config for a document (default-config.js): solids, open shells ("surfaces")
// and Polygon parcels together whenever any is present; otherwise faces, else rings. A document
// with none of those gets no rules and is drawn as bare edges or points.
export function defaultConfigFor(data) {
  const maps = buildMaps(data);
  const solidOrFace = hasHolesOrVoids(data) ? TRANSLUCENT_OPACITY : DEFAULT_OPACITY.solid;
  return buildDefaultConfig(
    {
      solidCount: getFeatures(data?.solids).length,
      openShellCount: getOpenShells(data, maps).length,
      parcelCount: getFeatures(data?.parcels).length,
      faceCount: getFeatures(data?.faces).length,
      ringCount: getFeatures(data?.rings).length,
    },
    { ...DEFAULT_OPACITY, solid: solidOrFace, face: solidOrFace },
  );
}

// ─── Elevation ──────────────────────────────────────────────────────────────────

const COORD_KEY_DIGITS = 9; // ~0.1 mm in degrees
const MIN_FLAT_AREA_M2 = 1e-3;
const METRES_PER_DEGREE_LAT = 110574;
const METRES_PER_DEGREE_LON_AT_EQUATOR = 111320;

const lonLatKey = ([lon, lat]) => `${lon.toFixed(COORD_KEY_DIGITS)},${lat.toFixed(COORD_KEY_DIGITS)}`;

// Plan area of a ring in square metres (shoelace on a local equirectangular approximation) —
// only used to spot rings that collapse to a line once flattened.
function planAreaM2(ring) {
  const lonScale = METRES_PER_DEGREE_LON_AT_EQUATOR * Math.cos((ring[0][1] * Math.PI) / 180);
  let twiceArea = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    twiceArea += (x1 * lonScale) * (y2 * METRES_PER_DEGREE_LAT) - (x2 * lonScale) * (y1 * METRES_PER_DEGREE_LAT);
  }
  return Math.abs(twiceArea) / 2;
}

// Applies a rule's `elevation` to a shape: "preserve" (default) leaves it alone; "flatten" clamps
// it to the ground; { flattenTo: n } puts it n metres above the ellipsoid. Flattening a solid
// turns its walls into lines and stacks its top and bottom faces on one footprint, so polygons
// with no plan area and duplicate polygons/segments are dropped rather than drawn on top of one
// another. Returns { polygons, segments, clampToGround }.
export function applyElevation(shape, elevation) {
  const height = resolveFlattenZ(elevation);
  if (height === null) return { ...shape, clampToGround: false };

  const flatten = coords => coords.map(([lon, lat]) => [lon, lat, height]);
  const seenPolygons = new Set();
  const polygons = shape.polygons
    .map(p => ({ outer: flatten(p.outer), holes: p.holes.map(flatten) }))
    .filter(p => {
      if (planAreaM2(p.outer) < MIN_FLAT_AREA_M2) return false;
      const key = p.outer.map(lonLatKey).sort().join(';');
      if (seenPolygons.has(key)) return false;
      seenPolygons.add(key);
      return true;
    })
    .map(p => ({ ...p, holes: p.holes.filter(h => planAreaM2(h) >= MIN_FLAT_AREA_M2) }));

  const seenSegments = new Set();
  const segments = shape.segments.map(flatten).filter(([a, b]) => {
    const keys = [lonLatKey(a), lonLatKey(b)];
    if (keys[0] === keys[1]) return false;
    const key = keys.sort().join('|');
    if (seenSegments.has(key)) return false;
    seenSegments.add(key);
    return true;
  });

  return { polygons, segments, clampToGround: elevation === 'flatten' };
}

// ─── Whole document ─────────────────────────────────────────────────────────────

// Resolves a whole document into what the globe draws, following `config`'s rules (rules.js):
// - renderables: one per classified feature that has something to fill —
//   { kind, group, kindLabel, label, id, feature, style, visible, clampToGround, polygons, segments }
// - edges / points: every resolvable edge and point, only when the config has no rules at all
//   (the bare-edges / bare-points documents)
export function buildTopologyShapes(data, config = defaultConfigFor(data)) {
  const maps = buildMaps(data);
  const rules = config?.rules ?? [];
  const renderables = [];

  if (rules.length) {
    // `surfaces` is a derived source: open shells come from the solid/shell reference graph, not
    // from a document array. A document's own top-level `surfaces` array would be shadowed.
    const descriptors = classifyFeatures({ ...data, surfaces: getOpenShells(data, maps) }, config);
    for (const descriptor of descriptors) {
      const strategy = GEOMETRY_STRATEGIES[descriptor.geometry];
      if (!strategy) continue;
      const shape = applyElevation(strategy(descriptor.feature, maps), descriptor.elevation);
      if (!shape.polygons.length) continue;
      renderables.push({
        kind: descriptor.kind,
        group: descriptor.group,
        kindLabel: descriptor.kindLabel,
        label: descriptor.label,
        id: descriptor.feature.id ?? null,
        feature: descriptor.feature,
        style: descriptor.style,
        visible: descriptor.initiallyVisible,
        ...shape,
      });
    }
  }

  const bare = rules.length === 0;
  return {
    renderables,
    edges: bare ? segmentsForEdgeIds(maps.edgeMap.keys(), maps) : [],
    points: bare ? [...maps.pointMap.values()] : [],
  };
}

// Every coordinate the shapes use, for framing the camera.
export function shapeCoordinates({ renderables, edges, points }) {
  return [
    ...renderables.flatMap(r => [
      ...r.polygons.flatMap(p => [p.outer, ...p.holes].flat()),
      ...r.segments.flat(),
    ]),
    ...edges.flat(),
    ...points,
  ];
}
