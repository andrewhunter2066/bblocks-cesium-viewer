import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EXPANDED_VIEW_MIN_HEIGHT, GlobeControls, humanizeSlug } from './controls.js';
import { installFakeDocument } from '../test-support/fake-dom.js';

let dom;
beforeEach(() => { dom = installFakeDocument(); });
afterEach(() => { dom.restore(); });

const record = (group, kind, label, visible = true, kindLabel) => ({ group, kind, label, visible, kindLabel });

// Controls over `records` in a root of the given height, with actions that record their calls
// and apply visibility the way the plugin does.
function setup(records, { height = 300 } = {}) {
  const root = dom.doc.body.appendChild(dom.doc.createElement('div'));
  root.clientHeight = height;
  const calls = [];
  let fullscreen = false;
  const actions = {
    setVisible: (targets, visible) => { calls.push(['setVisible', targets.map(r => r.label), visible]); targets.forEach(r => { r.visible = visible; }); },
    setLabelsShown: shown => calls.push(['labels', shown]),
    setEdgesShown: shown => calls.push(['edges', shown]),
    zoomToExtent: () => calls.push(['extent']),
    zoomTo: r => calls.push(['zoomTo', r.label]),
    toggleFullscreen: () => { fullscreen = !fullscreen; calls.push(['fullscreen']); },
    isFullscreen: () => fullscreen,
  };
  const controls = new GlobeControls(root, { records, actions });
  return { root, controls, calls };
}

const byClass = (root, className) => root.findAll(el => el.className === className);
const button = (controls, key) => controls.buttons[key];
const checkboxByKey = (root, key) => root.querySelector(`[data-key="${key}"]`);

const PARCEL_RECORDS = () => [
  record('solid', 'solid', 'Lot 800 solid'),
  record('surface', 'surface', 'Ground', false),
  record('parcel', 'parcel-created', 'Lot 800', true, 'Created'),
  record('parcel', 'parcel-former-tenure', 'Lot 7', false, 'Former Tenure'),
  record('parcel', 'parcel-former-tenure', 'Lot 8', false, 'Former Tenure'),
];

test('humanizeSlug turns rule slugs into headings', () => {
  assert.equal(humanizeSlug('former-tenure_parcel'), 'Former tenure parcel');
  assert.equal(humanizeSlug('pipe'), 'Pipe');
});

test('toolbar has zoom-to-extent, labels, edges, group toggles, layers and fullscreen', () => {
  const { controls, root } = setup(PARCEL_RECORDS());
  assert.deepEqual(Object.keys(controls.buttons), ['extent', 'labels', 'edges', 'group:parcel', 'group:surface', 'group:solid', 'layers', 'fullscreen']);
  assert.equal(root.find(el => el.className === 'bcv-toolbar').getAttribute('role'), 'toolbar');
  for (const btn of Object.values(controls.buttons)) {
    assert.ok(btn.getAttribute('aria-label'), 'every button has an accessible name');
    assert.match(btn.innerHTML, /^<svg/);
  }
});

test('only built-in groups get inline toggles; a config group is panel-only', () => {
  const { controls } = setup([record('pipe', 'pipe', 'Pipe A'), record('solid', 'solid', 'S')]);
  assert.ok(button(controls, 'group:solid'));
  assert.equal(button(controls, 'group:pipe'), undefined);
});

test('a document with no features gets only zoom-to-extent and fullscreen, and no panel', () => {
  const { controls, root } = setup([]);
  assert.deepEqual(Object.keys(controls.buttons), ['extent', 'fullscreen']);
  assert.equal(byClass(root, 'bcv-panel').length, 0);
});

test('toolbar buttons call their actions and reflect toggle state', () => {
  const { controls, calls } = setup(PARCEL_RECORDS());
  button(controls, 'extent').click();
  button(controls, 'labels').click();
  button(controls, 'edges').click();
  button(controls, 'fullscreen').click();
  assert.deepEqual(calls, [['extent'], ['labels', true], ['edges', false], ['fullscreen']]);
  assert.equal(button(controls, 'labels').getAttribute('aria-pressed'), 'true');
  assert.equal(button(controls, 'labels').title, 'Hide labels');
  assert.equal(button(controls, 'edges').getAttribute('aria-pressed'), 'false');
  assert.equal(button(controls, 'fullscreen').title, 'Exit fullscreen');
});

test('a group toggle hides the whole group, or shows it all when partly hidden', () => {
  const records = PARCEL_RECORDS();
  const { controls, calls } = setup(records);
  const parcels = button(controls, 'group:parcel');
  assert.equal(parcels.getAttribute('aria-pressed'), 'false', 'parcel group is only partly visible');
  parcels.click();
  assert.deepEqual(calls.at(-1), ['setVisible', ['Lot 800', 'Lot 7', 'Lot 8'], true]);
  assert.equal(parcels.getAttribute('aria-pressed'), 'true');
  parcels.click();
  assert.deepEqual(calls.at(-1), ['setVisible', ['Lot 800', 'Lot 7', 'Lot 8'], false]);
});

