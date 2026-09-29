#!/usr/bin/env node
// Prepares a locally built register (build-local/, written by ./build.sh) for testing in the real
// viewer (./view.sh):
//
// 1. Points the register's view plugin at the local build instead of the published jsDelivr copy.
//    view.sh's bblocks-viewer container serves this whole repository under /register/, so after
//    `npm run build` the plugin is reachable same-origin at
//    http://localhost:9090/register/dist/index.js — no separate server or CORS setup needed.
//
// 2. If a Cesium ion token is set (VITE_CESIUM_ION_TOKEN in the environment or .env.local), gives
//    every block a Globe view configuration with ion imagery and terrain and that token, as a
//    published register's CI would from a secret. The configurations are copies written to the
//    gitignored build-local/ion-configs/; the tracked _sources/ files are never touched. Without a
//    token, any earlier injection is undone.
//
// Usage: npm run local-register [-- <plugin-url>]
// Re-run after every ./build.sh (the postprocessor rewrites build-local/ each time).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import {
  ION_CONFIG_DIR,
  TOKEN_VARIABLE,
  configResourceOf,
  ionConfigFileName,
  parseEnvToken,
  pointAtIonConfig,
  restoreResources,
  withIon,
} from './lib/local-ion.mjs';

const EXPORT_NAME = 'TopoFeatureCesiumPlugin';
const DEFAULT_URL = 'http://localhost:9090/register/dist/index.js';
const repo = new URL('../', import.meta.url);
const registerFile = new URL('build-local/register.json', repo);

const pluginUrl = process.argv[2] ?? DEFAULT_URL;

const readJson = url => JSON.parse(readFileSync(url, 'utf8'));
const writeJson = (url, data) => writeFileSync(url, `${JSON.stringify(data, null, 2)}\n`);

let register;
try {
  register = readJson(registerFile);
} catch (e) {
  console.error(`use-local-plugin: cannot read build-local/register.json (${e.message}). Run ./build.sh first.`);
  process.exit(1);
}

// ─── 1. The view plugin ─────────────────────────────────────────────────────────

const exportsOf = entry => [entry?.export].flat().filter(Boolean);
const isThisPlugin = entry => exportsOf(entry).includes(EXPORT_NAME)
  || /\/bblocks-cesium-viewer@[^/]+\/index\.js$/.test(entry?.url ?? '');

register.viewer ??= {};
register.viewer.viewPlugins ??= [];
const plugins = register.viewer.viewPlugins;
const existing = plugins.filter(isThisPlugin);
if (existing.length) {
  existing.forEach(entry => { entry.url = pluginUrl; });
} else {
  plugins.push({ url: pluginUrl, export: EXPORT_NAME });
}
console.log(`use-local-plugin: ${existing.length ? 'redirected' : 'added'} ${EXPORT_NAME} -> ${pluginUrl}`);

// ─── 2. The ion token ───────────────────────────────────────────────────────────

function readToken() {
  if (process.env[TOKEN_VARIABLE]?.trim()) return { token: process.env[TOKEN_VARIABLE].trim(), source: `$${TOKEN_VARIABLE}` };
  const envFile = new URL('.env.local', repo);
  const token = existsSync(envFile) ? parseEnvToken(readFileSync(envFile, 'utf8')) : '';
  return { token, source: '.env.local' };
}

// Register URLs under the register's base URL (e.g. http://localhost:9090/register/) are files in
// this repository — view.sh serves the repository there.
const baseUrl = register.baseURL ?? 'http://localhost:9090/register/';
const localFile = url => (typeof url === 'string' && url.startsWith(baseUrl) ? new URL(url.slice(baseUrl.length), repo) : null);

const { token, source } = readToken();
const ionDir = new URL(ION_CONFIG_DIR, repo);
rmSync(ionDir, { recursive: true, force: true }); // never leave a stale token behind
if (token) mkdirSync(ionDir, { recursive: true });

let injected = 0;
for (const bblock of register.bblocks ?? []) {
  // The viewer reads a block's resources from register.json and from its json-full document
  // (which it passes to the plugin as context.bblock): keep both in step.
  const docFile = localFile(bblock.documentation?.['json-full']?.url);
  const doc = docFile && existsSync(docFile) ? readJson(docFile) : null;

  bblock.resources = restoreResources(bblock.resources);
  if (doc) doc.resources = restoreResources(doc.resources);

  if (token) {
    const resource = configResourceOf(bblock.resources);
    let config = {};
    if (resource) {
      const file = localFile(resource.ref);
      if (!file || !existsSync(file)) {
        console.warn(`use-local-plugin: ${bblock.itemIdentifier}: cannot read its config ${resource.ref}; leaving it without ion`);
        if (doc) writeJson(docFile, doc);
        continue;
      }
      config = readJson(file);
    }
    const name = ionConfigFileName(bblock.itemIdentifier);
    writeJson(new URL(name, ionDir), withIon(config, token));
    const ionRef = `${baseUrl}${ION_CONFIG_DIR}${name}`;
    bblock.resources = pointAtIonConfig(bblock.resources, ionRef);
    if (doc) doc.resources = pointAtIonConfig(doc.resources, ionRef);
    injected += 1;
  }
  if (bblock.resources.length === 0) delete bblock.resources;
  if (doc) {
    if (doc.resources.length === 0) delete doc.resources;
    writeJson(docFile, doc);
  }
}

writeJson(registerFile, register);
console.log(token
  ? `use-local-plugin: ion token from ${source} (not shown) -> ion imagery and terrain for ${injected} block(s), configs in ${ION_CONFIG_DIR}`
  : 'use-local-plugin: no ion token set -> blocks use their own configs (OpenStreetMap unless they ask for ion)');
