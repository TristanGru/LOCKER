export type ColorMode = 'light' | 'dark';

const KEY = 'locker-theme';

export function readColorMode(): ColorMode {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyColorMode(mode: ColorMode) {
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* Private browsing can block storage. The choice still applies for this visit. */
  }
}
