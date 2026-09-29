// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/rules.test.js
// (unchanged apart from this header). Port later upstream fixes by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPath, resolveLabel, classifyFeatures, resolveFlattenZ } from './rules.js';

test('getPath resolves a dot-path and returns undefined for a missing segment', () => {
  const obj = { properties: { parcelState: 'wa-parcel-state:created' } };
  assert.equal(getPath(obj, 'properties.parcelState'), 'wa-parcel-state:created');
  assert.equal(getPath(obj, 'properties.missing.deeper'), undefined);
  assert.equal(getPath(obj, 'nope'), undefined);
});

test('resolveLabel prefers the first configured property that resolves to a usable value', () => {
  const feature = { id: 'uuid:1', properties: { appellation: { label: 'Lot 800' }, name: 'unused' } };
  const label = resolveLabel(feature, {
    properties: ['properties.appellation.label', 'properties.name'],
    fallback: 'id',
  });
  assert.equal(label, 'Lot 800');
});

test('resolveLabel falls through empty/missing properties to a later one', () => {
  const feature = { id: 'uuid:2', properties: { appellation: '', name: 'DP 12346' } };
  const label = resolveLabel(feature, {
    properties: ['properties.appellation', 'properties.name'],
    fallback: 'id',
  });
  assert.equal(label, 'DP 12346');
});

test('resolveLabel reads a { label } object shape without the config naming that convention', () => {
  const feature = { id: 'uuid:3', properties: { appellation: { label: 'Lot 1' } } };
  assert.equal(resolveLabel(feature, { properties: ['properties.appellation'] }), 'Lot 1');
});

test('resolveLabel falls back to the configured fallback path, then feature.id', () => {
  const feature = { id: 'uuid:4', properties: {} };
  assert.equal(resolveLabel(feature, { properties: ['properties.name'], fallback: 'id' }), 'uuid:4');
  assert.equal(resolveLabel(feature, {}), 'uuid:4');
});

const NON_CADASTRAL_DATA = {
  '@context': { util: 'http://example.org/utility-status#' },
  solids: [
    {
      type: 'FeatureCollection',
      features: [
        { id: 'pipe-1', properties: { assetCondition: 'decommissioned' } },
        { id: 'pipe-2', properties: { assetCondition: 'util:hazardous' } },
        { id: 'pipe-3', properties: { assetCondition: 'util:planned' } },
        { id: 'pipe-4', properties: {} },
      ],
    },
  ],
};

const NON_CADASTRAL_CONFIG = {
  defaults: { style: { opacity: 1 } },
  rules: [
    {
      source: 'solids',
      kind: 'pipe',
      match: { property: 'properties.assetCondition', values: ['decommissioned'] },
      initiallyVisible: false,
      style: { color: '#8a8f89', opacity: 0.25 },
    },
    {
      source: 'solids',
      kind: 'pipe',
      match: { property: 'properties.assetCondition', values: ['util:hazardous'] },
      style: { color: '#c23b22' },
    },
    {
      source: 'solids',
      kind: 'pipe',
      match: { property: 'properties.assetCondition', values: ['http://example.org/utility-status#planned'] },
      style: { color: '#3b5bab' },
      elevation: 'flatten',
    },
    { source: 'solids', kind: 'pipe', geometry: 'solid-topology' },
  ],
};

test('classifyFeatures matches literal, CURIE, and full-URI values with no shared vocabulary', () => {
  const descriptors = classifyFeatures(NON_CADASTRAL_DATA, NON_CADASTRAL_CONFIG);
  const byId = Object.fromEntries(descriptors.map(d => [d.feature.id, d]));

  assert.equal(byId['pipe-1'].initiallyVisible, false);
  assert.equal(byId['pipe-1'].style.color, '#8a8f89');

  assert.equal(byId['pipe-2'].style.color, '#c23b22');
  assert.equal(byId['pipe-2'].initiallyVisible, true); // no initiallyVisible on this rule -> default true

  assert.equal(byId['pipe-3'].style.color, '#3b5bab');
  assert.equal(byId['pipe-3'].elevation, 'flatten');

  // pipe-4 has no matching property at all -> falls through to the catch-all rule.
  assert.equal(byId['pipe-4'].geometry, 'solid-topology');
  assert.equal(byId['pipe-4'].elevation, 'preserve');
});

