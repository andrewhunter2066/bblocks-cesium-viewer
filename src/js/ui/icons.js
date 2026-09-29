// Inline SVG icons (no mdi/Vuetify: the plugin runs outside the host's component tree). Sized by
// CSS and coloured via currentColor. parcels/surfaces/solids/fullscreen* match the Three.js
// TopoFeaturePlugin's icons.
const svg = (body, attrs = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${attrs}>${body}</svg>`;

export const ICONS = {
  extent: svg('<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/>'),
  labels: svg('<path d="M3 7V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2"/><path d="M12 4v16"/><path d="M9 20h6"/>'),
  edges: svg('<circle cx="5" cy="19" r="2" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/><line x1="6.5" y1="17.5" x2="17.5" y2="6.5"/>'),
  layers: svg('<path d="M12 3 2 8l10 5 10-5Z"/><path d="m2 13 10 5 10-5"/>'),
  parcels: svg('<path d="M12 3 20 9l-3 10H7L4 9Z"/>'),
  surfaces: svg('<path d="M12 3 21 8l-9 5-9-5Z"/>'),
  solids: svg('<path d="M12 2 21 7v10l-9 5-9-5V7z" opacity="0.35"/><path d="M12 2 21 7 12 12 3 7z"/>', 'fill="currentColor" stroke="none"'),
  zoomTo: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.35-4.35"/>'),
  fullscreen: svg('<path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/>'),
  fullscreenExit: svg('<path d="M4 9V5a2 2 0 0 1 2-2h4"/><path d="M20 9V5a2 2 0 0 0-2-2h-4"/><path d="M4 15v4a2 2 0 0 0 2 2h4"/><path d="M20 15v4a2 2 0 0 1-2 2h-4"/>'),
};
