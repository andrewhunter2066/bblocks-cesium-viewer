// Injecting a Cesium ion token into a locally built register's Globe view configurations — what a
// published register's CI does from a secret (see docs/design.md, Secrets policy), done here from
// .env.local for `npm run local-register`. No file access: scripts/use-local-plugin.mjs does the
// I/O. The token only ever lands in gitignored build-local/.
import { CESIUM_VIEWER_CONFIG_ROLE, findConfigResource } from '../../src/js/utils/load-config.js';

export const ION_CONFIG_DIR = 'build-local/ion-configs/';
export const TOKEN_VARIABLE = 'VITE_CESIUM_ION_TOKEN';

// The token from a dotenv file's text: `VITE_CESIUM_ION_TOKEN=…`, optionally `export`ed and quoted.
// Empty when the variable is missing or blank.
export function parseEnvToken(text, name = TOKEN_VARIABLE) {
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1] !== name) continue;
    const quoted = /^(["'])(.*)\1$/.exec(match[2]);
    return (quoted ? quoted[2] : match[2].replace(/\s+#.*$/, '')).trim();
  }
  return '';
}

// A block's configuration with ion switched on: ion imagery and terrain unless the block chose its
// own basemap/terrain, and the token.
export function withIon(config, token) {
  const base = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  const cesium = base.cesium && typeof base.cesium === 'object' ? base.cesium : {};
  return { ...base, cesium: { basemap: 'ion', terrain: 'ion', ...cesium, ionToken: token } };
}

// Undoes an earlier injection on a block's resources: drops resources it added and restores the
// references it redirected. A no-op on resources it never touched, so injection is repeatable.
export function restoreResources(resources) {
  return (Array.isArray(resources) ? resources : [])
    .filter(r => !r?.addedForLocalIon)
    .map(r => {
      if (!r?.originalRef) return r;
      const { originalRef, ...rest } = r;
      return { ...rest, ref: originalRef };
    });
}

// Points a block's (restored) resources at its ion configuration copy at `ionRef`: redirects its
// own Globe view configuration, or adds one — which takes precedence over a Three.js view
// configuration, whose rules the copy already carries.
export function pointAtIonConfig(resources, ionRef) {
  const own = resources.find(r => r?.role === CESIUM_VIEWER_CONFIG_ROLE && r.ref);
  if (own) return resources.map(r => (r === own ? { ...r, originalRef: r.ref, ref: ionRef } : r));
  return [...resources, {
    role: CESIUM_VIEWER_CONFIG_ROLE,
    ref: ionRef,
    format: 'application/json',
    title: 'Globe view configuration (local ion token)',
    addedForLocalIon: true,
  }];
}

// The configuration resource the plugin would use for these (restored) resources, if any.
export function configResourceOf(resources) {
  return findConfigResource({ resources });
}

// A file name for a block's ion configuration copy.
export function ionConfigFileName(itemIdentifier) {
  return `${String(itemIdentifier).replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
}
