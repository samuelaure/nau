import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';

/**
 * The published contract.
 *
 * Five services consume this api — the web app, the Telegram bot, the mobile
 * client, and two content services — and until now none of them had a
 * machine-readable description of it. Each maintained its own hand-copied idea
 * of the shapes, and nothing checked that any of them still matched the server.
 * The measured cost of that: a route the web app called for months that the api
 * never exposed, found in production rather than at build time.
 *
 * The spec is emitted from the same decorators the server validates with, so it
 * cannot describe a route that does not exist or a field the server ignores.
 * That is the whole reason to generate it rather than write it.
 */
export const API_TITLE = 'naŭ Platform API';

/**
 * Versioned from the start.
 *
 * Three of the five consumers deploy independently of the api. Without a
 * version in the path, any breaking change has to land everywhere at once — and
 * "everywhere at once" is not available when one of those consumers is a mobile
 * app on someone's phone.
 */
export const API_VERSION = '1';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(API_TITLE)
    .setDescription(
      [
        'The backend of the naŭ modules.',
        '',
        'Routes under `/v1` are for authenticated people; routes under',
        '`/_service/v1` are for other naŭ services and are authenticated with a',
        'service token instead. The two are separated at the routing level, not',
        'by a naming convention, so a route cannot end up in the wrong audience',
        'by having the wrong decorator.',
      ].join('\n'),
    )
    .setVersion(API_VERSION)
    // Cookie for the browser, bearer for everything else — both are real paths
    // today, and a spec that documented only one would send an integrator down
    // the wrong one.
    .addCookieAuth('access_token', { type: 'apiKey' }, 'user-cookie')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'user-bearer')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'service-token')
    .build();

  return SwaggerModule.createDocument(app, config);
}

/**
 * Serves the spec and its browsable form.
 *
 * Exposed in every environment deliberately. A contract only visible to whoever
 * runs the server locally is not published, and the drift this exists to
 * prevent is exactly the kind that survives when nobody can look.
 */
export function mountOpenApi(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });
  return document;
}
