import { mimeTypeMatches } from './utils/mime-type-match.js';
import { isGeoreferencedTopoFeature } from './utils/detect-topo.js';
import { injectWidgetsCss, resolveCesium } from './utils/cesium-loader.js';
import { buildViewerOptions, fallBackFromIonErrors, setIonToken } from './utils/viewer-options.js';
import { buildTopologyShapes, defaultConfigFor } from './utils/topo-geometry.js';
import { loadConfig } from './utils/load-config.js';
import { addToScene, buildScenePrimitives, frameData, setCameraView } from './cesium-scene.js';
import { GlobeControls } from './ui/controls.js';
import { injectPluginCss } from './ui/inject-css.js';

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
    this._root = null; // this plugin's own child of _el (.bcv-root): viewer + controls
    this._viewer = null;
    this._Cesium = null;
    this._records = []; // one per drawn feature: { kind, group, label, …, fill, outline } (see cesium-scene.js)
    this._positions = []; // every drawn position, for zoom to extent
    this._config = null; // the effective config for the current render (see utils/load-config.js)
    this._controls = null;
    this._resizeObserver = null;
    this._fullscreenHandler = null;
    this._showLabels = false;
    this._showEdges = true;
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
    injectPluginCss();
    // The config chooses the basemap/terrain, so it must be in hand before the viewer exists.
    const [Cesium, loaded] = await Promise.all([this._loadCesium(), this._loadConfig()]);
    if (this._el !== el) return; // destroyed (or re-rendered) while loading
    this._Cesium = Cesium;
    this._config = loaded;
    loaded.warnings.forEach(w => console.warn(`TopoFeatureCesiumPlugin: ${w}`));

    setIonToken(Cesium, loaded.cesium.ionToken);

    // The plugin's own wrapper: holds the viewer and the controls, and is what goes fullscreen.
    const root = document.createElement('div');
    root.className = 'bcv-root';
    const container = document.createElement('div');
    container.className = 'bcv-viewer';
    root.appendChild(container);
    el.appendChild(root);
    this._root = root;

    const viewerOptions = buildViewerOptions(Cesium, loaded.cesium);
    this._viewer = new Cesium.Viewer(container, viewerOptions);
    fallBackFromIonErrors(Cesium, this._viewer, viewerOptions, w => console.warn(`TopoFeatureCesiumPlugin: ${w}`));

    const shapes = buildTopologyShapes(this._data, loaded.config);
    const { records, primitives, positions } = buildScenePrimitives(Cesium, shapes);
    this._records = records;
    this._positions = positions;
    records.forEach(r => this._applyVisibility(r));
    addToScene(this._viewer, primitives);
    if (loaded.cesium.camera) setCameraView(Cesium, this._viewer, loaded.cesium.camera);
    else frameData(Cesium, this._viewer, positions);

    this._controls = new GlobeControls(root, {
      records,
      initial: { labelsShown: this._showLabels, edgesShown: this._showEdges },
      actions: {
        setVisible: (targets, visible) => {
          targets.forEach(r => { r.visible = visible; this._applyVisibility(r); });
          this._requestRender();
        },
        setLabelsShown: shown => this._setOverlay('_showLabels', shown),
        setEdgesShown: shown => this._setOverlay('_showEdges', shown),
        zoomToExtent: () => this.zoomToExtent(),
        zoomTo: record => frameData(Cesium, this._viewer, record.positions, { animate: true }),
        toggleFullscreen: () => this._toggleFullscreen(),
        isFullscreen: () => this._isFullscreen(),
      },
    });
    this._watchLayout(root);
  }

  // A record's primitives follow its own visibility, with outlines and labels also gated by the
  // global edges/labels toggles.
  _applyVisibility(record) {
    record.fill.show = record.visible;
    if (record.outline) record.outline.show = record.visible && this._showEdges;
    if (record.labelGraphic) record.labelGraphic.show = record.visible && this._showLabels;
  }

  _setOverlay(field, shown) {
    this[field] = shown;
    this._records.forEach(r => this._applyVisibility(r));
    this._requestRender();
  }

  _requestRender() {
    if (this._viewer && !this._viewer.isDestroyed()) this._viewer.scene.requestRender();
  }

  // Flies to the visible features (all of them when none are visible, or for a document with no
  // classified features, e.g. bare points).
  zoomToExtent() {
    if (!this._viewer) return;
    const visible = this._records.filter(r => r.visible).flatMap(r => r.positions);
    frameData(this._Cesium, this._viewer, visible.length ? visible : this._positions, { animate: true });
  }

  _isFullscreen() {
    return !!this._root && document.fullscreenElement === this._root;
  }

  _toggleFullscreen() {
    if (this._isFullscreen()) document.exitFullscreen?.();
    else this._root?.requestFullscreen?.();
  }

  // Compact vs expanded layout follows the root's size (the host's own expand dialog resizes it
  // just like fullscreen does); fullscreen changes also update the fullscreen button.
  _watchLayout(root) {
    const update = () => {
      if (this._root === root) this._controls?.applyViewMode();
    };
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(update);
      this._resizeObserver.observe(root);
    }
    this._fullscreenHandler = update;
    document.addEventListener('fullscreenchange', update);
  }

  _showError(el, message) {
    this.destroy(el);
    const banner = document.createElement('div');
    banner.className = 'bcv-error';
    banner.setAttribute('role', 'alert');
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    const hintEl = document.createElement('div');
    hintEl.className = 'bcv-error-hint';
    hintEl.textContent = 'See the browser console for details.';
    banner.append(messageEl, hintEl);
    el.appendChild(banner);
  }

  // Safe to call at any point: before render(), mid-load, after a failure, or twice.
  destroy(el) {
    this._el = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._fullscreenHandler) document.removeEventListener('fullscreenchange', this._fullscreenHandler);
    this._fullscreenHandler = null;
    if (this._isFullscreen()) document.exitFullscreen?.();
    this._controls?.destroy();
    this._controls = null;
    // Destroying the viewer destroys every primitive added to its scene too.
    if (this._viewer && !this._viewer.isDestroyed()) this._viewer.destroy();
    this._viewer = null;
    this._Cesium = null;
    this._records = [];
    this._positions = [];
    this._config = null;
    this._root?.remove();
    this._root = null;
    el?.replaceChildren();
  }
}
