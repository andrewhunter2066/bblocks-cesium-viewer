// The globe view's controls, in plain DOM: a toolbar (zoom to extent, labels, edges, layers,
// fullscreen, plus quick toggles for the built-in groups) and a layers panel listing every drawn
// feature by group and kind, with per-group/per-kind select-all checkboxes and per-feature
// checkboxes and zoom buttons. Knows nothing about Cesium: it reads and writes the records'
// `visible` flags through the plugin's `actions`.
//
// Layout follows the space the host gives the view, not which control got it there: at
// EXPANDED_VIEW_MIN_HEIGHT or taller (the host's expanded dialog, or fullscreen) the panel is
// always shown; in the compact ~300px tab it is a pop-over behind the layers button, and the
// built-in groups get inline toggle buttons. Mirrors the Three.js TopoFeaturePlugin's UI.
import { ICONS } from './icons.js';

export const EXPANDED_VIEW_MIN_HEIGHT = 400;

// Presentation for the built-in rules' groups; any other group (from a per-block config) gets a
// humanised version of its own name and appears only in the panel.
const GROUP_PRESENTATION = {
  parcel: { icon: 'parcels', inlineLabel: 'parcels', panelLabel: 'Parcels' },
  surface: { icon: 'surfaces', inlineLabel: 'surfaces', panelLabel: 'Surfaces' },
  solid: { icon: 'solids', inlineLabel: 'solids', panelLabel: 'Solids' },
  face: { panelLabel: 'Faces' },
  ring: { panelLabel: 'Rings' },
};
const INLINE_GROUP_ORDER = ['parcel', 'surface', 'solid'];

// "former-tenure-parcel" -> "Former tenure parcel"
export function humanizeSlug(slug) {
  const words = String(slug).replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : String(slug);
}

const unique = values => [...new Set(values)];

