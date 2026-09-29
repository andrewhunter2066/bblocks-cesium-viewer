import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// `vite build`: library build producing dist/index.js (named export: TopoFeatureCesiumPlugin).
// CesiumJS is not bundled — it is fetched from jsDelivr at runtime (src/js/utils/cesium-version.js).
// Deploy the whole dist/ directory together; any chunk is resolved relative to index.js.
//
// `vite` (npm run dev): serves the repo root and opens the harness, which imports the plugin
// straight from src/ with live reload.
//
// Secrets: only harness/ reads import.meta.env.VITE_CESIUM_ION_TOKEN (from a gitignored
// .env.local). Never reference import.meta.env.VITE_* from src/ — Vite would inline the value
// into dist/, which is published.
export default defineConfig({
  server: {
    open: '/harness/',
  },
  build: {
    assetsInlineLimit: Infinity,
    lib: {
      entry: fileURLToPath(new URL('src/js/index.js', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
  },
});
