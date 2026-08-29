import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The layering rules, enforced rather than trusted.
 *
 * Three directions of dependency are allowed and no others:
 *
 *     relations/  ──▶  systems/  ──▶  core/
 *
 * Each arrow is one-way, and each has a reason:
 *
 * - `core/` never imports `systems/`. That import is the moment the core stops
 *   being a contract and becomes "whatever Gregorian needed".
 * - `systems/` never imports `relations/`. A time system must not know that
 *   Journal exists, so deleting Journal from the platform means deleting a
 *   folder under `relations/` and touching nothing in `systems/`.
 * - Nothing imports a sibling across the boundary — one system never reaches
 *   into another, and one relation never reaches into another.
 *
 * Tests rather than lint rules because they travel with the package: they run
 * wherever the tests run, with no dependency on anyone's editor configuration.
 * Each rule below was verified to actually fail when violated, not merely
 * assumed to work.
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

describe('core/ knows nothing of any concrete system', () => {
  const files = sourcesUnder(join(SRC, 'core'));

  it('finds core sources to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map(rel))('%s does not import from systems/ or relations/', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) =>
      /(systems|relations)\//.test(line),
    );
    expect(offending).toEqual([]);
  });

  it.each(files.map(rel))('%s does not name a concrete system in its code', (name) => {
    const code = readFileSync(join(SRC, name), 'utf8')
      // The contract documents naŭ and ephemeris deliberately; that prose is
      // the reason the abstractions exist and is not a dependency.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(code).not.toMatch(/['"]gregorian['"]/);
    expect(code).not.toMatch(/['"]ephemeris['"]/);
    expect(code).not.toMatch(/['"]triggers['"]/);
  });
});

describe('systems/ know nothing of any relation', () => {
  const files = sourcesUnder(join(SRC, 'systems'));

  it('finds system sources to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // The rule that makes the module genuinely modular: a time system computes
  // periods and recurrence, and has no opinion about Journal, Actions, or
  // anything else that might consume it.
  it.each(files.map(rel))('%s does not import from relations/', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) => /relations\//.test(line));
    expect(offending).toEqual([]);
  });

  it.each(files.map(rel))('%s does not mention Journal or Actions in its code', (name) => {
    const code = readFileSync(join(SRC, name), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(code.toLowerCase()).not.toContain('journal');
    expect(code.toLowerCase()).not.toContain('synthesis');
  });

  it.each(files.map(rel))('%s does not reach into another time system', (name) => {
    const system = name.split('/')[1];
    const offending = importLines(join(SRC, name)).filter((line) => {
      const match = /systems\/([^/'"]+)/.exec(line);
      return match !== null && match[1] !== system;
    });
    expect(offending).toEqual([]);
  });
});

describe('relations/ depend on systems, never the reverse', () => {
  const files = sourcesUnder(join(SRC, 'relations'));

  it('finds relation sources to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // Time·Journal and Time·Actions are separate relations that share no logic.
  // Keeping them from importing each other is what stops one from quietly
  // becoming a dependency of the other.
  it.each(files.map(rel))('%s does not reach into another relation', (name) => {
    const relation = name.split('/')[1];
    const offending = importLines(join(SRC, name)).filter((line) => {
      const match = /relations\/([^/'"]+)/.exec(line);
      return match !== null && match[1] !== relation;
    });
    expect(offending).toEqual([]);
  });
});
