import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The layering rules for `apps/api`, enforced rather than trusted.
 *
 * Two directions of dependency are allowed and no others:
 *
 *     relations/  ──▶  core/
 *
 * `api` has no `sub-modules/` layer, for the same reason `apps/app` has none:
 * Time's third layer exists for interchangeable implementations of one contract
 * (Gregorian vs naŭ vs ephemeris). Journal, Actions and References are not
 * that — they are distinct domains with no shared contract they each satisfy
 * differently. See nau#57. Two layers is the honest shape; a third would be
 * structure without a reason.
 *
 * The operating definition that decides what may live in `core/`:
 *
 *     `api` is what remains when every module is switched off.
 *
 * - `core/` never imports `relations/`. That import is the moment the core
 *   stops being a substrate and becomes "whatever Journal needed".
 * - `core/` never names a module in code. A core that knows `journal.entry`
 *   exists has stopped being agnostic — this is the rule that keeps the kind
 *   registry a mechanism rather than a list.
 * - No relation imports another relation. Deleting `relations/api-journal/`
 *   should delete Journal from the backend and touch nothing else.
 * - `PrismaService` is injectable only in `core/` and in the relation that owns
 *   the model. This is the api-specific rule and the most valuable one: today
 *   `Planning` is queried directly by three different modules, so nobody owns
 *   it, and a change to it has to be chased by hand.
 *
 * A test rather than a lint rule because it travels with the package: it runs
 * wherever the tests run, with no dependency on anyone's editor setup.
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

/**
 * Code with comments and string literals stripped, for the "names no module"
 * rule. Documentation prose naming Journal is not only allowed but encouraged —
 * explaining *why* the core must not know about Journal requires saying
 * "Journal". Only code may not.
 */
function codeWithoutCommentsOrStrings(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

const rel = (file: string) => file.slice(SRC.length + 1).replace(/\\/g, '/');

/** Every module that has, or will have, a relation under `relations/`. */
const MODULE_NAMES = [
  'journal',
  'actions',
  'agenda',
  'triage',
  'gtd',
  'references',
  'captures',
  'content',
  'brands',
  'flownau',
  'nauthenticity',
  'zazu',
];

describe('core/ is a substrate, not a module host', () => {
  const files = sourcesUnder(CORE);

  it('finds core sources to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(rel))('%s does not import from relations/', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) => /relations\//.test(line));
    expect(offending).toEqual([]);
  });

  it.each(files.map(rel))('%s does not name a module in code', (name) => {
    const code = codeWithoutCommentsOrStrings(join(SRC, name));
    const offending = MODULE_NAMES.filter((mod) =>
      new RegExp(`\\b${mod}\\b`, 'i').test(code),
    );
    expect(offending).toEqual([]);
  });
});

