// Parser for the backend readiness-brief text (headings in capitals, "- " bullets, indented notes, [n] citations).
// Shared by the on-screen brief and the printed brief; the wording stays the backend's.

export interface Item {
  text: string;
  notes: string[];
}
export interface Section {
  key: string;
  heading: string;
  items: Item[];
}
export interface Parsed {
  asOf: string | null;
  disclaimer: string[];
  sections: Section[];
}

export function parseBrief(text: string): Parsed {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').filter((l) => l.trim()))
    .filter((b) => b.length);
  const banner = (l: string) => /^SYNTHETIC\b/.test(l.trim());
  const first = blocks.shift() ?? [];
  const pre = first.filter((l) => !banner(l) && !/^READINESS BRIEF\b/.test(l.trim()));
  const asOf = pre.find((l) => /^As of\b/.test(l)) ?? null;
  const disclaimer = pre.filter((l) => l !== asOf);
  const sections: Section[] = [];
  for (const b of blocks) {
    if (b.every(banner)) continue;
    const isBullet = (l: string) => /^\s*- /.test(l);
    const heading = isBullet(b[0]) ? '' : b[0].trim();
    const key = heading.replace(/\s*\(.*\)$/, '').toUpperCase();
    if (key === 'SOURCES') continue; // rendered from the structured citation list below
    const items: Item[] = [];
    for (const line of heading ? b.slice(1) : b) {
      if (isBullet(line)) items.push({ text: line.replace(/^\s*- /, '').trim(), notes: [] });
      else if (/^\s{2,}/.test(line) && items.length) items[items.length - 1].notes.push(line.trim());
      else items.push({ text: line.trim(), notes: [] });
    }
    sections.push({ key, heading: heading || 'Notes', items });
  }
  return { asOf, disclaimer, sections };
}

