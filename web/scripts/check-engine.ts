// Prints the demo storyline numbers so the scenario can be tuned and verified.
// Run: npm run check:engine
import { handle } from '../src/api/mockServer';
import type { FixesPayload, MissionsPayload, NextEventResult } from '../src/api/types';

const pct = (p: number) => `${Math.round(p * 100)}%`.padStart(4);

function show(label: string) {
  const m = handle('GET', '/missions') as MissionsPayload;
  const line = m.missions
    .map((x) => `${x.code.padEnd(12)} D+${String(x.daysOut).padEnd(2)} ${pct(x.odds)} ${x.status.padEnd(5)} domino=${x.nextDominoLabel ?? '-'}`)
    .join('\n   ');
  console.log(`\n== ${label}\n   ${line}`);
}

show('Baseline');
for (let i = 0; i < 4; i++) {
  const r = handle('POST', '/events/next') as NextEventResult;
  show(`After ${r.event.title}`);
  if (r.changes.length) console.log('   changes:', r.changes.map((c) => `${c.label} ${c.from}->${c.to}`).join(', '));
}

for (const mission of ['M1', 'M2', 'M3']) {
  const f = handle('GET', `/fixes?mission=${mission}`) as FixesPayload;
  console.log(`\nFixes for ${mission}:`);
  for (const x of f.fixes) console.log(`   #${x.rank} ${x.title.padEnd(55)} ${pct(x.oddsBefore)} -> ${pct(x.oddsAfter)}`);
}

handle('POST', '/decision', { fixId: 'FX-EXPEDITE', missionId: 'M1', decision: 'approve' });
const after1 = handle('GET', '/fixes?mission=M1') as FixesPayload;
console.log('\nAfter approving FX-EXPEDITE, M1 fixes:');
for (const x of after1.fixes) console.log(`   #${x.rank} ${x.title.padEnd(55)} ${pct(x.oddsBefore)} -> ${pct(x.oddsAfter)}`);
handle('POST', '/decision', { fixId: 'FX-TAD', missionId: 'M1', decision: 'approve' });
show('After approving FX-EXPEDITE + FX-TAD');
