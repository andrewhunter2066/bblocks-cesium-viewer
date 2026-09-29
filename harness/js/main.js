// Dev harness (npm run dev) driving the real TopoFeatureCesiumPlugin class, imported straight
// from src/js/, against a bundled fixture, an uploaded file or an arbitrary URL — mimicking what the
// bblocks-viewer host does: construct with candidates + context, check matches(), render(el),
// destroy(el) before the next document.
import { TopoFeatureCesiumPlugin } from '../../src/js/index.js';
import { CESIUM_VIEWER_CONFIG_ROLE } from '../../src/js/utils/load-config.js';

// Fixture paths are fetch()ed relative to the page (harness/index.html), not this module.
// All but the two squares are copies of the Three.js plugin's fixtures (see fixtures/README.md).
// A fixture's `config` is applied automatically when it is selected.
const FIXTURES = [
  { label: 'Parcel (solid + open shell + 3 parcels)', file: 'fixtures/parcel.json', config: 'fixtures/parcel-config.json' },
  { label: 'Derived 3D solid (solid + open shell + 3 parcels, below ground)', file: 'fixtures/derived-3d-solid.json' },
  { label: 'Cube', file: 'fixtures/cube.json' },
  { label: 'Cube with void (translucent)', file: 'fixtures/cube-with-void.json' },
  { label: 'Cube with protrusion (face with a hole)', file: 'fixtures/cube-with-protrusion.json' },
  { label: 'Tetrahedron', file: 'fixtures/tetrahedron.json' },
  { label: 'Four units up/down (5 solids)', file: 'fixtures/4-unit-up-down.json' },
  {
    label: 'Utility network, georeferenced (4 pipes, underground)',
    file: 'fixtures/utility-network-georeferenced.json',
    config: 'fixtures/utility-network-config.json',
  },
  { label: 'Georeferenced square (a single ring)', file: 'fixtures/georeferenced-square.json' },
  { label: 'Projected-only square (no match expected)', file: 'fixtures/projected-only-square.json' },
];

const SAMPLE_CONFIGS = [
  { label: 'Parcel rules', file: 'fixtures/parcel-config.json' },
  { label: 'Utility network rules', file: 'fixtures/utility-network-config.json' },
  { label: 'Cesium: OpenTopoMap basemap + camera', file: 'fixtures/cesium-basemap-camera-config.json' },
  { label: 'Cesium: ion imagery + terrain (needs token)', file: 'fixtures/cesium-ion-config.json' },
];

const TOKEN_STORAGE_KEY = 'bblocks-cesium-viewer:ion-token';

const $ = id => document.getElementById(id);
const fixtureSelect = $('fixtureSelect');
const fileInput = $('fileInput');
const urlInput = $('urlInput');
const sampleConfigSelect = $('sampleConfigSelect');
const configFileInput = $('configFileInput');
const configUrlInput = $('configUrlInput');
const tokenInput = $('tokenInput');
const statusEl = $('status');
const host = $('host');

let plugin = null;
// For poking at the live scene from DevTools, e.g. harness.plugin._records
window.harness = { get plugin() { return plugin; } };
let currentDocument = null; // { content, label, mimeType }
let configRef = null; // URL (real or blob:) of the config the plugin fetch()es, as a register would serve it
let configLabel = 'none';
let tokenBlobUrl = null; // the config-with-token blob handed to the plugin, revoked on the next render
let renderSeq = 0;

for (const { label, file } of FIXTURES) fixtureSelect.add(new Option(label, file));
sampleConfigSelect.add(new Option('(none)', ''));
for (const { label, file } of SAMPLE_CONFIGS) sampleConfigSelect.add(new Option(label, file));

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

