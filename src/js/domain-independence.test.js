// End-to-end rule tests with the harness's real per-block configs, through the same code a render
// uses: config loading (load-config.js), classification (the copied rules.js), geometry
// (topo-geometry.js) and primitives (cesium-scene.js). The utility network — pipes classified by
// assetCondition, no parcels, no cadastral vocabulary — shows the viewer is domain-independent,
// as the Three.js plugin's domain-independence.test.js does for that viewer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CESIUM_VIEWER_CONFIG_ROLE, loadConfig } from './utils/load-config.js';
import { buildTopologyShapes, defaultConfigFor } from './utils/topo-geometry.js';
import { buildScenePrimitives } from './cesium-scene.js';
import { createFakeCesium } from './test-support/fake-cesium.js';

const read = name => readFileSync(new URL(`../../harness/fixtures/${name}`, import.meta.url), 'utf8');

async function renderWithConfig(documentName, configName) {
  const data = JSON.parse(read(documentName));
  const context = { bblock: { resources: [{ role: CESIUM_VIEWER_CONFIG_ROLE, ref: configName }] } };
  const fetchImpl = async ref => ({ ok: true, status: 200, text: async () => read(ref) });
  const loaded = await loadConfig(context, defaultConfigFor(data), fetchImpl);
  const Cesium = createFakeCesium();
  const shapes = buildTopologyShapes(data, loaded.config);
  const { records } = buildScenePrimitives(Cesium, shapes);
  return { Cesium, loaded, shapes, records };
}

const fillOf = record => record.fill.options.geometryInstances[0].options.attributes.color.color;

test('utility network: literal, CURIE and full-URI rules classify each pipe', async () => {
  const { Cesium, loaded, records } = await renderWithConfig('utility-network-georeferenced.json', 'utility-network-config.json');
  assert.deepEqual(loaded.warnings, []);
  const byId = Object.fromEntries(records.map(r => [r.id, r]));

  // Literal "decommissioned": hidden, grey, 25% opaque.
  assert.equal(byId['pipe-a:solid'].visible, false);
  assert.equal(byId['pipe-a:solid'].fill.options.show, false);
  assert.deepEqual([fillOf(byId['pipe-a:solid']).css, fillOf(byId['pipe-a:solid']).alpha], ['#8a8f89', 0.25]);

  // CURIE "util:hazardous", expanded via the document's own @context: red, opaque.
  assert.deepEqual([fillOf(byId['pipe-b:solid']).css, fillOf(byId['pipe-b:solid']).alpha], ['#c23b22', 1]);

  // Full URI ".../utility-status#planned": blue and flattened, i.e. clamped to the ground.
  assert.equal(fillOf(byId['pipe-c:solid']).css, '#3b5bab');
  assert.ok(byId['pipe-c:solid'].fill instanceof Cesium.GroundPrimitive);
  assert.ok(byId['pipe-c:solid'].outline instanceof Cesium.GroundPolylinePrimitive);

  // No match: the catch-all rule.
  assert.equal(fillOf(byId['pipe-d:solid']).css, '#3388ff');
  assert.ok(byId['pipe-d:solid'].fill instanceof Cesium.Primitive);

  assert.ok(records.every(r => r.kind === 'pipe'));
  assert.deepEqual(records.map(r => r.label).sort(), ['Pipe A', 'Pipe B', 'Pipe C', 'Pipe D']);
});

test('utility network: pipes keep their underground heights unless flattened', async () => {
  const { shapes } = await renderWithConfig('utility-network-georeferenced.json', 'utility-network-config.json');
  const heights = id => shapes.renderables.find(r => r.id === id).polygons.flatMap(p => p.outer.map(c => c[2]));
  assert.ok(heights('pipe-d:solid').every(h => h < 0), 'underground');
  assert.ok(heights('pipe-c:solid').every(h => h === 0), 'flattened to the ground');
});

test('parcel: grouped parcel kinds, flattened, with dashed former tenure hidden', async () => {
  const { Cesium, loaded, records } = await renderWithConfig('parcel.json', 'parcel-config.json');
  assert.deepEqual(loaded.warnings, []);
  const parcels = records.filter(r => r.group === 'parcel');
  assert.deepEqual(parcels.map(r => [r.id, r.kind, r.kindLabel, r.visible]), [
    ['parcel-1', 'parcel-created', 'Created', true],
    ['parcel-2', 'parcel-former-tenure', 'Former Tenure', false],
    ['parcel-3', 'parcel-former-tenure', 'Former Tenure', false],
  ]);
  assert.ok(parcels.every(r => r.fill instanceof Cesium.GroundPrimitive), 'elevation: flatten');
  assert.equal(parcels[1].outline.options.appearance.options.material.type, 'PolylineDash');
  assert.equal(parcels[0].outline.options.appearance.options.material.type, 'Color');
  assert.equal(parcels[0].label, 'Lot 800 on Plan DP 431276');

  const solid = records.find(r => r.kind === 'solid');
  assert.equal(fillOf(solid).css, '#960f00');
  const surface = records.find(r => r.kind === 'surface');
  assert.equal(surface.visible, false);
});
