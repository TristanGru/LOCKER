type ClassValue = string | false | null | undefined | 0;

/** Tiny className joiner (no dependency needed). */
export default function clsx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
