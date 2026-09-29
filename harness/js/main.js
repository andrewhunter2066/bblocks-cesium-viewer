// Dev harness (npm run dev) driving the real TopoFeatureCesiumPlugin class, imported straight
// from src/js/, against a bundled fixture, an uploaded file or an arbitrary URL — mimicking what the
// bblocks-viewer host does: construct with candidates + context, check matches(), render(el),
// destroy(el) before the next document.
import { TopoFeatureCesiumPlugin } from '../../src/js/index.js';

// Fixture paths are fetch()ed relative to the page (harness/index.html), not this module.
const FIXTURES = [
  { label: 'Georeferenced square', file: 'fixtures/georeferenced-square.json' },
  { label: 'Projected-only square (no match expected)', file: 'fixtures/projected-only-square.json' },
];

// Role under which a bblock.json `resources` entry carries this plugin's per-block config. The
// definitive constant arrives with the config code in stage 4.
const VIEWER_CONFIG_RESOURCE_ROLE = 'https://github.com/ogcincubator/bblocks-cesium-viewer/role/viewer-config';

const TOKEN_STORAGE_KEY = 'bblocks-cesium-viewer:ion-token';

const $ = id => document.getElementById(id);
const fixtureSelect = $('fixtureSelect');
const fileInput = $('fileInput');
const urlInput = $('urlInput');
const configFileInput = $('configFileInput');
const configUrlInput = $('configUrlInput');
const tokenInput = $('tokenInput');
const statusEl = $('status');
const host = $('host');

let plugin = null;
let currentDocument = null; // { content, label, mimeType }
let configRef = null; // URL (real or blob:) the plugin fetch()es as its config resource
let configLabel = 'none';

for (const { label, file } of FIXTURES) {
  fixtureSelect.add(new Option(label, file));
}

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

// Stands in for the host's context. How the token reaches the plugin is settled in stage 4.
function buildContext() {
  const bblock = configRef
    ? { resources: [{ role: VIEWER_CONFIG_RESOURCE_ROLE, ref: configRef, format: 'application/json' }] }
    : null;
  return { bblock, viewerConfig: null };
}

function detectMimeType(name) {
  return name.endsWith('.geojson') ? 'application/geo+json' : 'application/json';
}

function renderCurrentDocument() {
  if (plugin) {
    plugin.destroy(host);
    plugin = null;
  }
  host.replaceChildren();
  if (!currentDocument) return;

  const { content, label, mimeType } = currentDocument;
  const candidates = [{ type: mimeType, content, url: null, label }];
  const instance = new TopoFeatureCesiumPlugin(candidates, buildContext());

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

function resetConfigState() {
  configRef = null;
  configLabel = 'none';
  configFileInput.value = '';
  configUrlInput.value = '';
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function loadUrl(url, label = url) {
  statusEl.textContent = `Loading ${label}…`;
  try {
    const content = await fetchText(url);
    resetConfigState();
    setDocument(content, label, detectMimeType(url));
  } catch (e) {
    statusEl.textContent = `Failed to load ${label}: ${e.message}`;
    console.error(e);
  }
}

fixtureSelect.addEventListener('change', () => loadUrl(fixtureSelect.value, fixtureSelect.value.split('/').pop()));

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  resetConfigState();
  setDocument(await file.text(), file.name, detectMimeType(file.name));
});

$('urlLoad').addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (url) loadUrl(url);
});

configFileInput.addEventListener('change', () => {
  const file = configFileInput.files[0];
  if (!file) return;
  // A blob: URL is fetch()-able exactly like a register's absolute resource URL.
  configRef = URL.createObjectURL(file);
  configLabel = file.name;
  renderCurrentDocument();
});

$('configUrlLoad').addEventListener('click', () => {
  const url = configUrlInput.value.trim();
  if (!url) return;
  configRef = url;
  configLabel = url;
  renderCurrentDocument();
});

$('configClear').addEventListener('click', () => {
  resetConfigState();
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

loadUrl(FIXTURES[0].file, FIXTURES[0].file.split('/').pop());