describe('relations/ are independent of one another', () => {
  /**
   * Enumerated inside the test rather than at module load.
   *
   * The first version of this rule built its `it.each` cases from the directory
   * listing as the file was loaded, so a relation added afterwards generated no
   * cases at all — and the rule passed while being violated. It was caught by
   * checking that the guard fails when it should, which is the only reason this
   * comment exists rather than a silent hole.
   */
  it('no relation imports a sibling relation', () => {
    if (!existsSync(RELATIONS)) return;

    const dirs = readdirSync(RELATIONS).filter((entry) =>
      statSync(join(RELATIONS, entry)).isDirectory(),
    );

    const violations: string[] = [];

    for (const dir of dirs) {
      for (const file of sourcesUnder(join(RELATIONS, dir))) {
        for (const line of importLines(file)) {
          const specifier = line.match(/from\s+['"]([^'"]+)['"]/)?.[1];
          if (!specifier) continue;

          // A sibling is normally reached relatively (`../api-beta/thing`), so
          // the literal text `relations/` never appears in the import. The
          // specifier has to be resolved against the importing file to see
          // where it actually lands — matching on the raw string was the first
          // version of this rule, and it could not fire at all.
          const target = specifier.startsWith('.')
            ? join(file, '..', specifier).replace(/\\/g, '/')
            : specifier;

          const landed = target.match(/relations\/([a-z0-9-]+)/i);
          if (landed !== null && landed[1] !== dir) {
            violations.push(`${rel(file)} imports ${landed[1]}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

/**
 * Modules that still reach Prisma directly, from before the rebuild.
 *
 * A ratchet, not a permission list. Each of these belongs to a module whose own
 * session will move it behind the substrate or the tenancy layer (nau#80–#83),
 * and the test below fails if the list *grows* — so the debt can be paid down
 * but not added to, without anyone having to notice in review.
 *
 * Removing a name from this list when its module is rebuilt is the point. The
 * list reaching empty is what finishes the rebuild.
 */
const PRISMA_LEGACY = [
  'agenda/agenda.service.ts',
  'auth/auth.service.ts',
  'blocks/block-events.service.ts',
  'blocks/blocks.service.ts',
  'brands/brands.service.ts',
  'events/events.service.ts',
  'projects/projects.service.ts',
  'prompts/prompts.service.ts',
  'social-profiles/social-profiles.service.ts',
  'sync/sync.service.ts',
  'tags/tags.service.ts',
  'time/occurrences.service.ts',
  'time/periods.service.ts',
  'time/planning.service.ts',
  'time/synthesis-scheduler.service.ts',
  'time/workspace-time.service.ts',
  'triage/triage.service.ts',
  'usage/usage.service.ts',
  'workspaces/workspaces.service.ts',
];

describe('the pre-rebuild Prisma debt only shrinks', () => {
  it('no module outside core/ and relations/ reaches Prisma unless already known to', () => {
    const offenders = sourcesUnder(SRC)
      .map(rel)
      .filter((name) => !name.startsWith('core/') && !name.startsWith('prisma/'))
      .filter((name) => {
        const lines = importLines(join(SRC, name));
        // Only reaching the *client* counts. Importing a generated enum or a
        // model type from `@prisma/client` is not database access — a DTO
        // naming `WorkspaceRole` issues no query, and treating it as a
        // violation would push code toward duplicating the enum instead.
        return lines.some(
          (line) =>
            /\/prisma\.service/.test(line) &&
            !/PrismaModule/.test(line) &&
            !/scoped-prisma\.service/.test(line),
        );
      })
      // A relation owning its own model is allowed; it is the rule below that
      // governs those.
      .filter((name) => !name.startsWith('relations/'));

    const unexpected = offenders.filter((name) => !PRISMA_LEGACY.includes(name));
    expect(unexpected).toEqual([]);
  });

  it('the list names nothing that has already been cleaned up', () => {
    // Keeps the ratchet honest: a stale entry would silently re-permit a file
    // that was moved back.
    const stale = PRISMA_LEGACY.filter((name) => !existsSync(join(SRC, name)));
    expect(stale).toEqual([]);
  });
});

describe('PrismaService has an owner', () => {
  /**
   * The rule: only `core/` and a relation that owns the model may talk to
   * Prisma. Everything else goes through the substrate or through the owning
   * relation's published contract.
   *
   * Scoped to core/ and relations/ deliberately — the pre-rebuild module
   * folders still sit alongside these and are exempt until they move
   * (nau#79–#83). Tightening this to all of src/ is the last step of the
   * rebuild, not the first.
   */
  const files = [...sourcesUnder(CORE), ...sourcesUnder(RELATIONS)];

  const OWNERS = [
    /^core\/tenancy\//,
    /^core\/substrate\//,
    /^core\/prisma\//,
  ];

  it.each(files.map(rel))('%s injects Prisma only if it owns a model', (name) => {
    // Two things are deliberately *not* violations:
    //
    //   - `PrismaModule`, a wiring import: a module declaring what it provides,
    //     not code issuing a query.
    //   - `ScopedPrismaService`, which is the safe path this whole layer exists
    //     to provide. Reaching the database *through the scope* is the intended
    //     way; what this rule guards against is reaching around it.
    const importsPrisma = importLines(join(SRC, name)).some((line) => {
      const raw = /\/prisma\.service|@prisma\/client/.test(line);
      return raw && !/PrismaModule/.test(line) && !/scoped-prisma\.service/.test(line);
    });
    if (!importsPrisma) return;

    const isCore = name.startsWith('core/');
    const allowed = isCore
      ? OWNERS.some((pattern) => pattern.test(name))
      : name.startsWith('relations/');

    expect(allowed).toBe(true);
  });
});
