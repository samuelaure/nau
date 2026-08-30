import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The rules this package exists to hold, enforced rather than trusted.
 *
 * Journal has no `sub-modules/` layer — there is exactly one implementation
 * of what a journal entry is, not several interchangeable ones satisfying a
 * shared contract, so a Time-style `core/systems/relations` split would be
 * structure without a reason (nau#57).
 *
 * What it does need, and what nau#96 decided this package is for: nothing
 * here may depend on NestJS, Prisma, or anything else that would stop this
 * code from running on a device with no server relationship. Deleting
 * `apps/api` entirely must leave this package fully functional.
 *
 * `relations/` holds Journal's dealings with one other module —
 * `relations/gtd/` is `(Journal)·(GTD)`, published as its own entry point
 * (`@nau/journal/relations/gtd`) rather than folded into the root export,
 * so the relation stays optional (nau#115). No relation may import another;
 * there is only one today, but the rule is cheap to state ahead of a second.
 */

const SRC = join(__dirname);

function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/** Import and re-export statements only — prose in doc comments is exempt. */
function importLines(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return source.match(/^\s*(?:import|export)\s[^;]*?from\s+['"][^'"]+['"]/gm) ?? [];
}

const rel = (file: string) => file.slice(SRC.length + 1).replace(/\\/g, '/');

describe('this package runs wherever Journal is needed, not only inside api', () => {
  const files = sourcesUnder(SRC);

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(rel))('%s does not import a framework or a persistence client', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) =>
      /(@nestjs|@prisma\/client|prisma\.service|scoped-prisma)/i.test(line),
    );
    expect(offending).toEqual([]);
  });

  it.each(files.map(rel))('%s does not reach into apps/api', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) => /apps\/api/.test(line));
    expect(offending).toEqual([]);
  });
});
