import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import TopoFeatureCesiumPlugin from './topo-feature-cesium-plugin.js';
import { TopoFeatureCesiumPlugin as NamedExport } from './index.js';
import { installFakeDocument } from './test-support/fake-dom.js';
import { createFakeCesium } from './test-support/fake-cesium.js';
import { CESIUM_VIEWER_CONFIG_ROLE } from './utils/load-config.js';

const georeferenced = JSON.stringify({
  points: [{
    type: 'FeatureCollection',
    features: [{ id: 'a', type: 'Feature', geometry: { type: 'Point', coordinates: [115.8, -31.9, 17.5] } }],
  }],
});

const candidate = (overrides = {}) => ({
  type: 'application/json', content: georeferenced, url: null, label: 'JSON', ...overrides,
});

test('index.js exports the plugin class by name', () => {
  assert.equal(NamedExport, TopoFeatureCesiumPlugin);
});

test('static plugin contract', () => {
  assert.ok(TopoFeatureCesiumPlugin.supportedTypes.length > 0);
  assert.ok(TopoFeatureCesiumPlugin.supportedTypes.includes('application/json'));
  assert.equal(TopoFeatureCesiumPlugin.viewName, 'Globe');
  assert.equal(typeof TopoFeatureCesiumPlugin.icon, 'string');
});

test('constructor tolerates empty and null-content candidates', () => {
  assert.equal(new TopoFeatureCesiumPlugin([]).matches(), false);
  assert.equal(new TopoFeatureCesiumPlugin([candidate({ content: null })]).matches(), false);
  assert.equal(new TopoFeatureCesiumPlugin(undefined, undefined).matches(), false);
});

test('matches a georeferenced topo-feature document', () => {
  assert.equal(new TopoFeatureCesiumPlugin([candidate()]).matches(), true);
});

test('picks the first usable candidate among several representations', () => {
  const plugin = new TopoFeatureCesiumPlugin([
    candidate({ type: 'text/turtle', content: '@prefix x: <y> .', label: 'Turtle' }),
    candidate({ content: '{not json', label: 'broken' }),
    candidate({ type: 'application/ld+json', label: 'JSON-LD' }),
  ]);
  assert.equal(plugin.matches(), true);
  assert.equal(plugin._pickCandidate().label, 'JSON-LD');
});

// --- render()/destroy() lifecycle, against a fake DOM and a fake Cesium namespace ---

// A plugin whose Cesium load is controlled by the test instead of hitting the CDN.
function pluginWithCesium(loadCesium) {
  const plugin = new TopoFeatureCesiumPlugin([candidate()]);
  plugin._loadCesium = loadCesium;
  return plugin;
}

const CONFIG_REF = 'https://register.example/viewer-config.json';

// A plugin whose block declares a Cesium viewer config at CONFIG_REF.
function configuredPlugin(Cesium) {
  const context = { bblock: { resources: [{ role: CESIUM_VIEWER_CONFIG_ROLE, ref: CONFIG_REF }] } };
  const plugin = new TopoFeatureCesiumPlugin([candidate()], context);
  plugin._loadCesium = async () => Cesium;
  return plugin;
}

