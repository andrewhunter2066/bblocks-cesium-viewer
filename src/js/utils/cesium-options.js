// The Cesium-specific part of a per-block viewer config: the optional top-level `cesium` object,
// alongside the rule engine's `rules`/`defaults`/`kindOrder` (which config.js parses, ignoring
// this key). Like config.js, parsing never throws: an invalid value is dropped with a warning and
// the token-free default is used instead.
//
//   "cesium": {
//     "basemap": "osm" | "ion" | { "url": "https://…/{z}/{x}/{y}.png", "credit": "…", "maximumLevel": 19 },
//     "terrain": "ellipsoid" | "ion",
//     "camera": { "longitude": 115.8, "latitude": -31.9, "height": 300,
//                 "heading": 0, "pitch": -45, "roll": 0 },      // degrees / metres
//     "ionToken": "…"
//   }
//
// "ion" imagery/terrain need an ion token; without one they fall back to OSM / the ellipsoid, so
// Cesium's bundled demo token is never used. A published register gets its token injected into
// the config at build time (see PLAN.md), so it must be a restricted, assets:read-only token.

export const DEFAULT_CESIUM_OPTIONS = Object.freeze({
  basemap: 'osm',
  terrain: 'ellipsoid',
  camera: null,
  ionToken: '',
});

const TILE_TEMPLATE_PLACEHOLDERS = ['{z}', '{x}', '{y}'];

const isObject = value => value != null && typeof value === 'object' && !Array.isArray(value);
const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

function parseBasemap(value, warnings) {
  if (value === undefined) return DEFAULT_CESIUM_OPTIONS.basemap;
  if (value === 'osm' || value === 'ion') return value;
  if (isObject(value) && typeof value.url === 'string') {
    let url;
    try {
      url = new URL(value.url.replace(/[{}]/g, ''));
    } catch {
      url = null;
    }
    const hasPlaceholders = TILE_TEMPLATE_PLACEHOLDERS.every(p => value.url.includes(p));
    if (url?.protocol === 'https:' && hasPlaceholders) {
      const basemap = { url: value.url };
      if (typeof value.credit === 'string') basemap.credit = value.credit;
      if (Number.isInteger(value.maximumLevel) && value.maximumLevel >= 0) basemap.maximumLevel = value.maximumLevel;
      return basemap;
    }
  }
  warnings.push(`cesium.basemap ${JSON.stringify(value)} is not "osm", "ion" or { "url": "https://…/{z}/{x}/{y}…" }; using OpenStreetMap`);
  return DEFAULT_CESIUM_OPTIONS.basemap;
}

function parseTerrain(value, warnings) {
  if (value === undefined) return DEFAULT_CESIUM_OPTIONS.terrain;
  if (value === 'ellipsoid' || value === 'ion') return value;
  warnings.push(`cesium.terrain ${JSON.stringify(value)} is not "ellipsoid" or "ion"; using the ellipsoid`);
  return DEFAULT_CESIUM_OPTIONS.terrain;
}

function parseCamera(value, warnings) {
  if (value === undefined) return null;
  const { longitude, latitude, height, heading = 0, pitch = -45, roll = 0 } = isObject(value) ? value : {};
  if (isObject(value)
    && inRange(longitude, -180, 180) && inRange(latitude, -90, 90) && Number.isFinite(height)
    && Number.isFinite(heading) && inRange(pitch, -90, 90) && Number.isFinite(roll)) {
    return { longitude, latitude, height, heading, pitch, roll };
  }
  warnings.push('cesium.camera needs numeric longitude (-180..180), latitude (-90..90) and height, '
    + 'and optional heading, pitch (-90..90) and roll in degrees; framing the data instead');
  return null;
}

// Parses the raw `cesium` value, then applies the ion fallbacks. Returns the effective options
// plus human-readable warnings for anything that was dropped or downgraded.
export function resolveCesiumOptions(raw) {
  const warnings = [];
  if (raw !== undefined && !isObject(raw)) {
    warnings.push('cesium must be an object; using the defaults');
    return { options: { ...DEFAULT_CESIUM_OPTIONS }, warnings };
  }
  const source = raw ?? {};
  const ionToken = typeof source.ionToken === 'string' ? source.ionToken.trim() : '';
  if (source.ionToken !== undefined && typeof source.ionToken !== 'string') {
    warnings.push('cesium.ionToken must be a string; ignoring it');
  }

  const options = {
    basemap: parseBasemap(source.basemap, warnings),
    terrain: parseTerrain(source.terrain, warnings),
    camera: parseCamera(source.camera, warnings),
    ionToken,
  };

  if (!ionToken) {
    if (options.basemap === 'ion') {
      warnings.push('cesium.basemap "ion" needs an ion token; using OpenStreetMap');
      options.basemap = DEFAULT_CESIUM_OPTIONS.basemap;
    }
    if (options.terrain === 'ion') {
      warnings.push('cesium.terrain "ion" needs an ion token; using the ellipsoid');
      options.terrain = DEFAULT_CESIUM_OPTIONS.terrain;
    }
  }
  return { options, warnings };
}
