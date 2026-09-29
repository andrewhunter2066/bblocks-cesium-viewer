import { CESIUM_BASE_URL, CESIUM_VERSION } from './cesium-version.js';

// Cesium's prebuilt ES module bundle on the CDN (not bundled into dist/).
export const CESIUM_MODULE_URL = `${CESIUM_BASE_URL}index.js`;
export const WIDGETS_CSS_URL = `${CESIUM_BASE_URL}Widgets/widgets.css`;
const WIDGETS_CSS_ID = 'bblocks-cesium-viewer-widgets-css';

const defaultImport = url => import(/* @vite-ignore */ url);

// Cesium resolves its Workers/, Assets/ and Widgets/ against the global CESIUM_BASE_URL, cached
// on first use, so it is set before the import. The ESM bundle would otherwise derive the same
// URL from its own import.meta.url. A value the host page already set is left alone.
export function importCesium(importFn = defaultImport) {
  globalThis.CESIUM_BASE_URL ??= CESIUM_BASE_URL;
  return importFn(CESIUM_MODULE_URL);
}

// context.depResolver (optional, host-provided) lets plugins share one Cesium instance. Its
// absence only skips the sharing — Cesium is still loaded from the CDN. The `~` range accepts
// patch releases only: Cesium's monthly minor releases can contain breaking changes.
export function resolveCesium(context, importFn = defaultImport) {
  const load = () => importCesium(importFn);
  if (context?.depResolver) {
    return context.depResolver.resolve({
      name: 'cesium',
      range: `~${CESIUM_VERSION}`,
      version: CESIUM_VERSION,
      load,
    });
  }
  return load();
}

// Cesium's widget styles (credits, error panel, etc.), injected once per page from the CDN.
export function injectWidgetsCss(doc = globalThis.document) {
  if (!doc || doc.getElementById(WIDGETS_CSS_ID)) return;
  const link = doc.createElement('link');
  link.id = WIDGETS_CSS_ID;
  link.rel = 'stylesheet';
  link.href = WIDGETS_CSS_URL;
  doc.head.appendChild(link);
}