// Runs fn with globalThis.fetch replaced, as the plugin's real config loading uses it.
async function withFetch(fetchImpl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

// A plugin rendering parcel.json (solid, surface, parcels) with the built-in rules.
function uiPlugin(Cesium) {
  const content = readFileSync(new URL('../../harness/fixtures/parcel.json', import.meta.url), 'utf8');
  const plugin = new TopoFeatureCesiumPlugin([candidate({ content })]);
  plugin._loadCesium = async () => Cesium;
  return plugin;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function withQuietConsoleError(fn) {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return logged;
}

test('lifecycle', async t => {
  let dom;
  t.beforeEach(() => { dom = installFakeDocument(); });
  t.afterEach(() => { dom.restore(); });

  await t.test('render mounts a token-free Cesium viewer inside el', async () => {
    const Cesium = createFakeCesium();
    const el = dom.doc.body.appendChild(dom.doc.createElement('div'));
    const plugin = pluginWithCesium(async () => Cesium);

    await plugin.render(el);

    assert.equal(Cesium.created.viewers.length, 1);
    const viewer = Cesium.created.viewers[0];
    assert.equal(viewer.container.className, 'bcv-viewer');
    assert.equal(viewer.container.parent.className, 'bcv-root');
    assert.equal(viewer.container.parent.parent, el, 'the plugin root is a child of el');
    assert.equal(el.style.position, 'relative');
    assert.equal(Cesium.Ion.defaultAccessToken, '', 'demo ion token blanked before the viewer is built');
    assert.equal(viewer.options.geocoder, false);
    assert.ok(dom.doc.getElementById('bblocks-cesium-viewer-widgets-css'), 'widgets.css injected');
  });

  await t.test('render draws the document and frames the camera on it', async () => {
    const Cesium = createFakeCesium();
    const el = dom.doc.createElement('div');
    const plugin = pluginWithCesium(async () => Cesium);

    await plugin.render(el);

    const viewer = Cesium.created.viewers[0];
    // The candidate is a single georeferenced point: bare points → one point collection.
    assert.equal(viewer.scene.primitives.list.length, 1);
    assert.deepEqual(viewer.scene.primitives.list[0].points[0].position, { lon: 115.8, lat: -31.9, height: 17.5 });
    assert.equal(viewer.camera.calls[0][0], 'viewBoundingSphere');
  });

  await t.test('a per-block config sets token, basemap, terrain and camera', async () => {
    const Cesium = createFakeCesium();
    const config = {
      cesium: { ionToken: 'tok', basemap: 'ion', terrain: 'ion', camera: { longitude: 115.8, latitude: -31.9, height: 500 } },
    };
    const plugin = configuredPlugin(Cesium);

    await withFetch(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(config) }), () => plugin.render(dom.doc.createElement('div')));

    const viewer = Cesium.created.viewers[0];
    assert.equal(Cesium.Ion.defaultAccessToken, 'tok');
    assert.equal(viewer.options.baseLayer.imageryProvider, 'ion-world-imagery');
    assert.equal(viewer.options.terrain.name, 'ion-world-terrain');
    assert.deepEqual(viewer.camera.calls.map(c => c[0]), ['setView'], 'configured camera, not framing');
    assert.equal(plugin._config.ref, CONFIG_REF);
  });

  await t.test('config problems are logged as warnings and rendering carries on', async () => {
    const Cesium = createFakeCesium();
    const plugin = configuredPlugin(Cesium);
    const warned = [];
    const originalWarn = console.warn;
    console.warn = message => warned.push(message);
    try {
      await withFetch(async () => ({ ok: false, status: 404, text: async () => '' }), () => plugin.render(dom.doc.createElement('div')));
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(Cesium.created.viewers.length, 1);
    assert.equal(Cesium.Ion.defaultAccessToken, '');
    assert.match(warned[0], /HTTP 404/);
    assert.equal(Cesium.created.viewers[0].camera.calls[0][0], 'viewBoundingSphere');
  });

  await t.test('the UI is mounted with the plugin stylesheet, once per document', async () => {
    const Cesium = createFakeCesium();
    const first = pluginWithCesium(async () => Cesium);
    await first.render(dom.doc.createElement('div'));
    await pluginWithCesium(async () => Cesium).render(dom.doc.createElement('div'));
    const styles = dom.doc.head.children.filter(c => c.id === 'bblocks-cesium-viewer-css');
    assert.equal(styles.length, 1);
    assert.match(styles[0].textContent, /\.bcv-root/);
    assert.ok(first._root.find(c => c.className === 'bcv-toolbar'));
  });

  await t.test('edges, labels and feature visibility drive the primitives', async () => {
    const Cesium = createFakeCesium();
    const plugin = uiPlugin(Cesium);
    await plugin.render(dom.doc.createElement('div'));
    const [solid, surface] = plugin._records;
    const { buttons } = plugin._controls;

    assert.deepEqual([solid.fill.show, solid.outline.show, solid.labelGraphic.show], [true, true, false]);
    buttons.labels.click();
    assert.deepEqual([solid.labelGraphic.show, surface.labelGraphic.show], [true, true]);
    buttons.edges.click();
    assert.equal(solid.outline.show, false);
    buttons['group:solid'].click();
    assert.deepEqual([solid.fill.show, solid.labelGraphic.show], [false, false]);
    buttons.edges.click();
    assert.equal(solid.outline.show, false, 'a hidden feature keeps its outline hidden');
    assert.ok(plugin._viewer.scene.renderRequests > 3, 'each change requests a render');
  });

  await t.test('zoom to extent flies to the visible features only', async () => {
    const Cesium = createFakeCesium();
    const plugin = uiPlugin(Cesium);
    await plugin.render(dom.doc.createElement('div'));
    const [solid, ...others] = plugin._records;
    others.forEach(r => { r.visible = false; });
    plugin._controls.buttons.extent.click();
    const [call, sphere] = plugin._viewer.camera.calls.at(-1);
    assert.equal(call, 'flyToBoundingSphere');
    assert.deepEqual(sphere.points, solid.positions);
  });

  await t.test('fullscreen targets the plugin root and the button follows it', async () => {
    const Cesium = createFakeCesium();
    const plugin = uiPlugin(Cesium);
    const el = dom.doc.createElement('div');
    await plugin.render(el);
    plugin._controls.buttons.fullscreen.click();
    assert.equal(dom.doc.fullscreenElement, plugin._root);
    assert.equal(plugin._controls.buttons.fullscreen.title, 'Exit fullscreen');
    plugin._controls.buttons.fullscreen.click();
    assert.equal(dom.doc.fullscreenElement, null);
    assert.equal(plugin._controls.buttons.fullscreen.title, 'Fullscreen');
  });

  await t.test('destroy leaves fullscreen and removes its listeners', async () => {
    const Cesium = createFakeCesium();
    const plugin = uiPlugin(Cesium);
    const el = dom.doc.createElement('div');
    await plugin.render(el);
    plugin._controls.buttons.fullscreen.click();
    assert.equal(dom.doc.listenerCount('fullscreenchange'), 1);
    plugin.destroy(el);
    assert.equal(dom.doc.fullscreenElement, null);
    assert.equal(dom.doc.listenerCount('fullscreenchange'), 0);
    assert.equal(el.children.length, 0);
  });

  await t.test('destroy tears down the viewer and empties el', async () => {
    const Cesium = createFakeCesium();
    const el = dom.doc.createElement('div');
    const plugin = pluginWithCesium(async () => Cesium);
    await plugin.render(el);
    const viewer = Cesium.created.viewers[0];

    plugin.destroy(el);

    assert.equal(viewer.destroyCount, 1);
    assert.equal(el.children.length, 0);
    assert.equal(plugin._viewer, null);
  });

  await t.test('destroy is idempotent and safe before render', async () => {
    const Cesium = createFakeCesium();
    const el = dom.doc.createElement('div');
    const plugin = pluginWithCesium(async () => Cesium);
    assert.doesNotThrow(() => plugin.destroy(el));
    await plugin.render(el);
    plugin.destroy(el);
    plugin.destroy(el);
    plugin.destroy(undefined);
    assert.equal(Cesium.created.viewers[0].destroyCount, 1);
  });

  await t.test('destroy while Cesium is still loading creates no viewer', async () => {
    const Cesium = createFakeCesium();
    const load = deferred();
    const el = dom.doc.createElement('div');
    const plugin = pluginWithCesium(() => load.promise);

    const rendering = plugin.render(el);
    plugin.destroy(el);
    load.resolve(Cesium);
    await rendering;

    assert.equal(Cesium.created.viewers.length, 0);
    assert.equal(el.children.length, 0);
  });

  await t.test('re-render replaces the previous viewer', async () => {
    const Cesium = createFakeCesium();
    const first = dom.doc.createElement('div');
    const second = dom.doc.createElement('div');
    const plugin = pluginWithCesium(async () => Cesium);

    await plugin.render(first);
    await plugin.render(second);

    assert.equal(Cesium.created.viewers.length, 2);
    assert.equal(Cesium.created.viewers[0].destroyCount, 1);
    assert.equal(Cesium.created.viewers[1].destroyCount, 0);
    assert.equal(first.children.length, 0);
    assert.equal(second.children.length, 1);
  });

  await t.test('a failed CDN load shows an error banner instead of a blank tab', async () => {
    const el = dom.doc.createElement('div');
    const plugin = pluginWithCesium(async () => { throw new Error('network down'); });

    const logged = await withQuietConsoleError(() => plugin.render(el));

    assert.match(el.allText, /Failed to render the globe view \(network down\)/);
    assert.equal(logged.length, 1);
  });

  await t.test('a Viewer construction failure (e.g. no WebGL) shows an error banner', async () => {
    const Cesium = createFakeCesium({ viewerThrows: new Error('WebGL is not supported') });
    const el = dom.doc.createElement('div');
    const plugin = pluginWithCesium(async () => Cesium);

    await withQuietConsoleError(() => plugin.render(el));

    assert.match(el.allText, /WebGL is not supported/);
    assert.equal(el.children.length, 1, 'only the banner remains; the empty container was removed');
  });

  await t.test('render does not load Cesium for a non-matching document', async () => {
    const el = dom.doc.createElement('div');
    const plugin = new TopoFeatureCesiumPlugin([candidate({ content: '{}' })]);
    plugin._loadCesium = async () => assert.fail('must not load Cesium');
    await plugin.render(el);
    assert.equal(el.children.length, 0);
  });
});

test('does not match plain GeoJSON or ungeoreferenced topology', () => {
  const geojson = JSON.stringify({ type: 'Feature', geometry: { type: 'Point', coordinates: [115.8, -31.9] } });
  const projected = JSON.stringify({
    points: [{ features: [{ id: 'a', type: 'Feature', geometry: null, place: { type: 'Point', coordinates: [48136.9, 369943.1] } }] }],
  });
  assert.equal(new TopoFeatureCesiumPlugin([candidate({ content: geojson })]).matches(), false);
  assert.equal(new TopoFeatureCesiumPlugin([candidate({ content: projected })]).matches(), false);
});
