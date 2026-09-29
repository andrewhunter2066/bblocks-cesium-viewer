import { mimeTypeMatches } from './utils/mime-type-match.js';
import { isGeoreferencedTopoFeature } from './utils/detect-topo.js';
import { injectWidgetsCss, resolveCesium } from './utils/cesium-loader.js';
import { buildViewerOptions, fallBackFromIonErrors, setIonToken } from './utils/viewer-options.js';
import { buildTopologyShapes, defaultConfigFor } from './utils/topo-geometry.js';
import { loadConfig } from './utils/load-config.js';
import { addToScene, buildScenePrimitives, frameData, setCameraView } from './cesium-scene.js';

const SUPPORTED_TYPES = ['application/geo+json', 'application/json', 'application/ld+json'];

// Renders topo-feature (https://github.com/ogcincubator/topo-feature) topology documents on a
// CesiumJS globe, placing each point feature by its WGS84 `geometry` and assembling edges,
// faces, shells, solids and parcels from their topology references. Sibling of the Three.js
// TopoFeaturePlugin in bblocks-viewer-topo-feature-plugin, and driven by the same rule engine:
// built-in rules, optionally replaced by a per-block config (utils/load-config.js) that can also
// choose the basemap, terrain, initial camera and an ion token. One instance per matched
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
    this._data = null; // the picked candidate's parsed document
    this._el = null; // element currently rendered into; null once destroyed
    this._container = null; // this plugin's own child of _el, holding the Cesium widget
    this._viewer = null;
    this._records = [];
    this._config = null; // one per drawn feature: { kind, group, label, …, fill, outline } (see cesium-scene.js)
    this._config = null; // the effective config for the current render (see utils/load-config.js)
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
        const data = JSON.parse(c.content);
        if (!isGeoreferencedTopoFeature(data)) return false;
        this._data = data;
        return true;
      } catch {
        return false;
      }
    });
    this._candidate = candidate ?? null;
    return this._candidate;
  }

  // Seams for tests; everything else goes through the real CDN load and fetch().
  _loadCesium() {
    return resolveCesium(this._context);
  }

  _loadConfig() {
    return loadConfig(this._context, defaultConfigFor(this._data));
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
    // The config chooses the basemap/terrain, so it must be in hand before the viewer exists.
    const [Cesium, loaded] = await Promise.all([this._loadCesium(), this._loadConfig()]);
    if (this._el !== el) return; // destroyed (or re-rendered) while loading
    this._config = loaded;
    loaded.warnings.forEach(w => console.warn(`TopoFeatureCesiumPlugin: ${w}`));

    setIonToken(Cesium, loaded.cesium.ionToken);

    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; inset: 0;';
    el.appendChild(container);
    this._container = container;

    const viewerOptions = buildViewerOptions(Cesium, loaded.cesium);
    this._viewer = new Cesium.Viewer(container, viewerOptions);
    fallBackFromIonErrors(Cesium, this._viewer, viewerOptions, w => console.warn(`TopoFeatureCesiumPlugin: ${w}`));

    const shapes = buildTopologyShapes(this._data, loaded.config);
    const { records, primitives, positions } = buildScenePrimitives(Cesium, shapes);
    this._records = records;
    addToScene(this._viewer, primitives);
    if (loaded.cesium.camera) setCameraView(Cesium, this._viewer, loaded.cesium.camera);
    else frameData(Cesium, this._viewer, positions);
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
    // Destroying the viewer destroys every primitive added to its scene too.
    if (this._viewer && !this._viewer.isDestroyed()) this._viewer.destroy();
    this._viewer = null;
    this._records = [];
    this._config = null;
    this._container?.remove();
    this._container = null;
    el?.replaceChildren();
  }
}