function element(doc, tag, className, text) {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * @param {HTMLElement} root  the plugin's own wrapper; the toolbar and panel are appended to it
 * @param {object} options
 * @param {Array<{group, kind, kindLabel, label, visible}>} options.records  one per drawn feature
 * @param {object} options.actions  setVisible(records, visible), zoomToExtent(), zoomTo(record),
 *   setLabelsShown(shown), setEdgesShown(shown), toggleFullscreen(), isFullscreen()
 * @param {{ labelsShown: boolean, edgesShown: boolean }} options.initial
 */
export class GlobeControls {
  constructor(root, { records, actions, initial = {} }) {
    this.root = root;
    this.doc = root.ownerDocument;
    this.records = records;
    this.actions = actions;
    this.labelsShown = initial.labelsShown ?? false;
    this.edgesShown = initial.edgesShown ?? true;
    this.panelOpen = false; // the compact layout's pop-over
    this.buttons = {};
    this.groupButtons = [];
    this._build();
    this.applyViewMode();
  }

  get expanded() {
    return this.root.clientHeight >= EXPANDED_VIEW_MIN_HEIGHT;
  }

  _button(key, onClick) {
    const btn = element(this.doc, 'button', 'bcv-button');
    btn.type = 'button';
    btn.addEventListener('click', () => {
      onClick();
      this.refresh();
    });
    this.buttons[key] = btn;
    return btn;
  }

  _build() {
    const toolbar = element(this.doc, 'div', 'bcv-toolbar');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Globe view controls');
    const hasFeatures = this.records.length > 0;

    toolbar.appendChild(this._button('extent', () => this.actions.zoomToExtent()));
    if (hasFeatures) {
      toolbar.appendChild(this._button('labels', () => {
        this.labelsShown = !this.labelsShown;
        this.actions.setLabelsShown(this.labelsShown);
      }));
      toolbar.appendChild(this._button('edges', () => {
        this.edgesShown = !this.edgesShown;
        this.actions.setEdgesShown(this.edgesShown);
      }));

      const groupBar = element(this.doc, 'div', 'bcv-toolbar-group');
      const groups = unique(this.records.map(r => r.group));
      this.groupButtons = INLINE_GROUP_ORDER.filter(g => groups.includes(g)).map(group => {
        const btn = this._button(`group:${group}`, () => this._setVisible(this._groupRecords(group), !this._allVisible(this._groupRecords(group))));
        btn.dataset.group = group;
        groupBar.appendChild(btn);
        return { group, btn };
      });
      if (this.groupButtons.length) toolbar.appendChild(groupBar);

      toolbar.appendChild(this._button('layers', () => {
        this.panelOpen = !this.panelOpen;
        this.applyViewMode();
      }));
    }
    toolbar.appendChild(this._button('fullscreen', () => this.actions.toggleFullscreen()));
    this.toolbar = toolbar;
    this.root.appendChild(toolbar);

    if (hasFeatures) {
      this.panel = element(this.doc, 'div', 'bcv-panel');
      this.panel.id = `bcv-panel-${Math.random().toString(36).slice(2, 10)}`;
      this.panel.setAttribute('role', 'region');
      this.panel.setAttribute('aria-label', 'Layers');
      this.buttons.layers.setAttribute('aria-controls', this.panel.id);
      this.root.appendChild(this.panel);
    }
    this.refresh();
  }

  _groupRecords(group) {
    return this.records.filter(r => r.group === group);
  }

  _allVisible(records) {
    return records.length > 0 && records.every(r => r.visible);
  }

  _setVisible(records, visible) {
    this.actions.setVisible(records, visible);
    this.refresh();
  }

  // Re-reads every piece of state into the DOM: button states, and the panel's checkboxes.
  refresh() {
    const set = (key, icon, title, pressed) => {
      const btn = this.buttons[key];
      if (!btn) return;
      btn.innerHTML = ICONS[icon];
      btn.title = title;
      btn.setAttribute('aria-label', title);
      if (pressed !== undefined) btn.setAttribute('aria-pressed', String(pressed));
    };
    const fullscreen = this.actions.isFullscreen();
    set('extent', 'extent', 'Zoom to extent');
    set('labels', 'labels', this.labelsShown ? 'Hide labels' : 'Show labels', this.labelsShown);
    set('edges', 'edges', this.edgesShown ? 'Hide edges' : 'Show edges', this.edgesShown);
    set('layers', 'layers', this.panelOpen ? 'Hide layers' : 'Layers', this.panelOpen);
    set('fullscreen', fullscreen ? 'fullscreenExit' : 'fullscreen', fullscreen ? 'Exit fullscreen' : 'Fullscreen', fullscreen);
    this.groupButtons.forEach(({ group, btn }) => {
      const { icon, inlineLabel } = GROUP_PRESENTATION[group];
      const visible = this._allVisible(this._groupRecords(group));
      set(`group:${group}`, icon, `${visible ? 'Hide' : 'Show'} ${inlineLabel}`, visible);
      btn.dataset.group = group;
    });
    this.buttons.layers?.setAttribute('aria-expanded', String(this.expanded || this.panelOpen));
    this._renderPanel();
  }

  // Compact: inline group toggles, panel behind the layers button. Expanded: panel always shown.
  applyViewMode() {
    const expanded = this.expanded;
    this.groupButtons.forEach(({ btn }) => { btn.hidden = expanded; });
    if (this.buttons.layers) this.buttons.layers.hidden = expanded;
    if (this.panel) this.panel.hidden = !(expanded || this.panelOpen);
    this.refresh();
  }

  // A checkbox for several records at once: checked when all are visible, unchecked when none
  // are, indeterminate for a mix.
  _selectAll(records, name, key) {
    const checkbox = this.doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.key = key;
    checkbox.checked = records.every(r => r.visible);
    checkbox.indeterminate = !checkbox.checked && records.some(r => r.visible);
    checkbox.setAttribute('aria-label', `Show all ${name}`);
    // Inside a <summary>, a click would also open/close the <details>.
    checkbox.addEventListener('click', e => e.stopPropagation());
    checkbox.addEventListener('change', () => this._setVisible(records, checkbox.checked));
    return checkbox;
  }

  _featureRow(record) {
    const row = element(this.doc, 'div', 'bcv-feature');
    const label = this.doc.createElement('label');
    const checkbox = this.doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.key = `feature:${this.records.indexOf(record)}`;
    checkbox.checked = record.visible;
    checkbox.addEventListener('change', () => this._setVisible([record], checkbox.checked));
    const name = element(this.doc, 'span', 'bcv-feature-name', record.label);
    name.title = record.label;
    label.append(checkbox, name);

    const zoom = element(this.doc, 'button', 'bcv-zoom-to');
    zoom.type = 'button';
    zoom.innerHTML = ICONS.zoomTo;
    zoom.title = `Zoom to ${record.label}`;
    zoom.setAttribute('aria-label', zoom.title);
    zoom.addEventListener('click', () => this.actions.zoomTo(record));
    row.append(label, zoom);
    return row;
  }

  // Groups become collapsible sections. A group with several kinds (e.g. a config's "Created"
  // and "Former Tenure" parcel rules sharing the "parcel" group) gets a sub-list per kind.
  // Sections keep their open/closed state, and the focused checkbox keeps focus, across refreshes.
  _renderPanel() {
    if (!this.panel) return;
    const focusedKey = this.doc.activeElement?.dataset?.key;
    const closed = new Set(
      [...(this.panel.children ?? [])].filter(d => d.tagName === 'DETAILS' && !d.open).map(d => d.dataset.group),
    );
    this.panel.replaceChildren(element(this.doc, 'h2', 'bcv-panel-title', 'Layers'));

    unique(this.records.map(r => r.group)).forEach(group => {
      const groupRecords = this._groupRecords(group);
      const groupLabel = GROUP_PRESENTATION[group]?.panelLabel ?? humanizeSlug(group);

      const details = element(this.doc, 'details', 'bcv-group');
      details.dataset.group = group;
      details.open = !closed.has(group);
      const summary = this.doc.createElement('summary');
      summary.append(this._selectAll(groupRecords, groupLabel, `group:${group}`), element(this.doc, 'span', '', `${groupLabel} (${groupRecords.length})`));

      const body = element(this.doc, 'div', 'bcv-group-body');
      const kinds = unique(groupRecords.map(r => r.kind));
      if (kinds.length > 1) {
        kinds.forEach(kind => {
          const kindRecords = groupRecords.filter(r => r.kind === kind);
          const kindLabel = kindRecords[0].kindLabel ?? GROUP_PRESENTATION[kind]?.panelLabel ?? humanizeSlug(kind);
          const wrapper = element(this.doc, 'div', 'bcv-kind');
          const header = element(this.doc, 'label', 'bcv-kind-header');
          header.append(this._selectAll(kindRecords, kindLabel, `kind:${group}:${kind}`), element(this.doc, 'span', '', `${kindLabel} (${kindRecords.length})`));
          const list = element(this.doc, 'div', 'bcv-kind-body');
          kindRecords.forEach(r => list.appendChild(this._featureRow(r)));
          wrapper.append(header, list);
          body.appendChild(wrapper);
        });
      } else {
        groupRecords.forEach(r => body.appendChild(this._featureRow(r)));
      }

      details.append(summary, body);
      this.panel.appendChild(details);
    });

    if (focusedKey) this.panel.querySelector(`[data-key="${CSS.escape(focusedKey)}"]`)?.focus();
  }

  destroy() {
    this.toolbar?.remove();
    this.panel?.remove();
    this.toolbar = null;
    this.panel = null;
    this.buttons = {};
    this.groupButtons = [];
  }
}
