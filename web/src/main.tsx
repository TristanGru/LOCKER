import { createRoot } from 'react-dom/client';

async function start() {
  // Public Sans: the U.S. government typeface (USWDS). IBM Plex Mono for figures and record IDs. Bundled, works offline.
  await import('@fontsource/public-sans/latin-400.css');
  await import('@fontsource/public-sans/latin-500.css');
  await import('@fontsource/public-sans/latin-600.css');
  await import('@fontsource/public-sans/latin-700.css');
  await import('@fontsource/ibm-plex-mono/latin-400.css');
  await import('@fontsource/ibm-plex-mono/latin-500.css');
  await import('@fontsource/ibm-plex-mono/latin-600.css');
  await import('./captain/styles/index.css');
  const { default: App } = await import('./captain/App');
  createRoot(document.getElementById('root')!).render(<App />);
}
start();
