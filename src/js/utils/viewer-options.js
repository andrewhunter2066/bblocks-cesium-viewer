// Token-free Cesium Viewer setup: OpenStreetMap imagery on a flat ellipsoid, and every widget
// that would otherwise reach Cesium ion (imagery/terrain pickers, geocoder) turned off.

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/';
export const OSM_CREDIT = '© OpenStreetMap contributors';

// Cesium ships a shared demo ion token as Ion.defaultAccessToken. Blanking it means anything that
// still tried ion would fail visibly instead of quietly using the demo token. An optional real
// token (stage 4) is assigned in its place.
export function disableIonDefaults(Cesium) {
  Cesium.Ion.defaultAccessToken = '';
}

export function buildViewerOptions(Cesium) {
  const imagery = new Cesium.OpenStreetMapImageryProvider({ url: OSM_TILE_URL, credit: OSM_CREDIT });
  return {
    baseLayer: new Cesium.ImageryLayer(imagery),
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
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
