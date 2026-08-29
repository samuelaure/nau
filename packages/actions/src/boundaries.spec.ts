import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The layering rules, enforced rather than trusted.
 *
 *     relations/  ──▶  core/
 *
 * Two layers, not three. There is no `sub-modules/` here and forcing one would
 * misrepresent the module: an actionable item has exactly one implementation.
 * A third layer would be structure without a reason, which the convention
 * itself warns against (nau#57).
 *
 * The rules, and why each exists:
 *
 * - `core/` never imports `relations/`. That import is the moment the core
 *   stops being a contract and becomes "whatever the agenda needed".
 * - `core/` never imports `@nau/time`. **This is the rule specific to Actions**,
 *   and the one that makes the module genuinely extractable rather than merely
 *   well-arranged: if the core compiles and its tests pass with Time switched
 *   off, Actions can be forked out of the platform and still work.
 * - `core/` names no time system, no scale, and no consuming module in code.
 *   Prose in doc comments is exempt and encouraged — it is the reason the
 *   abstractions exist, not a dependency.
 * - No relation imports another relation. `(Time)·(Actions)` and
 *   `(GTD)·(Actions)` share no logic; letting one import the other is how one
 *   quietly becomes a dependency of the other.
 *
 * Tests rather than lint rules because they travel with the package: they run
 * wherever the tests run, with no dependency on anyone's editor configuration.
 *
 * Each rule below was verified to actually fail when violated, not merely
 * assumed to work — a guard nobody has seen fail is a guard nobody knows works.
 */

const SRC = join(__dirname);
const CORE = join(SRC, 'core');
const RELATIONS = join(SRC, 'relations');

function sourcesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
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

/** Source with comments stripped, so documentation prose never trips a rule. */
function codeOnly(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

const rel = (file: string) => file.slice(SRC.length + 1).replace(/\\/g, '/');

describe('core/ knows nothing of Time, of storage, or of any consumer', () => {
  const files = sourcesUnder(CORE);

  it('finds core sources to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(rel))('%s does not import from relations/', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) => /relations\//.test(line));
    expect(offending).toEqual([]);
  });

  // The rule that makes Actions extractable. If this ever fails, the core has
  // acquired a dependency on the very module it must survive being without.
  it.each(files.map(rel))('%s does not import @nau/time', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) => /@nau\/time/.test(line));
    expect(offending).toEqual([]);
  });

  it.each(files.map(rel))('%s does not import a database client or a framework', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) =>
      /@prisma\/client|@nestjs\/|prisma\.service/.test(line),
    );
    expect(offending).toEqual([]);
  });

  // A core that names a scale has learnt one calendar's vocabulary, which is
  // what stopped `PeriodType` from being a contract (nau#57).
  it.each(files.map(rel))('%s names no time system and no scale in its code', (name) => {
    const code = codeOnly(join(SRC, name));

    expect(code).not.toMatch(/['"]gregorian['"]/);
    expect(code).not.toMatch(/['"]someday['"]/);
    expect(code).not.toMatch(/['"](day|week|month|quarter|year)['"]/);
    expect(code).not.toMatch(/\brrule\b/i);
  });

  it.each(files.map(rel))('%s names no consuming module in its code', (name) => {
    const code = codeOnly(join(SRC, name)).toLowerCase();

    expect(code).not.toContain('journal');
    expect(code).not.toContain('agenda');
    expect(code).not.toContain('zazu');
  });
});

describe('relations/ depend on core, never the reverse', () => {
  const files = sourcesUnder(RELATIONS);

  // Deliberately not asserting that relations exist yet: the core ships first,
  // and an empty relations/ is a valid state of this package rather than a
  // failure. The rule still has to hold the moment the first one lands, which
  // is why the check runs over whatever is there rather than being skipped —
  // a guard that only switches on later is a guard nobody remembers to switch on.
  it('no relation reaches into another relation', () => {
    const offenders = files.flatMap((file) => {
      const name = rel(file);
      const relation = name.split('/')[1];
      return importLines(file)
        .filter((line) => {
          const match = /relations\/([^/'"]+)/.exec(line);
          return match !== null && match[1] !== relation;
        })
        .map((line) => `${name}: ${line.trim()}`);
    });

    expect(offenders).toEqual([]);
  });
});
