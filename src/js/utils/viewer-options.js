// Cesium Viewer setup from the effective Cesium options (cesium-options.js). By default:
// OpenStreetMap imagery on a flat ellipsoid, with every widget that would otherwise reach Cesium
// ion (imagery/terrain pickers, geocoder) turned off. Ion imagery/terrain are used only when the
// config asks for them and supplies a token.

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/';
export const OSM_CREDIT = '© OpenStreetMap contributors';
// tile.openstreetmap.org serves zoom 0–19; Cesium upsamples level 19 when zoomed in further
// instead of requesting tiles that don't exist.
export const OSM_MAX_LEVEL = 19;

// Cesium ships a shared demo ion token as Ion.defaultAccessToken. It is always replaced: by the
// config's own token, or by '' so anything that still tried ion would fail visibly instead of
// quietly using the demo token.
export function setIonToken(Cesium, token = '') {
  Cesium.Ion.defaultAccessToken = token;
}

function osmLayer(Cesium) {
  return new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({
    url: OSM_TILE_URL,
    credit: OSM_CREDIT,
    maximumLevel: OSM_MAX_LEVEL,
  }));
}

function baseLayer(Cesium, basemap) {
  if (basemap === 'ion') return Cesium.ImageryLayer.fromWorldImagery();
  if (basemap && typeof basemap === 'object') {
    return new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({
      url: basemap.url,
      credit: basemap.credit,
      maximumLevel: basemap.maximumLevel,
    }));
  }
  return osmLayer(Cesium);
}

export function buildViewerOptions(Cesium, { basemap = 'osm', terrain = 'ellipsoid' } = {}) {
  return {
    baseLayer: baseLayer(Cesium, basemap),
    ...(terrain === 'ion'
      ? { terrain: Cesium.Terrain.fromWorldTerrain() }
      : { terrainProvider: new Cesium.EllipsoidTerrainProvider() }),
    baseLayerPicker: false, // would default to ion imagery/terrain
    geocoder: false, // ion geocoder
    timeline: false,
    animation: false,
    homeButton: false,
    sceneModePicker: false,
    projectionPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false, // the plugin's own fullscreen control arrives with the UI (stage 5)
    vrButton: false,
    infoBox: false,
    selectionIndicator: false,
    // Only redraw when something changes, so an idle tab costs no GPU time.
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
  };
}

// If ion rejects the token (expired, wrong domain, wrong scope) or is unreachable, ion terrain
// never loads — Cesium then draws no globe at all — and ion imagery stays blank. Swap in the
// token-free OSM imagery / ellipsoid instead, reporting each fallback through `warn`.
// `viewerOptions` is the object buildViewerOptions() returned for this viewer.
export function fallBackFromIonErrors(Cesium, viewer, viewerOptions, warn) {
  const { terrain, baseLayer: layer } = viewerOptions;
  terrain?.errorEvent?.addEventListener(error => {
    warn(`ion terrain failed to load (${error?.message ?? error}); using the ellipsoid`);
    if (viewer.isDestroyed()) return;
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    viewer.scene.requestRender();
  });
  // Only a layer whose provider is created asynchronously — ion's — ever raises errorEvent.
  layer?.errorEvent?.addEventListener(error => {
    warn(`ion imagery failed to load (${error?.message ?? error}); using OpenStreetMap`);
    if (viewer.isDestroyed()) return;
    viewer.imageryLayers.remove(layer);
    viewer.imageryLayers.add(osmLayer(Cesium), 0);
    viewer.scene.requestRender();
  });
}
