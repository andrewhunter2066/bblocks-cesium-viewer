// A stand-in for the Cesium namespace, recording what the plugin constructs, so the plugin's
// setup and lifecycle can be tested without WebGL or a network.

export function createFakeCesium({ viewerThrows = null } = {}) {
  const created = { viewers: [], imageryProviders: [], layers: [], terrainProviders: [] };

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
  }

  class EllipsoidTerrainProvider {
    constructor() {
      created.terrainProviders.push(this);
    }
  }

  class Viewer {
    constructor(container, options) {
      if (viewerThrows) throw viewerThrows;
      this.container = container;
      this.options = options;
      this.destroyCount = 0;
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
    created,
  };
}
