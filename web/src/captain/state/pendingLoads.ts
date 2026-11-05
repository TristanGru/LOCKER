/**
 * Counts data requests that have nothing on screen yet (a screen's first load). The start-up screen stays
 * up while this is above zero, so the app appears only once it has data to show.
 */
let pending = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

export const pendingLoads = {
  get: () => pending,
  start() {
    pending++;
    emit();
  },
  finish() {
    pending = Math.max(0, pending - 1);
    emit();
  },
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
};
