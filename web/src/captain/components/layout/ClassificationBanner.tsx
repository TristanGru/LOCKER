/**
 * Marking banner, top and bottom of every screen, as on DoD information systems. Green = unclassified.
 * The content is a synthetic exercise, so the banner says so in the same place an operator expects the marking.
 */
export function ClassificationBanner({ position }: { position: 'top' | 'bottom' }) {
  return (
    <div
      role={position === 'top' ? 'note' : undefined}
      aria-label={position === 'top' ? 'Marking: unclassified, synthetic exercise data' : undefined}
      aria-hidden={position === 'bottom' ? true : undefined}
      className="shrink-0 bg-banner py-[3px] text-center text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white print:border-y print:border-black print:bg-white print:text-black"
    >
      Unclassified // Synthetic exercise data · Not for operational use
    </div>
  );
}
