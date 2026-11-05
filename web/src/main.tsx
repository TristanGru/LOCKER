import { createRoot } from 'react-dom/client';

async function start() {
  // Keep the advanced workspace available during incremental UI integration.
  // The advanced workspace has no sign-in screen of its own; without a session the captain app shows one.
  const signedIn = new URLSearchParams(location.search).has('legacy') && Boolean((await (await fetch('/api/session')).json()).user);
  if (signedIn) {
    const {default: App} = await import('./Workspace');
    createRoot(document.getElementById('root')!).render(<App />);
  } else {
    await import('@fontsource/inter/latin-400.css');
    await import('@fontsource/inter/latin-600.css');
    await import('@fontsource/inter/latin-700.css');
    await import('@fontsource/jetbrains-mono/latin-400.css');
    await import('./captain/styles/index.css');
    const {default: App} = await import('./captain/App');
    createRoot(document.getElementById('root')!).render(<App />);
  }
}
start();
