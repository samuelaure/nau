import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The layering rules for `apps/app`, enforced rather than trusted.
 *
 * Two directions of dependency are allowed and no others:
 *
 *     relations/  ──▶  core/
 *
 * `app` has no `sub-modules/` layer — Time's third layer exists for
 * interchangeable implementations of one contract (Gregorian vs naŭ vs
 * ephemeris). Journal, Actions and Content are not that: they are distinct
 * modules with no shared contract they each satisfy differently. See
 * nau#57. Two layers is the honest shape here; a third would be structure
 * without a reason.
 *
 * - `core/` never imports `relations/`, with one declared exception:
 *   `module-registry/registry.ts` is the single file allowed to, because its
 *   whole job is supplying the real module list — the rules it applies stay
 *   in `select.ts`, which holds no such import. Anywhere else in `core/`,
 *   that import is the moment the core stops being agnostic and becomes
 *   "whatever Journal needed".
 * - Nothing imports a sibling across the relations/ boundary — one module's
 *   web-facing relation never reaches into another's. Deleting
 *   `relations/journal/` should delete Journal from the web app and
 *   touch nothing else.
 *
 * A test rather than a lint rule because it travels with the package: it
 * runs wherever the tests run, with no dependency on anyone's editor setup.
 * Each rule below was verified to actually fail when violated, not merely
 * assumed to work.
 */

const SRC = join(__dirname)
const CORE = join(SRC, 'core')

const DOMAIN_MODULES = [
  'actions',
  'gtd',
  'journal',
  'references',
  'time',
]

function sourcesUnder(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry) && !entry.endsWith('.spec.ts') && !entry.endsWith('.spec.tsx'))
        out.push(full)
    }
  }
  walk(dir)
  return out
}

/** Import and re-export statements only — prose in doc comments is exempt. */
function importLines(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  return source.match(/^\s*(?:import|export)\s[^;]*?from\s+['"][^'"]+['"]/gm) ?? []
}

const rel = (file: string) => file.slice(SRC.length + 1).replace(/\\/g, '/')

describe('core/ knows nothing of any concrete module', () => {
  if (!existsSync(CORE)) {
    it.skip('core/ does not exist yet', () => {})
    return
  }

  const REGISTRY_FILE = 'core/module-registry/registry.ts'
  const files = sourcesUnder(CORE).filter((f) => rel(f) !== REGISTRY_FILE)

  it.each(files.map(rel))('%s does not import from domain modules', (name) => {
    const offending = importLines(join(SRC, name)).filter((line) => 
      DOMAIN_MODULES.some(mod => new RegExp(`@/${mod}/`).test(line))
    )
    expect(offending).toEqual([])
  })

  it(`${REGISTRY_FILE} imports from domain modules only to supply the module list`, () => {
    const offending = importLines(join(SRC, REGISTRY_FILE)).filter((line) => {
      const mentionsDomain = DOMAIN_MODULES.some(mod => new RegExp(`@/${mod}/`).test(line));
      const isAllowedImport = /^import \{ \w+Module \} from '@\/(actions|gtd|journal|references|time)\//.test(line.trim());
      return mentionsDomain && !isAllowedImport;
    })
    expect(offending).toEqual([])
  })

  // Extend this list as modules are named in nau#57's discussion — the point
  // is that core source ever mentioning one is the failure, not this
  // particular list being exhaustive.
  it.each(files.map(rel))('%s does not name a concrete module in its code', (name) => {
    const code = readFileSync(join(SRC, name), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')

    expect(code.toLowerCase()).not.toMatch(/['"]journal['"]/)
    expect(code.toLowerCase()).not.toMatch(/['"]actions['"]/)
    expect(code.toLowerCase()).not.toMatch(/['"]content['"]/)
  })
})

describe('domain modules never reach into a sibling domain module', () => {
  it('no domain module imports a sibling', () => {
    const violations: string[] = []

    for (const dir of DOMAIN_MODULES) {
      const fullDir = join(SRC, dir)
      if (!existsSync(fullDir)) continue

      for (const file of sourcesUnder(fullDir)) {
        for (const line of importLines(file)) {
          // Both absolute @/module and relative ../module form
          const absoluteMatch = line.match(/from\s+['"]@\/([^/]+)/)?.[1]
          const relativeMatch = line.match(/from\s+['"]\.\.\/([^/]+)/)?.[1]
          const targetModule = absoluteMatch || relativeMatch
          
          if (targetModule && DOMAIN_MODULES.includes(targetModule) && targetModule !== dir) {
            violations.push(`${rel(file)} imports ${targetModule}`)
          }
        }
      }
    }

    expect(violations).toEqual([])
  })
})