// Token box (this browser only) wins over .env.local. Neither is ever part of dist/.
function ionToken() {
  const stored = readStoredToken();
  if (stored) return { token: stored, source: 'token box' };
  const fromEnv = import.meta.env.VITE_CESIUM_ION_TOKEN;
  if (fromEnv) return { token: fromEnv, source: '.env.local' };
  return { token: '', source: 'none' };
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

// The config reference the plugin should fetch. With a token, the harness does what a published
// register's build does: injects it into the config as cesium.ionToken (starting from an empty
// config if none is selected) and serves the result — here as a blob: URL.
async function configRefForPlugin() {
  if (tokenBlobUrl) URL.revokeObjectURL(tokenBlobUrl);
  tokenBlobUrl = null;
  const { token } = ionToken();
  if (!token) return configRef;

  let config = {};
  if (configRef) {
    try {
      config = JSON.parse(await fetchText(configRef));
    } catch (e) {
      // Leave an unreadable config for the plugin to report, exactly as it would without a token.
      console.warn(`Harness: could not add the ion token to ${configLabel} (${e.message})`);
      return configRef;
    }
  }
  config = { ...config, cesium: { ...config.cesium, ionToken: token } };
  tokenBlobUrl = URL.createObjectURL(new Blob([JSON.stringify(config)], { type: 'application/json' }));
  return tokenBlobUrl;
}

// Stands in for the host's context: context.bblock carries the config as a `resources` entry,
// as a bblock.json would declare it.
async function buildContext() {
  const ref = await configRefForPlugin();
  const bblock = ref
    ? { resources: [{ role: CESIUM_VIEWER_CONFIG_ROLE, ref, format: 'application/json' }] }
    : null;
  return { bblock, viewerConfig: null };
}

function detectMimeType(name) {
  return name.endsWith('.geojson') ? 'application/geo+json' : 'application/json';
}

async function renderCurrentDocument() {
  const seq = ++renderSeq;
  if (plugin) {
    plugin.destroy(host);
    plugin = null;
  }
  host.replaceChildren();
  if (!currentDocument) return;

  const context = await buildContext();
  if (seq !== renderSeq) return; // superseded by a newer render while the config was prepared

  const { content, label, mimeType } = currentDocument;
  const candidates = [{ type: mimeType, content, url: null, label }];
  const instance = new TopoFeatureCesiumPlugin(candidates, context);

  if (!instance.matches()) {
    statusEl.textContent = `${label}: no match (not a topo-feature document with WGS84 point geometry)`;
    return;
  }

  plugin = instance;
  statusEl.textContent = `${label} — config: ${configLabel} — ion token: ${ionToken().source}`;
  try {
    // Errors from the plugin's own async work surface in the tab/console, as in the real viewer.
    plugin.render(host);
  } catch (e) {
    statusEl.textContent = `${label}: render() threw — ${e.message}`;
    console.error(e);
  }
}

function setDocument(content, label, mimeType = 'application/json') {
  currentDocument = { content, label, mimeType };
  renderCurrentDocument();
}

function setConfig(ref, label) {
  configRef = ref;
  configLabel = ref ? label : 'none';
  configFileInput.value = '';
  configUrlInput.value = '';
  sampleConfigSelect.value = SAMPLE_CONFIGS.some(c => c.file === ref) ? ref : '';
}

async function loadDocumentUrl(url, label, config = null) {
  statusEl.textContent = `Loading ${label}…`;
  try {
    const content = await fetchText(url);
    setConfig(config, config?.split('/').pop());
    setDocument(content, label, detectMimeType(url));
  } catch (e) {
    statusEl.textContent = `Failed to load ${label}: ${e.message}`;
    console.error(e);
  }
}

function loadFixture(file) {
  const fixture = FIXTURES.find(f => f.file === file);
  return loadDocumentUrl(fixture.file, fixture.file.split('/').pop(), fixture.config);
}

fixtureSelect.addEventListener('change', () => loadFixture(fixtureSelect.value));

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  setConfig(null);
  setDocument(await file.text(), file.name, detectMimeType(file.name));
});

$('urlLoad').addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (url) loadDocumentUrl(url, url);
});

sampleConfigSelect.addEventListener('change', () => {
  const file = sampleConfigSelect.value;
  setConfig(file || null, file.split('/').pop());
  renderCurrentDocument();
});

configFileInput.addEventListener('change', () => {
  const file = configFileInput.files[0];
  if (!file) return;
  // A blob: URL is fetch()-able exactly like a register's absolute resource URL.
  setConfig(URL.createObjectURL(file), file.name);
  renderCurrentDocument();
});

$('configUrlLoad').addEventListener('click', () => {
  const url = configUrlInput.value.trim();
  if (!url) return;
  setConfig(url, url);
  renderCurrentDocument();
});

$('configClear').addEventListener('click', () => {
  setConfig(null);
  renderCurrentDocument();
});

tokenInput.value = readStoredToken();

$('tokenSave').addEventListener('click', () => {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenInput.value.trim());
  } catch (e) {
    console.warn('Could not store the ion token in localStorage', e);
  }
  renderCurrentDocument();
});

$('tokenClear').addEventListener('click', () => {
  tokenInput.value = '';
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // storage unavailable — nothing stored to forget
  }
  renderCurrentDocument();
});

$('tabSize').addEventListener('change', e => {
  host.classList.toggle('tab-size', e.target.checked);
});

loadFixture(FIXTURES[0].file);
