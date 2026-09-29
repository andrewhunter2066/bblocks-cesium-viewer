// A stand-in for the Cesium namespace, recording what the plugin constructs, so the plugin's
// setup, scene building and lifecycle can be tested without WebGL or a network. Constructors just
// keep their options; positions stay as readable { lon, lat, height } objects.

// Minimal Cesium Event: listeners plus a raise() for tests to fire.
export class FakeEvent {
  constructor() {
    this.listeners = [];
  }

  addEventListener(listener) {
    this.listeners.push(listener);
  }

  raise(...args) {
    this.listeners.forEach(l => l(...args));
  }
}

export function createFakeCesium({ viewerThrows = null } = {}) {
  const created = { viewers: [], imageryProviders: [], layers: [], terrainProviders: [] };

  const keepOptions = () => class {
    constructor(options) {
      this.options = options;
    }
  };

  class OpenStreetMapImageryProvider {
    constructor(options) {
      this.options = options;
      created.imageryProviders.push(this);
    }
  }

  class ImageryLayer {
    constructor(imageryProvider, options) {
      this.imageryProvider = imageryProvider;
      this.options = options;
      created.layers.push(this);
    }

    static fromWorldImagery() {
      const layer = new ImageryLayer('ion-world-imagery');
      layer.errorEvent = new FakeEvent();
      return layer;
    }
  }

  class EllipsoidTerrainProvider {
    constructor() {
      created.terrainProviders.push(this);
    }
  }

  class Color {
    constructor(css, alpha = 1) {
      this.css = css;
      this.alpha = alpha;
    }

    // Like Cesium, returns undefined for a string that isn't a CSS colour.
    static fromCssColorString(css) {
      return /^(#[0-9a-f]{3,8}|rgba?\(.*\)|[a-z]+)$/i.test(css) && css !== 'notacolour' ? new Color(css) : undefined;
    }

    withAlpha(alpha) {
      return new Color(this.css, alpha);
    }
  }
  Color.BLACK = new Color('#000000');

  class PolygonHierarchy {
    constructor(positions, holes = []) {
      this.positions = positions;
      this.holes = holes;
    }
  }

  class PerInstanceColorAppearance extends keepOptions() {}
  PerInstanceColorAppearance.VERTEX_FORMAT = 'per-instance-color-vertex-format';
  class PolylineMaterialAppearance extends keepOptions() {}
  PolylineMaterialAppearance.VERTEX_FORMAT = 'polyline-material-vertex-format';

  class PointPrimitiveCollection {
    constructor() {
      this.points = [];
    }

    add(point) {
      this.points.push(point);
      return point;
    }
  }

  class Viewer {
    constructor(container, options) {
      if (viewerThrows) throw viewerThrows;
      this.container = container;
      this.options = options;
      this.destroyCount = 0;
      this.scene = {
        renderRequests: 0,
        requestRender: () => { this.scene.renderRequests += 1; },
        primitives: { list: [], add: p => { this.scene.primitives.list.push(p); return p; } },
      };
      this.terrainProvider = options?.terrainProvider ?? null;
      this.imageryLayers = {
        list: options?.baseLayer ? [options.baseLayer] : [],
        add: (layer, index = this.imageryLayers.list.length) => { this.imageryLayers.list.splice(index, 0, layer); },
        remove: layer => { this.imageryLayers.list = this.imageryLayers.list.filter(l => l !== layer); },
      };
      this.camera = {
        calls: [],
        setView: view => this.camera.calls.push(['setView', view]),
        viewBoundingSphere: (sphere, offset) => this.camera.calls.push(['viewBoundingSphere', sphere, offset]),
        lookAtTransform: transform => this.camera.calls.push(['lookAtTransform', transform]),
      };
      created.viewers.push(this);
    }

    isDestroyed() {
      return this.destroyCount > 0;
    }

    destroy() {
      this.destroyCount += 1;
    }
  }

  return {
    Ion: { defaultAccessToken: 'DEMO-TOKEN-PLACEHOLDER' },
    OpenStreetMapImageryProvider,
    ImageryLayer,
    EllipsoidTerrainProvider,
    Viewer,
    Color,
    PolygonHierarchy,
    PerInstanceColorAppearance,
    PolylineMaterialAppearance,
    PointPrimitiveCollection,
    GeometryInstance: keepOptions(),
    CoplanarPolygonGeometry: keepOptions(),
    PolygonGeometry: keepOptions(),
    PolylineGeometry: keepOptions(),
    GroundPolylineGeometry: keepOptions(),
    Primitive: keepOptions(),
    GroundPrimitive: keepOptions(),
    GroundPolylinePrimitive: keepOptions(),
    UrlTemplateImageryProvider: keepOptions(),
    Material: { fromType: (type, uniforms) => ({ type, uniforms }) },
    ClassificationType: { TERRAIN: 'TERRAIN', CESIUM_3D_TILE: 'CESIUM_3D_TILE', BOTH: 'BOTH' },
    Terrain: { fromWorldTerrain: () => ({ name: 'ion-world-terrain', errorEvent: new FakeEvent() }) },
    ColorGeometryInstanceAttribute: { fromColor: color => ({ color }) },
    ArcType: { NONE: 'NONE', GEODESIC: 'GEODESIC' },
    Cartesian3: { fromDegrees: (lon, lat, height) => ({ lon, lat, height }) },
    BoundingSphere: {
      fromPoints: points => ({ points, radius: 10 }),
    },
    HeadingPitchRange: class {
      constructor(heading, pitch, range) {
        Object.assign(this, { heading, pitch, range });
      }
    },
    Math: { toRadians: degrees => degrees * Math.PI / 180 },
    Matrix4: { IDENTITY: 'IDENTITY' },
    created,
  };
}