test('compact layout: panel hidden until the layers button opens it', () => {
  const { controls, root } = setup(PARCEL_RECORDS(), { height: 300 });
  const [panel] = byClass(root, 'bcv-panel');
  assert.equal(panel.hidden, true);
  assert.equal(button(controls, 'group:solid').hidden, false);
  button(controls, 'layers').click();
  assert.equal(panel.hidden, false);
  assert.equal(button(controls, 'layers').getAttribute('aria-expanded'), 'true');
  button(controls, 'layers').click();
  assert.equal(panel.hidden, true);
});

test('expanded layout: panel always shown, inline group toggles and layers button hidden', () => {
  const { controls, root } = setup(PARCEL_RECORDS(), { height: EXPANDED_VIEW_MIN_HEIGHT });
  assert.equal(byClass(root, 'bcv-panel')[0].hidden, false);
  assert.equal(button(controls, 'layers').hidden, true);
  assert.ok(controls.groupButtons.every(({ btn }) => btn.hidden));
});

test('the layout follows the root size on applyViewMode()', () => {
  const { controls, root } = setup(PARCEL_RECORDS(), { height: 300 });
  const [panel] = byClass(root, 'bcv-panel');
  root.clientHeight = 900;
  controls.applyViewMode();
  assert.equal(panel.hidden, false);
  root.clientHeight = 300;
  controls.applyViewMode();
  assert.equal(panel.hidden, true);
});

test('panel: groups with counts, kind sub-lists only when a group has several kinds', () => {
  const { root } = setup(PARCEL_RECORDS());
  const groups = byClass(root, 'bcv-group');
  assert.deepEqual(groups.map(g => g.dataset.group), ['solid', 'surface', 'parcel']);
  assert.match(groups[2].allText, /Parcels \(3\)/);
  const kinds = groups[2].findAll(el => el.className === 'bcv-kind-header').map(h => h.allText);
  assert.deepEqual(kinds, ['Created (1)', 'Former Tenure (2)']);
  assert.equal(groups[0].findAll(el => el.className === 'bcv-kind').length, 0, 'single-kind group lists features directly');
  assert.deepEqual(byClass(root, 'bcv-feature-name').map(n => n.textContent), ['Lot 800 solid', 'Ground', 'Lot 800', 'Lot 7', 'Lot 8']);
});

test('select-all checkboxes are checked, unchecked or indeterminate', () => {
  const { root } = setup(PARCEL_RECORDS());
  const solid = checkboxByKey(root, 'group:solid');
  const surface = checkboxByKey(root, 'group:surface');
  const parcel = checkboxByKey(root, 'group:parcel');
  assert.deepEqual([solid.checked, solid.indeterminate], [true, false]);
  assert.deepEqual([surface.checked, surface.indeterminate], [false, false]);
  assert.deepEqual([parcel.checked, parcel.indeterminate], [false, true]);
});

test('checking a kind shows all its features and updates the group checkbox', () => {
  const { root, calls } = setup(PARCEL_RECORDS());
  const formerTenure = checkboxByKey(root, 'kind:parcel:parcel-former-tenure');
  formerTenure.checked = true;
  formerTenure.dispatch('change');
  assert.deepEqual(calls.at(-1), ['setVisible', ['Lot 7', 'Lot 8'], true]);
  const parcel = checkboxByKey(root, 'group:parcel');
  assert.deepEqual([parcel.checked, parcel.indeterminate], [true, false]);
});

test('a feature checkbox toggles just that feature; its zoom button zooms to it', () => {
  const { root, calls } = setup(PARCEL_RECORDS());
  const lot7 = checkboxByKey(root, 'feature:3');
  lot7.checked = true;
  lot7.dispatch('change');
  assert.deepEqual(calls.at(-1), ['setVisible', ['Lot 7'], true]);

  const zoomButtons = byClass(root, 'bcv-zoom-to');
  assert.equal(zoomButtons.length, 5);
  assert.equal(zoomButtons[2].getAttribute('aria-label'), 'Zoom to Lot 800');
  zoomButtons[2].click();
  assert.deepEqual(calls.at(-1), ['zoomTo', 'Lot 800']);
});

test('a group checkbox click does not toggle its collapsible section', () => {
  const { root } = setup(PARCEL_RECORDS());
  let stopped = false;
  const checkbox = checkboxByKey(root, 'group:solid');
  checkbox.listeners.click.forEach(l => l({ stopPropagation: () => { stopped = true; } }));
  assert.equal(stopped, true);
});

test('collapsed sections and keyboard focus survive a refresh', () => {
  const { root, controls } = setup(PARCEL_RECORDS());
  byClass(root, 'bcv-group').find(g => g.dataset.group === 'surface').open = false;
  checkboxByKey(root, 'feature:0').focus();
  controls.refresh();
  assert.equal(byClass(root, 'bcv-group').find(g => g.dataset.group === 'surface').open, false);
  assert.equal(byClass(root, 'bcv-group').find(g => g.dataset.group === 'parcel').open, true);
  assert.equal(dom.doc.activeElement, checkboxByKey(root, 'feature:0'), 'focus moves to the re-rendered checkbox');
});

test('destroy removes the toolbar and panel', () => {
  const { root, controls } = setup(PARCEL_RECORDS());
  controls.destroy();
  assert.equal(root.children.length, 0);
});
