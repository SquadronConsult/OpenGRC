import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { correlationContext } from './common/correlation-context';

function swaggerBasicAuth(req: Request, res: Response, next: NextFunction) {
  const user = process.env.SWAGGER_USER;
  const pass = process.env.SWAGGER_PASSWORD;
  if (!user || !pass) {
    return res
      .status(503)
      .send('OpenAPI is enabled but SWAGGER_USER and SWAGGER_PASSWORD must be set.');
  }
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="OpenAPI"');
    return res.status(401).send();
  }
  let decoded: string;
  try {
    decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
  } catch {
    res.setHeader('WWW-Authenticate', 'Basic realm="OpenAPI"');
    return res.status(401).send();
  }
  const sep = decoded.indexOf(':');
  const u = sep >= 0 ? decoded.slice(0, sep) : decoded;
  const p = sep >= 0 ? decoded.slice(sep + 1) : '';
  if (u !== user || p !== pass) {
    res.setHeader('WWW-Authenticate', 'Basic realm="OpenAPI"');
    return res.status(401).send();
  }
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.use((req, res, next) => {
    const id =
      (typeof req.headers['x-correlation-id'] === 'string' && req.headers['x-correlation-id']) ||
      randomUUID();
    req.correlationId = id;
    res.setHeader('x-correlation-id', id);
    correlationContext.run({ correlationId: id }, () => next());
  });
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const isProd = process.env.NODE_ENV === 'production';
  const swaggerEnabled = !isProd || process.env.SWAGGER_ENABLED === 'true';
  const logger = new Logger('Bootstrap');

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Compliance-as-Code API')
      .setDescription(
        [
          'REST API for compliance projects, checklists, integrations, and exports.',
          'Most routes require a Bearer JWT (`Authorization: Bearer <token>`).',
          'Integration routes under `/integrations/v1/projects/:projectId/...` accept a project integration key via `Authorization: Bearer <integration-key>` instead of a user JWT unless noted otherwise.',
          'List endpoints return `{ items, page, limit, total, hasMore }` unless noted. Rate limits: configurable via `API_THROTTLE_*` (429 Too Many Requests). `/health` and `/integrations/*` are excluded from the global throttler; integration routes still enforce per-project limits where configured.',
          isProd
            ? 'In production, OpenAPI UI requires Basic auth (SWAGGER_USER / SWAGGER_PASSWORD).'
            : 'OpenAPI UI is at `/docs`; spec at `/docs-json`.',
        ].join(' '),
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'User JWT or project integration key where applicable',
        },
        'bearer',
      )
      .addApiKey({ type: 'apiKey', name: 'idempotency-key', in: 'header' }, 'idempotency-key')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    if (isProd) {
      app.use('/docs', swaggerBasicAuth);
      app.use('/docs-json', swaggerBasicAuth);
    }
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`OpenAPI UI: /docs  spec: /docs-json${isProd ? ' (Basic auth required)' : ''}`);
  } else {
    logger.log('OpenAPI /docs disabled in production (set SWAGGER_ENABLED=true to enable)');
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`GRC API listening on ${port}`);
}
bootstrap();
