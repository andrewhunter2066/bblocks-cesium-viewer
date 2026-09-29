import { mimeTypeMatches } from './utils/mime-type-match.js';
import { isGeoreferencedTopoFeature } from './utils/detect-topo.js';
import { injectWidgetsCss, resolveCesium } from './utils/cesium-loader.js';
import { buildViewerOptions, disableIonDefaults } from './utils/viewer-options.js';

const SUPPORTED_TYPES = ['application/geo+json', 'application/json', 'application/ld+json'];

// Renders topo-feature (https://github.com/ogcincubator/topo-feature) topology documents on a
// CesiumJS globe, placing each point feature by its WGS84 `geometry`. Sibling of the Three.js
// TopoFeaturePlugin in bblocks-viewer-topo-feature-plugin. One instance per matched
// example/transform-output, so all state here is scoped to one candidate set.
//
// @implements {import('@ogc/bblocks-viewer-plugin-types').ViewPluginClass}
export default class TopoFeatureCesiumPlugin {
  static supportedTypes = SUPPORTED_TYPES;
  static viewName = 'Globe';
  static icon = 'mdi-earth';

  /**
   * @param {import('@ogc/bblocks-viewer-plugin-types').ViewPluginCandidate[]} candidates
   * @param {import('@ogc/bblocks-viewer-plugin-types').ViewPluginContext} [context]
   */
  constructor(candidates, context = {}) {
    this.candidates = candidates ?? [];
    this._context = context ?? {};
    this._candidate = undefined; // undefined = not yet picked, null = nothing usable
    this._el = null; // element currently rendered into; null once destroyed
    this._container = null; // this plugin's own child of _el, holding the Cesium widget
    this._viewer = null;
  }

  matches() {
    return !!this._pickCandidate();
  }

  _pickCandidate() {
    if (this._candidate !== undefined) return this._candidate;
    const candidate = this.candidates.find(c => {
      if (!c?.type || !c.content) return false;
      if (!SUPPORTED_TYPES.some(t => mimeTypeMatches(t, c.type))) return false;
      try {
        return isGeoreferencedTopoFeature(JSON.parse(c.content));
      } catch {
        return false;
      }
    });
    this._candidate = candidate ?? null;
    return this._candidate;
  }

  // Seam for tests; everything else goes through the real CDN load.
  _loadCesium() {
    return resolveCesium(this._context);
  }

  render(el) {
    if (this._el) this.destroy(this._el);
    this._el = el;
    // The host sizes el; only add positioning so the absolutely placed container fills it.
    el.style.position = 'relative';
    // Loading is async, so its failures never reach the host's render() error handling —
    // surface them in the tab ourselves.
    return this._mount(el).catch(e => {
      console.error('TopoFeatureCesiumPlugin: failed to render', e);
      if (this._el === el) this._showError(el, `Failed to render the globe view (${e.message}).`);
    });
  }

  async _mount(el) {
    if (!this._pickCandidate()) return;

    injectWidgetsCss();
    const Cesium = await this._loadCesium();
    if (this._el !== el) return; // destroyed (or re-rendered) while Cesium was loading

    disableIonDefaults(Cesium);

    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; inset: 0;';
    el.appendChild(container);
    this._container = container;

    this._viewer = new Cesium.Viewer(container, buildViewerOptions(Cesium));
  }

  _showError(el, message) {
    this.destroy(el);
    const banner = document.createElement('div');
    banner.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; '
      + 'height: 100%; padding: 16px; box-sizing: border-box; text-align: center; color: #b00020; '
      + 'font: 14px/1.4 sans-serif;';
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    const hintEl = document.createElement('div');
    hintEl.style.cssText = 'margin-top: 12px;';
    hintEl.textContent = 'See the browser console for details.';
    banner.append(messageEl, hintEl);
    el.appendChild(banner);
  }

  // Safe to call at any point: before render(), mid-load, after a failure, or twice.
  destroy(el) {
    this._el = null;
    if (this._viewer && !this._viewer.isDestroyed()) this._viewer.destroy();
    this._viewer = null;
    this._container?.remove();
    this._container = null;
    el?.replaceChildren();
  }
}
