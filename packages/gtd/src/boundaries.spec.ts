import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, normalize, sep } from 'node:path';

/**
 * The layering rules, enforced rather than trusted.
 *
 *     relations/  ──▶  core/
 *
 * Two layers, not three. There is no `sub-modules/` here and forcing one
 * would misrepresent the module: the tray/movement mechanism has exactly
 * one implementation. A third layer would be structure without a reason,
 * which the convention itself warns against (nau#57).
 *
 * The rules, and why each exists:
 *
 * - `core/` never imports `relations/`. That import is the moment the core
 *   stops being a contract and becomes "whatever the triage needed".
 * - `core/` names no destination kind (`actions.item`, `references.note`,
 *   `journal.entry`) and no consuming module in code. Per nau#111, GTD
 *   never owned a kind of its own and does not start now — a name leaking
 *   in here is the same failure `AGENDA_TYPES` was for Actions.
 * - `core/` never imports an LLM client, a database client, or a framework.
 *   The triage that assists processing a voice capture (per nau#112) lives
 *   entirely in `relations/zazu/` — the core knows what a movement is, not
 *   what a transcription is.
 * - No relation imports another relation *within this package*.
 *   `(GTD)·(Actions)` and `(GTD)·(References)` share no logic; letting one
 *   import the other is how one quietly becomes a dependency of the other.
 *   A relation importing a workspace package's own published relation
 *   subpath (`@nau/actions/relations/gtd`) is a different thing entirely —
 *   that is this package consuming the neighbour's contract, the whole
 *   point of `relations/actions/` existing — and must not trip this rule.
 *   nau#116 found the identical false positive in `apps/api`'s own
 *   `boundaries.spec.ts`: a specifier is only a sibling-relation violation
 *   when it is a *relative path* landing inside this package's own
 *   `relations/`, never when it is an npm/workspace package specifier that
 *   happens to contain the literal string `relations/` in its name. The
 *   inverse gap, found and fixed here rather than inherited unverified from
 *   `@nau/actions`' copy of this file: a relative import between sibling
 *   relations (`relations/actions/contract.ts` importing
 *   `'../journal/contract'`) never contains the literal string `relations/`
 *   at all, so a check that only pattern-matches the raw specifier string
 *   misses it. The path must be *resolved* against the importing file's own
 *   directory before checking which `relations/*` folder it lands in.
 *
 * Tests rather than lint rules because they travel with the package: they
 * run wherever the tests run, with no dependency on anyone's editor
 * configuration.
 *
 * Each rule below was verified to actually fail when violated, not merely
 * assumed to work — a guard nobody has seen fail is a guard nobody knows
 * works.
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

describe('core/ knows nothing of destination kinds, of storage, or of any consumer', () => {
  const files = sourcesUnder(CORE);

  it('finds core sources to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(rel))('%s does not import from relations/', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) => /relations\//.test(line));
    expect(offending).toEqual([]);
  });

  it.each(files.map(rel))('%s does not import a database client, an LLM client, or a framework', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) =>
      /@prisma\/client|@nestjs\/|prisma\.service|@nau\/llm-client/.test(line),
    );
    expect(offending).toEqual([]);
  });

  // A destination kind leaking into the core is the same failure
  // `AGENDA_TYPES` was for Actions — the caller specialising what the
  // contract should declare instead.
  it.each(files.map(rel))('%s names no destination kind in its code', (name) => {
    const code = codeOnly(join(SRC, name));

    expect(code).not.toMatch(/['"]actions\.item['"]/);
    expect(code).not.toMatch(/['"]references\.note['"]/);
    expect(code).not.toMatch(/['"]journal\.entry['"]/);
    expect(code).not.toMatch(/['"]gtd\.inbox_item['"]/);
  });

  it.each(files.map(rel))('%s names no consuming module in its code', (name) => {
    const code = codeOnly(join(SRC, name)).toLowerCase();

    expect(code).not.toContain('actions');
    expect(code).not.toContain('references');
    expect(code).not.toContain('journal');
    expect(code).not.toContain('zazu');
  });
});

describe('relations/ depend on core, never the reverse', () => {
  const files = sourcesUnder(RELATIONS);

  // Deliberately not asserting that relations exist yet: the core ships
  // first, and an empty relations/ is a valid state of this package rather
  // than a failure. The rule still has to hold the moment the first one
  // lands, which is why the check runs over whatever is there rather than
  // being skipped — a guard that only switches on later is a guard nobody
  // remembers to switch on.
  it('no relation reaches into another relation', () => {
    const offenders = files.flatMap((file) => {
      const name = rel(file);
      const relation = name.split('/')[1];
      return importLines(file)
        .filter((line) => {
          const specifier = /from\s+['"]([^'"]+)['"]/.exec(line)?.[1];
          // A bare/scoped specifier (no leading '.') is an npm or workspace
          // package — e.g. '@nau/actions/relations/gtd' — never a path
          // landing inside this package's own relations/, even though it may
          // contain that literal substring. Per nau#116, only a relative
          // specifier can actually violate this rule.
          if (!specifier || !specifier.startsWith('.')) return false;

          // Resolve the relative path against the importing file's own
          // directory rather than pattern-matching the raw specifier: a
          // sibling import like '../journal/contract' never contains the
          // literal string 'relations/' at all, so the resolved path is the
          // only reliable way to tell which relations/* folder it lands in.
          const resolved = normalize(join(dirname(file), specifier)).split(sep).join('/');
          const match = /relations\/([^/]+)/.exec(resolved);
          return match !== null && match[1] !== relation;
        })
        .map((line) => `${name}: ${line.trim()}`);
    });

    expect(offenders).toEqual([]);
  });
});
