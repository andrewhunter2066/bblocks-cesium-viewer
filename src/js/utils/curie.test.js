// Copied from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/curie.test.js
// (unchanged apart from this header). Port later upstream fixes by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandCurie, valuesMatch } from './curie.js';

const CONTEXT = {
  'wa-parcel-state': 'https://linked.data.gov.au/def/csdm/wa-parcel-state/',
  util: 'http://example.org/utility-status#',
};

test('expandCurie expands a known prefix', () => {
  assert.equal(
    expandCurie('wa-parcel-state:former-tenure', CONTEXT),
    'https://linked.data.gov.au/def/csdm/wa-parcel-state/former-tenure'
  );
});

test('expandCurie leaves a bare literal unchanged', () => {
  assert.equal(expandCurie('decommissioned', CONTEXT), 'decommissioned');
});

test('expandCurie leaves an already-absolute URI unchanged (http/https are never context keys)', () => {
  assert.equal(
    expandCurie('http://example.org/utility-status#planned', CONTEXT),
    'http://example.org/utility-status#planned'
  );
});

test('expandCurie leaves an unknown prefix unchanged', () => {
  assert.equal(expandCurie('urn:not-in-context', CONTEXT), 'urn:not-in-context');
});

test('expandCurie passes non-string values through untouched', () => {
  assert.equal(expandCurie(42, CONTEXT), 42);
  assert.equal(expandCurie(null, CONTEXT), null);
});

test('valuesMatch matches a literal candidate against a literal value', () => {
  assert.equal(valuesMatch('decommissioned', ['decommissioned'], CONTEXT), true);
  assert.equal(valuesMatch('active', ['decommissioned'], CONTEXT), false);
});

test('valuesMatch matches a CURIE property value against a CURIE candidate', () => {
  assert.equal(
    valuesMatch('wa-parcel-state:former-tenure', ['wa-parcel-state:former-tenure'], CONTEXT),
    true
  );
});

test('valuesMatch matches a CURIE property value against an already-expanded URI candidate', () => {
  assert.equal(
    valuesMatch(
      'wa-parcel-state:former-tenure',
      ['https://linked.data.gov.au/def/csdm/wa-parcel-state/former-tenure'],
      CONTEXT
    ),
    true
  );
});

test('valuesMatch matches a full-URI property value against a CURIE candidate', () => {
  assert.equal(
    valuesMatch('http://example.org/utility-status#planned', ['util:planned'], CONTEXT),
    true
  );
});

test('valuesMatch checks every element of an array-valued property', () => {
  assert.equal(valuesMatch(['active', 'util:hazardous'], ['util:hazardous'], CONTEXT), true);
  assert.equal(valuesMatch(['active', 'util:hazardous'], ['util:planned'], CONTEXT), false);
});

test('valuesMatch is false for a missing property value', () => {
  assert.equal(valuesMatch(undefined, ['decommissioned'], CONTEXT), false);
  assert.equal(valuesMatch(null, ['decommissioned'], CONTEXT), false);
});
