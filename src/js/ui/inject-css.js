// The plugin's stylesheet, injected once per document. A static `?raw` import (inlined by Vite at
// build time): a dynamic import() of a ?raw asset is rejected by browsers' module MIME checks.
import css from '../../css/plugin.css?raw';

const STYLE_ID = 'bblocks-cesium-viewer-css';

export function injectPluginCss(doc = globalThis.document) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}
