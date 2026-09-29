import { mimeTypeMatches } from './utils/mime-type-match.js';
import { isGeoreferencedTopoFeature } from './utils/detect-topo.js';

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
    this._el = null;
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

  // Stage 1 placeholder: the CesiumJS globe arrives in stage 2 (see PLAN.md).
  render(el) {
    this._el = el;
    el.style.position = 'relative';
    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'display: flex; align-items: center; justify-content: center; '
      + 'height: 100%; font: 14px/1.4 sans-serif; color: #666;';
    placeholder.textContent = `${TopoFeatureCesiumPlugin.viewName}: ${this._candidate?.label ?? 'document'} matched`;
    el.appendChild(placeholder);
  }

  destroy(el) {
    if (el) el.replaceChildren();
    this._el = null;
  }
}
