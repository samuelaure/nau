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
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/core/contract/openapi';

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
