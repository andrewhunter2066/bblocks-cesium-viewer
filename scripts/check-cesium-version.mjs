#!/usr/bin/env node
// Guards against the `cesium` devDependency (kept only so editors/tsc can resolve the same version
// locally) drifting from the CESIUM_VERSION literal the plugin actually fetches from the CDN at
// runtime. Run as `prebuild`.
import { readFileSync } from 'node:fs';

const rootDir = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', rootDir), 'utf8'));
const devDependencyVersion = pkg.devDependencies?.cesium;

const versionSource = readFileSync(new URL('src/js/utils/cesium-version.js', rootDir), 'utf8');
const literalVersion = versionSource.match(/export const CESIUM_VERSION = '([^']+)';/)?.[1];

if (!devDependencyVersion || !literalVersion) {
  console.error(
    'check-cesium-version: could not read both versions '
    + `(devDependency: ${devDependencyVersion ?? '<missing>'}, literal: ${literalVersion ?? '<missing>'})`
  );
  process.exit(1);
}

if (devDependencyVersion !== literalVersion) {
  console.error(
    `check-cesium-version: package.json's "cesium" devDependency (${devDependencyVersion}) does not `
    + `match CESIUM_VERSION in src/js/utils/cesium-version.js (${literalVersion}). Keep both in sync, `
    + 'as an exact version (no range).'
  );
  process.exit(1);
}
