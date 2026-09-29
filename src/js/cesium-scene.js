// Turns the WGS84 shapes from utils/topo-geometry.js into Cesium primitives on the globe. Takes
// the Cesium namespace as a parameter: it is loaded from the CDN at runtime, never imported.
//
// Faces use CoplanarPolygonGeometry, which triangulates any planar polygon, vertical walls
// included (PolygonGeometry only handles polygons roughly parallel to the ellipsoid). Edges are
// straight 3D polylines (ArcType.NONE), not geodesics. A rule with `elevation: "flatten"` clamps
// its feature to the ground instead: GroundPrimitive / GroundPolylinePrimitive drape it over
// whatever terrain is loaded.

import { shapeCoordinates } from './utils/topo-geometry.js';

// Fill colour for a feature whose rule sets no `style.color`, cycling by draw order — the
// Three.js TopoFeaturePlugin's palette.
export const PALETTE = [
  '#3388ff', '#ff8833', '#33ff88', '#ff3388', '#8833ff',
  '#33ffff', '#ffff33', '#ff33ff', '#88ff33', '#3388aa',
];

const DEFAULT_LINE_COLOR = '#ffffff';
const LINE_WIDTH = 2;
const DASH_LENGTH = 16; // pixels
const POINT_COLOR = '#ffff00';
const POINT_PIXEL_SIZE = 8;

const CAMERA_PITCH_DEGREES = -35;
const CAMERA_RANGE_FACTOR = 3.5; // camera distance as a multiple of the data's bounding radius
const MIN_CAMERA_RANGE = 150; // metres, so a single point or tiny feature isn't viewed from 0 m

const toCartesian = (Cesium, [lon, lat, height]) => Cesium.Cartesian3.fromDegrees(lon, lat, height);

// A rule's CSS colour, or the fallback when it is missing or not a colour Cesium can parse.
function cssColor(Cesium, css, fallback) {
  return (typeof css === 'string' && Cesium.Color.fromCssColorString(css))
    || Cesium.Color.fromCssColorString(fallback);
}

export function fillColor(Cesium, style, index) {
  const opacity = Number.isFinite(style?.opacity) ? Math.min(Math.max(style.opacity, 0), 1) : 1;
  return cssColor(Cesium, style?.color, PALETTE[index % PALETTE.length]).withAlpha(opacity);
}

function polygonHierarchy(Cesium, { outer, holes }) {
  return new Cesium.PolygonHierarchy(
    outer.map(c => toCartesian(Cesium, c)),
    holes.map(hole => new Cesium.PolygonHierarchy(hole.map(c => toCartesian(Cesium, c)))),
  );
}

function fillPrimitive(Cesium, renderable, color) {
  const attributes = () => ({ color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) });
  const appearance = new Cesium.PerInstanceColorAppearance({
    translucent: color.alpha < 1,
    closed: false,
    flat: renderable.clampToGround,
  });

  if (renderable.clampToGround) {
    return new Cesium.GroundPrimitive({
      geometryInstances: renderable.polygons.map(polygon => new Cesium.GeometryInstance({
        geometry: new Cesium.PolygonGeometry({ polygonHierarchy: polygonHierarchy(Cesium, polygon) }),
        id: renderable.id,
        attributes: attributes(),
      })),
      appearance,
      classificationType: Cesium.ClassificationType.BOTH,
      show: renderable.visible,
    });
  }

  return new Cesium.Primitive({
    geometryInstances: renderable.polygons.map(polygon => new Cesium.GeometryInstance({
      geometry: new Cesium.CoplanarPolygonGeometry({
        polygonHierarchy: polygonHierarchy(Cesium, polygon),
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
      id: renderable.id,
      attributes: attributes(),
    })),
    appearance,
    show: renderable.visible,
  });
}

function lineAppearance(Cesium, style) {
  const color = cssColor(Cesium, style?.lineColor, DEFAULT_LINE_COLOR);
  const material = style?.lineStyle === 'dashed'
    ? Cesium.Material.fromType('PolylineDash', { color, dashLength: DASH_LENGTH })
    : Cesium.Material.fromType('Color', { color });
  return new Cesium.PolylineMaterialAppearance({ material, translucent: color.alpha < 1 });
}

function outlinePrimitive(Cesium, segments, { id, style, clampToGround = false, visible = true }) {
  const appearance = lineAppearance(Cesium, style);
  if (clampToGround) {
    return new Cesium.GroundPolylinePrimitive({
      geometryInstances: segments.map(segment => new Cesium.GeometryInstance({
        geometry: new Cesium.GroundPolylineGeometry({
          positions: segment.map(c => toCartesian(Cesium, c)),
          width: LINE_WIDTH,
        }),
        id,
      })),
      appearance,
      classificationType: Cesium.ClassificationType.BOTH,
      show: visible,
    });
  }
  return new Cesium.Primitive({
    geometryInstances: segments.map(segment => new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: segment.map(c => toCartesian(Cesium, c)),
        width: LINE_WIDTH,
        arcType: Cesium.ArcType.NONE,
        vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
      }),
      id,
    })),
    appearance,
    show: visible,
  });
}

function pointCollection(Cesium, points) {
  const collection = new Cesium.PointPrimitiveCollection();
  const color = Cesium.Color.fromCssColorString(POINT_COLOR);
  points.forEach(c => collection.add({
    position: toCartesian(Cesium, c),
    color,
    pixelSize: POINT_PIXEL_SIZE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 1,
  }));
  return collection;
}

// Builds (but does not add) every primitive for a set of shapes. Returns
// { records, primitives, positions }: one record per renderable — its rule-derived kind, group,
// kindLabel, label, id and visibility plus its `fill` and `outline` primitives (the handles the
// UI toggles in stage 5) — the flat list of primitives to add to the scene, and every Cartesian
// position for framing.
export function buildScenePrimitives(Cesium, shapes) {
  const records = shapes.renderables.map((renderable, index) => ({
    kind: renderable.kind,
    group: renderable.group,
    kindLabel: renderable.kindLabel,
    label: renderable.label,
    id: renderable.id,
    visible: renderable.visible,
    fill: fillPrimitive(Cesium, renderable, fillColor(Cesium, renderable.style, index)),
    outline: renderable.segments.length
      ? outlinePrimitive(Cesium, renderable.segments, renderable)
      : null,
  }));

  const primitives = records.flatMap(r => [r.fill, r.outline].filter(Boolean));
  if (shapes.edges.length) primitives.push(outlinePrimitive(Cesium, shapes.edges, { id: 'edges' }));
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

// A per-block config's initial camera (cesium-options.js), in degrees and metres.
export function setCameraView(Cesium, viewer, { longitude, latitude, height, heading, pitch, roll }) {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
    orientation: {
      heading: Cesium.Math.toRadians(heading),
      pitch: Cesium.Math.toRadians(pitch),
      roll: Cesium.Math.toRadians(roll),
    },
  });
  viewer.scene.requestRender();
}
