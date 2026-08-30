/**
 * Writes the OpenAPI spec to disk from the running application's own metadata.
 *
 * Committed rather than generated-on-demand so that a change to the contract
 * shows up as a diff in review. That is the point: a breaking change to a route
 * five other services depend on should be visible in the pull request that
 * causes it, not discovered by whichever consumer hits it first.
 *
 * `pnpm --filter @9nau/api contract:emit`   — rewrite the spec
 * `pnpm --filter @9nau/api contract:check`  — fail if it is stale
 *
 * Plain JS run with plain `node`, against the compiled `dist/`, deliberately —
 * see nau#122. Every TS-in-place runner tried here breaks on this file for a
 * different reason:
 *
 *   - `ts-node --transpile-only` (the original setup): `Debug Failure. Output
 *     generation failed` — a known ts-node/TypeScript 5.9 transpileModule
 *     incompatibility, tripped specifically by combining `@nau/gtd` with a
 *     `relations/gtd` subpath import.
 *   - `ts-node` without `--transpile-only` (full compile): fails to `require`
 *     one of packages/{name}/dist/relations/{name}/index.d.ts — apps/api/tsconfig.json maps
 *     those subpaths straight to their `.d.ts` via `paths` (needed because
 *     the classic module resolver doesn't read `package.json` `exports`), but
 *     that mapping is a compile-time-only fiction: requiring a `.d.ts` at
 *     runtime is requiring a file with no executable content.
 *   - `tsx`: resolves modules fine, but esbuild (what tsx transpiles with)
 *     does not emit `emitDecoratorMetadata` output. Nest's DI reads a
 *     constructor parameter's design-time type from that metadata to know
 *     what to inject — without it, every constructor-injected service comes
 *     back `undefined` (confirmed: `ConfigService` resolves to `undefined` in
 *     a minimal repro module, causing `PrivateStorageService` to crash on
 *     `this.configService.get(...)`). Silent at the framework level: Nest
 *     doesn't error on a missing type, it just can't resolve what to inject.
 *
 * The one thing that already handles both problems correctly is `nest build`
 * (real `tsc`, not `transpileModule`, wired through webpack-free but standard
 * CommonJS `require()` compilation) — it's what ships to production, and
 * production has never hit either failure. So: build first, then run the
 * compiled output with plain `node`, letting Node resolve
 * `@nau/actions/relations/gtd` etc. natively through each package's own
 * `package.json` `exports` — no `tsconfig-paths/register` needed once nothing is asking for
 * source-relative `paths` at runtime, which is what steers resolution to the
 * `.d.ts` in the first place.
 */
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { buildOpenApiDocument } = require('../dist/src/core/contract/openapi');

const SPEC_PATH = join(__dirname, '..', 'openapi.json');

async function main() {
  const checkOnly = process.argv.includes('--check');

  // The document is built from decorator metadata, so the app never listens and
  // never touches the database.
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  await app.close();

  const emitted = `${JSON.stringify(document, null, 2)}\n`;

  if (!checkOnly) {
    writeFileSync(SPEC_PATH, emitted);
    console.log(`Wrote ${SPEC_PATH}`);
    return;
  }

  if (!existsSync(SPEC_PATH)) {
    console.error('No openapi.json found. Run `pnpm contract:emit` and commit it.');
    process.exit(1);
  }

  if (readFileSync(SPEC_PATH, 'utf8') !== emitted) {
    console.error(
      [
        'openapi.json is out of date with the code.',
        '',
        'The api changed shape without the published contract changing with it,',
        'which is how a consumer ends up calling a route that no longer exists.',
        'Run `pnpm --filter @9nau/api contract:emit` and commit the result.',
      ].join('\n'),
    );
    process.exit(1);
  }

  console.log('openapi.json matches the code.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
