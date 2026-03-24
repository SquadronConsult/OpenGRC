import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { correlationContext } from './common/correlation-context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
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
      forbidNonWhitelisted: false,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Compliance-as-Code API')
    .setDescription(
      [
        'REST API for compliance projects, checklists, integrations, and exports.',
        'Most routes require a Bearer JWT (`Authorization: Bearer <token>`).',
        'Integration routes under `/integrations/v1/projects/:projectId/...` accept a project integration key via `Authorization: Bearer <integration-key>` instead of a user JWT unless noted otherwise.',
        'List endpoints return `{ items, page, limit, total, hasMore }` unless noted. Rate limits: configurable via `API_THROTTLE_*` (429 Too Many Requests). `/health`, `/docs`, and `/integrations/*` are excluded from the global throttler; integration routes still enforce per-project limits where configured.',
      ].join(' '),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'User JWT or project integration key where applicable' },
      'bearer',
    )
    .addApiKey({ type: 'apiKey', name: 'idempotency-key', in: 'header' }, 'idempotency-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`GRC API listening on ${port}`);
  logger.log(`OpenAPI UI: http://0.0.0.0:${port}/docs  spec: /docs-json`);
}
bootstrap();
