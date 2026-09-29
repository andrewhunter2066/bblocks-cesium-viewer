// Detects a topo-feature (https://github.com/ogcincubator/topo-feature) topology document that
// can be placed on a globe. isTopoFeatureMultiCollection() and collectionFeatures() are adapted
// from ogcincubator/bblocks-viewer-topo-feature-plugin@d94018b src/utils/detect-topo.js; the
// georeferencing check is this plugin's own.
const TOPO_KEYS = ['points', 'edges', 'rings', 'faces', 'shells', 'solids'];

// A TOPO_KEYS array entry is either a nested FeatureCollection wrapper (`{ features: [...] }`) or
// a bare Feature — both conventions occur in real topo-feature registers.
function isCollectionEntry(item) {
  return Array.isArray(item?.features) || item?.type === 'Feature';
}

export function collectionFeatures(item) {
  return Array.isArray(item?.features) ? item.features : [item];
}

export function isTopoFeatureMultiCollection(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return TOPO_KEYS.some(k => Array.isArray(data[k]) && data[k].some(isCollectionEntry));
}

// True for a GeoJSON Point geometry whose first two coordinates are a plausible WGS84 lon/lat.
// Only `geometry` counts: projected coordinates in `place` are ignored (see PLAN.md).
export function isGeographicPoint(geometry) {
  if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) return false;
  const [lon, lat, height] = geometry.coordinates;
  return Number.isFinite(lon) && Number.isFinite(lat)
    && Math.abs(lon) <= 180 && Math.abs(lat) <= 90
    && (height === undefined || Number.isFinite(height));
}

export function hasGeographicPoints(data) {
  if (!Array.isArray(data?.points)) return false;
  return data.points.some(entry => collectionFeatures(entry).some(f => isGeographicPoint(f?.geometry)));
}

// The globe view claims a topo-feature document only if at least one point feature carries a
// WGS84 `geometry`; otherwise there is nothing to place on the globe and no tab is offered.
export function isGeoreferencedTopoFeature(data) {
  return isTopoFeatureMultiCollection(data) && hasGeographicPoints(data);
}
