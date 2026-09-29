// Keeps the cesiumViewerConfig building block's JSON Schema and the plugin's config handling in
// step: the block's examples and tests validate (or fail) as named, every config the schema accepts
// loads without warnings, and the schema's enumerations match what the code implements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse as parseYaml } from 'yaml';
import { parseConfig } from './utils/config.js';
import { resolveCesiumOptions } from './utils/cesium-options.js';
import { GEOMETRY_STRATEGIES } from './utils/topo-geometry.js';
import { findConfigResource, CESIUM_VIEWER_CONFIG_ROLE } from './utils/load-config.js';

const repo = new URL('../../', import.meta.url);
const blockDir = new URL('_sources/cesiumViewerConfig/', repo);
const readJson = url => JSON.parse(readFileSync(url, 'utf8'));

const schema = parseYaml(readFileSync(new URL('schema.yaml', blockDir), 'utf8'));
const validate = new Ajv2020({ allErrors: true }).compile(schema);
const errorsOf = config => (validate(config) ? [] : validate.errors.map(e => `${e.instancePath} ${e.message}`));

const examples = parseYaml(readFileSync(new URL('examples.yaml', blockDir), 'utf8')).examples
  .flatMap(example => example.snippets.map(snippet => ({ title: example.title, url: new URL(snippet.ref, blockDir) })));

test('the block has examples, all referenced by file', () => {
  assert.equal(examples.length, 4);
});

for (const { title, url } of examples) {
  test(`example "${title}" is valid and loads without warnings`, () => {
    const config = readJson(url);
    assert.deepEqual(errorsOf(config), []);
    // A published register injects the ion token at build time; examples never contain one.
    assert.equal(config.cesium?.ionToken, undefined, 'no token committed');
    const usesIon = config.cesium?.basemap === 'ion' || config.cesium?.terrain === 'ion';
    const cesium = usesIon ? { ...config.cesium, ionToken: 'injected-at-build-time' } : config.cesium;
    assert.deepEqual(resolveCesiumOptions(cesium).warnings, []);
    assert.equal(parseConfig(config).rules.length, config.rules?.length ?? 0, 'every rule survives parsing');
  });
}

const testsDir = new URL('tests/', blockDir);
for (const name of readdirSync(testsDir).filter(f => f.endsWith('.json'))) {
  const shouldFail = name.endsWith('-fail.json');
  test(`test resource ${name} ${shouldFail ? 'is rejected' : 'is valid'}`, () => {
    const errors = errorsOf(readJson(new URL(name, testsDir)));
    if (shouldFail) assert.ok(errors.length > 0, 'expected a validation error');
    else assert.deepEqual(errors, []);
  });
}

test('invalid Cesium options the schema rejects are also dropped by the plugin, with a warning', () => {
  for (const name of ['http-basemap-fail.json', 'basemap-without-placeholders-fail.json', 'camera-without-height-fail.json', 'unknown-terrain-fail.json']) {
    const { warnings } = resolveCesiumOptions(readJson(new URL(name, testsDir)).cesium);
    assert.equal(warnings.length, 1, name);
  }
});

test('the schema\'s geometry names are exactly the plugin\'s geometry strategies', () => {
  assert.deepEqual([...schema.$defs.rule.properties.geometry.enum].sort(), Object.keys(GEOMETRY_STRATEGIES).sort());
});

test('the schema\'s basemap and terrain names are the ones the plugin accepts', () => {
  const basemaps = schema.$defs.cesiumOptions.properties.basemap.oneOf[0].enum;
  const terrains = schema.$defs.cesiumOptions.properties.terrain.enum;
  for (const basemap of basemaps) assert.deepEqual(resolveCesiumOptions({ basemap, ionToken: 't' }).warnings, [], basemap);
  for (const terrain of terrains) assert.deepEqual(resolveCesiumOptions({ terrain, ionToken: 't' }).warnings, [], terrain);
});

test('the demo blocks declare their config under the plugin\'s role, and it validates', () => {
  for (const block of ['parcel', 'utilityNetwork']) {
    const dir = new URL(`_sources/cesiumViewerDemo/${block}/`, repo);
    const resource = findConfigResource(readJson(new URL('bblock.json', dir)));
    assert.equal(resource?.role, CESIUM_VIEWER_CONFIG_ROLE, block);
    assert.deepEqual(errorsOf(readJson(new URL(resource.ref, dir))), [], block);
  }
});
