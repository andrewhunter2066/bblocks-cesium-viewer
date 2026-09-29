import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CESIUM_MODULE_URL,
  WIDGETS_CSS_URL,
  importCesium,
  injectWidgetsCss,
  resolveCesium,
} from './cesium-loader.js';
import { CESIUM_BASE_URL, CESIUM_VERSION } from './cesium-version.js';
import { FakeDocument } from '../test-support/fake-dom.js';

afterEach(() => {
  delete globalThis.CESIUM_BASE_URL;
});

test('CDN URLs are pinned to CESIUM_VERSION on jsDelivr', () => {
  assert.equal(CESIUM_BASE_URL, `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`);
  assert.equal(CESIUM_MODULE_URL, `${CESIUM_BASE_URL}index.js`);
  assert.equal(WIDGETS_CSS_URL, `${CESIUM_BASE_URL}Widgets/widgets.css`);
  assert.match(CESIUM_VERSION, /^\d+\.\d+\.\d+$/, 'exact version, not a range');
});

test('importCesium sets CESIUM_BASE_URL before importing the CDN module', async () => {
  const fakeCesium = { VERSION: CESIUM_VERSION };
  let baseUrlAtImport;
  const result = await importCesium(async url => {
    baseUrlAtImport = globalThis.CESIUM_BASE_URL;
    assert.equal(url, CESIUM_MODULE_URL);
    return fakeCesium;
  });
  assert.equal(baseUrlAtImport, CESIUM_BASE_URL);
  assert.equal(result, fakeCesium);
});

test('importCesium keeps a CESIUM_BASE_URL the host already set', async () => {
  globalThis.CESIUM_BASE_URL = 'https://host.example/cesium/';
  await importCesium(async () => ({}));
  assert.equal(globalThis.CESIUM_BASE_URL, 'https://host.example/cesium/');
});

test('resolveCesium loads directly when the host has no depResolver', async () => {
  const imported = [];
  await resolveCesium({}, async url => { imported.push(url); return {}; });
  await resolveCesium(undefined, async url => { imported.push(url); return {}; });
  assert.deepEqual(imported, [CESIUM_MODULE_URL, CESIUM_MODULE_URL]);
});

test('resolveCesium shares Cesium through context.depResolver', async () => {
  const calls = [];
  const shared = { shared: true };
  const depResolver = {
    async resolve(opts) {
      calls.push(opts);
      return shared;
    },
  };
  const result = await resolveCesium({ depResolver }, async () => assert.fail('must not load itself'));
  assert.equal(result, shared);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'cesium');
  assert.equal(calls[0].version, CESIUM_VERSION);
  assert.equal(calls[0].range, `~${CESIUM_VERSION}`);
  assert.equal(typeof calls[0].load, 'function');
});

test('the depResolver load() callback imports from the CDN', async () => {
  let loadFn;
  const depResolver = { resolve: async opts => { loadFn = opts.load; return null; } };
  const imported = [];
  await resolveCesium({ depResolver }, async url => { imported.push(url); return {}; });
  await loadFn();
  assert.deepEqual(imported, [CESIUM_MODULE_URL]);
});

test('injectWidgetsCss adds one stylesheet link per document', () => {
  const doc = new FakeDocument();
  injectWidgetsCss(doc);
  injectWidgetsCss(doc);
  const links = doc.head.children.filter(c => c.tagName === 'LINK');
  assert.equal(links.length, 1);
  assert.equal(links[0].rel, 'stylesheet');
  assert.equal(links[0].href, WIDGETS_CSS_URL);
});

test('injectWidgetsCss is a no-op without a document', () => {
  assert.doesNotThrow(() => injectWidgetsCss(undefined));
});
