// CesiumJS is fetched at runtime from jsDelivr at this pinned version, not bundled. Kept in sync
// with the `cesium` devDependency in package.json (which exists only so tooling can resolve the
// same version locally) by scripts/check-cesium-version.mjs, run as `prebuild`.
export const CESIUM_VERSION = '1.145.0';

// Root of Cesium's prebuilt distribution on the CDN. CESIUM_BASE_URL must point here so Cesium
// finds its Workers/, Assets/ and Widgets/ (incl. widgets.css) next to the module it loaded from.
export const CESIUM_BASE_URL = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;
