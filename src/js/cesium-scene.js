// Turns the WGS84 shapes from utils/topo-geometry.js into Cesium primitives on the globe. Takes
// the Cesium namespace as a parameter: it is loaded from the CDN at runtime, never imported.
//
// Faces use CoplanarPolygonGeometry, which triangulates any planar polygon, vertical walls
// included (PolygonGeometry only handles polygons roughly parallel to the ellipsoid). Edges are
// straight 3D polylines (ArcType.NONE), not geodesics.

import { shapeCoordinates } from './utils/topo-geometry.js';

// Per-kind fill opacity and the cycling fill palette, matching the Three.js TopoFeaturePlugin's
// defaults. The rule engine (stage 4) will let a per-block config override both.
export const PALETTE = [
  '#3388ff', '#ff8833', '#33ff88', '#ff3388', '#8833ff',
  '#33ffff', '#ffff33', '#ff33ff', '#88ff33', '#3388aa',
];
const OPACITY = { solid: 1, face: 1, ring: 1, surface: 0.55, parcel: 0.35 };
const TRANSLUCENT_SOLID_OPACITY = 0.85; // solids/faces with a void or hole, so the interior shows
const TRANSLUCENT_KINDS = new Set(['solid', 'face']);

const EDGE_COLOR = '#ffffff';
const EDGE_WIDTH = 2;
const POINT_COLOR = '#ffff00';
const POINT_PIXEL_SIZE = 8;

const CAMERA_PITCH_DEGREES = -35;
const CAMERA_RANGE_FACTOR = 3.5; // camera distance as a multiple of the data's bounding radius
const MIN_CAMERA_RANGE = 150; // metres, so a single point or tiny feature isn't viewed from 0 m

export function fillOpacity(kind, translucent) {
  if (translucent && TRANSLUCENT_KINDS.has(kind)) return TRANSLUCENT_SOLID_OPACITY;
  return OPACITY[kind] ?? 1;
}

const toCartesian = (Cesium, [lon, lat, height]) => Cesium.Cartesian3.fromDegrees(lon, lat, height);

function polygonHierarchy(Cesium, { outer, holes }) {
  return new Cesium.PolygonHierarchy(
    outer.map(c => toCartesian(Cesium, c)),
    holes.map(hole => new Cesium.PolygonHierarchy(hole.map(c => toCartesian(Cesium, c)))),
  );
}

function fillPrimitive(Cesium, renderable, color) {
  return new Cesium.Primitive({
    geometryInstances: renderable.polygons.map(polygon => new Cesium.GeometryInstance({
      geometry: new Cesium.CoplanarPolygonGeometry({
        polygonHierarchy: polygonHierarchy(Cesium, polygon),
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
      id: renderable.id,
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
    })),
    appearance: new Cesium.PerInstanceColorAppearance({ translucent: color.alpha < 1, closed: false }),
  });
}

function outlinePrimitive(Cesium, segments, id) {
  const color = Cesium.Color.fromCssColorString(EDGE_COLOR);
  return new Cesium.Primitive({
    geometryInstances: segments.map(segment => new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: segment.map(c => toCartesian(Cesium, c)),
        width: EDGE_WIDTH,
        arcType: Cesium.ArcType.NONE,
        vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
      }),
      id,
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
    })),
    appearance: new Cesium.PolylineColorAppearance({ translucent: false }),
  });
}

function pointCollection(Cesium, points) {
  const collection = new Cesium.PointPrimitiveCollection();
  const color = Cesium.Color.fromCssColorString(POINT_COLOR);
  const outlineColor = Cesium.Color.BLACK;
  points.forEach(c => collection.add({
    position: toCartesian(Cesium, c),
    color,
    pixelSize: POINT_PIXEL_SIZE,
    outlineColor,
    outlineWidth: 1,
  }));
  return collection;
}

// Builds (but does not add) every primitive for a set of shapes. Returns
// { records, primitives, positions }: one record per renderable ({ kind, id, fill, outline }),
// the flat list of primitives to add to the scene, and every Cartesian position for framing.
export function buildScenePrimitives(Cesium, shapes) {
  const records = shapes.renderables.map((renderable, index) => {
    const color = Cesium.Color.fromCssColorString(PALETTE[index % PALETTE.length])
      .withAlpha(fillOpacity(renderable.kind, shapes.translucent));
    return {
      kind: renderable.kind,
      id: renderable.id,
      fill: fillPrimitive(Cesium, renderable, color),
      outline: renderable.segments.length ? outlinePrimitive(Cesium, renderable.segments, renderable.id) : null,
    };
  });

  const primitives = records.flatMap(r => [r.fill, r.outline].filter(Boolean));
  if (shapes.edges.length) primitives.push(outlinePrimitive(Cesium, shapes.edges, 'edges'));
  if (shapes.points.length) primitives.push(pointCollection(Cesium, shapes.points));

  const positions = shapeCoordinates(shapes).map(c => toCartesian(Cesium, c));

  return { records, primitives, positions };
}

export function addToScene(viewer, primitives) {
  primitives.forEach(p => viewer.scene.primitives.add(p));
  viewer.scene.requestRender();
}

// Points the camera at the data from the south, looking down at CAMERA_PITCH_DEGREES, then
// releases the look-at lock so the user can pan/orbit freely.
export function frameData(Cesium, viewer, positions) {
  if (!positions.length) return;
  const sphere = Cesium.BoundingSphere.fromPoints(positions);
  const range = Math.max(sphere.radius * CAMERA_RANGE_FACTOR, MIN_CAMERA_RANGE);
  viewer.camera.viewBoundingSphere(
    sphere,
    new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(CAMERA_PITCH_DEGREES), range),
  );
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.scene.requestRender();
}
