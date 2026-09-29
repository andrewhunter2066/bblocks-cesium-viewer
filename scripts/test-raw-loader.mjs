// Node test-runner support for Vite's `?raw` imports (e.g. `import css from '../../css/plugin.css?raw'`),
// which Vite resolves to the file's text at build time. Used via
// `node --import ./scripts/test-raw-loader.mjs --test …` (see package.json); the hooks live in
// raw-import-hooks.mjs.
import { register } from 'node:module';

register('./raw-import-hooks.mjs', import.meta.url);