test('classifyFeatures applies config.defaults.style under a rule\'s own style', () => {
  const descriptors = classifyFeatures(NON_CADASTRAL_DATA, NON_CADASTRAL_CONFIG);
  const pipe2 = descriptors.find(d => d.feature.id === 'pipe-2');
  assert.equal(pipe2.style.opacity, 1); // inherited from config.defaults.style
  assert.equal(pipe2.style.color, '#c23b22'); // overridden by the rule
});

test('classifyFeatures leaves a feature unclassified when no rule for its source matches', () => {
  const data = { solids: [{ features: [{ id: 'x', properties: { assetCondition: 'other' } }] }] };
  const config = {
    rules: [
      { source: 'solids', kind: 'pipe', match: { property: 'properties.assetCondition', values: ['decommissioned'] } },
    ],
  };
  assert.deepEqual(classifyFeatures(data, config), []);
});

test('classifyFeatures reads @context from the document by default', () => {
  const descriptors = classifyFeatures(NON_CADASTRAL_DATA, {
    rules: [{ source: 'solids', kind: 'pipe', match: { property: 'properties.assetCondition', values: ['util:hazardous'] } }],
  });
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].feature.id, 'pipe-2');
});

test('classifyFeatures normalizes a bare-Feature source entry, not just FeatureCollection wrappers', () => {
  const data = { parcels: [{ type: 'Feature', id: 'p1', properties: {} }] };
  const config = { rules: [{ source: 'parcels', kind: 'parcel' }] };
  const descriptors = classifyFeatures(data, config);
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].feature.id, 'p1');
});

test('resolveFlattenZ returns 0 for the "flatten" shorthand', () => {
  assert.equal(resolveFlattenZ('flatten'), 0);
});

test('resolveFlattenZ returns the configured datum for { flattenTo }', () => {
  assert.equal(resolveFlattenZ({ flattenTo: 12.5 }), 12.5);
  assert.equal(resolveFlattenZ({ flattenTo: 0 }), 0);
});

test('resolveFlattenZ returns null for "preserve", the every-rule default', () => {
  assert.equal(resolveFlattenZ('preserve'), null);
});

test('resolveFlattenZ returns null for anything unrecognised, rather than guessing', () => {
  assert.equal(resolveFlattenZ(undefined), null);
  assert.equal(resolveFlattenZ(null), null);
  assert.equal(resolveFlattenZ('something-else'), null);
  assert.equal(resolveFlattenZ({ flattenTo: 'not-a-number' }), null);
  assert.equal(resolveFlattenZ({}), null);
});

test('classifyFeatures elevation flows through to the descriptor unchanged, for resolveFlattenZ to interpret', () => {
  const data = { parcels: [{ id: 'p1', properties: {} }] };
  const flattenRule = { source: 'parcels', kind: 'parcel', elevation: { flattenTo: 3 } };
  const [descriptor] = classifyFeatures(data, { rules: [flattenRule] });
  assert.equal(resolveFlattenZ(descriptor.elevation), 3);
});

test('classifyFeatures defaults group to the rule\'s own kind when group is not set', () => {
  const data = { parcels: [{ id: 'p1', properties: {} }] };
  const [descriptor] = classifyFeatures(data, { rules: [{ source: 'parcels', kind: 'parcel' }] });
  assert.equal(descriptor.group, 'parcel');
  assert.equal(descriptor.kindLabel, undefined);
});

test('classifyFeatures lets several kinds share one group, each keeping its own kindLabel', () => {
  const data = {
    parcels: [
      { id: 'p1', properties: { parcelState: 'created' } },
      { id: 'p2', properties: { parcelState: 'former-tenure' } },
    ],
  };
  const config = {
    rules: [
      {
        source: 'parcels', kind: 'parcel-former-tenure', group: 'parcel', kindLabel: 'Former Tenure',
        match: { property: 'properties.parcelState', values: ['former-tenure'] },
      },
      { source: 'parcels', kind: 'parcel-created', group: 'parcel', kindLabel: 'Created' },
    ],
  };
  const descriptors = classifyFeatures(data, config);
  const byId = Object.fromEntries(descriptors.map(d => [d.feature.id, d]));
  assert.equal(byId.p1.group, 'parcel');
  assert.equal(byId.p1.kind, 'parcel-created');
  assert.equal(byId.p1.kindLabel, 'Created');
  assert.equal(byId.p2.group, 'parcel');
  assert.equal(byId.p2.kind, 'parcel-former-tenure');
  assert.equal(byId.p2.kindLabel, 'Former Tenure');
});
