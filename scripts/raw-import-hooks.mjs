// Module loader hooks (registered by test-raw-loader.mjs): a `?raw` import loads as a module whose
// default export is the file's text, as Vite does.
import { readFile } from 'node:fs/promises';

const RAW_SUFFIX = '?raw';

export async function load(url, context, nextLoad) {
  if (!url.endsWith(RAW_SUFFIX)) return nextLoad(url, context);
  const text = await readFile(new URL(url.slice(0, -RAW_SUFFIX.length)), 'utf8');
  return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(text)};` };
}
