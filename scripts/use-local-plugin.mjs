#!/usr/bin/env node
// Points a locally built register (build-local/register.json, written by ./build.sh) at the local
// plugin build instead of the published jsDelivr copy, for testing in the real viewer (./view.sh).
//
// view.sh's bblocks-viewer container serves this whole repository under /register/, so after
// `npm run build` the plugin is reachable same-origin at
// http://localhost:9090/register/dist/index.js — no separate server or CORS setup needed.
//
// Usage: npm run local-register [-- <plugin-url>]
// Re-run after every ./build.sh (the postprocessor rewrites register.json from
// bblocks-config.yaml each time).
import { readFileSync, writeFileSync } from 'node:fs';

const EXPORT_NAME = 'TopoFeatureCesiumPlugin';
const DEFAULT_URL = 'http://localhost:9090/register/dist/index.js';
const registerFile = new URL('../build-local/register.json', import.meta.url);

const pluginUrl = process.argv[2] ?? DEFAULT_URL;

let register;
try {
  register = JSON.parse(readFileSync(registerFile, 'utf8'));
} catch (e) {
  console.error(`use-local-plugin: cannot read build-local/register.json (${e.message}). Run ./build.sh first.`);
  process.exit(1);
}

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

writeFileSync(registerFile, `${JSON.stringify(register, null, 2)}\n`);
console.log(`use-local-plugin: ${existing.length ? 'redirected' : 'added'} ${EXPORT_NAME} -> ${pluginUrl}`);
