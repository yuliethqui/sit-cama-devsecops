import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { PatientDataFilter } from './patients/patient-data.filter';

export function corsOrigins(env: NodeJS.ProcessEnv): string[] {
  const configured = env.APP_ORIGIN?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
  const origins = env.NODE_ENV === 'production' ? configured : ['http://localhost:8100', ...configured];
  return [...new Set(origins)].filter(origin => {
    try {
      const url = new URL(origin);
      return origin === url.origin && !url.username && !url.password &&
        (env.NODE_ENV === 'production' ? url.protocol === 'https:' : ['http:', 'https:'].includes(url.protocol));
    } catch { return false; }
  });
}

/** Shared by the real entry point and HTTP integration tests. */
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.use((_request: unknown, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigins(process.env),
    methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // Also sanitize body-parser/unknown-route errors before they reach a controller.
  app.useGlobalFilters(new PatientDataFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: () => new BadRequestException('Datos de entrada inválidos'),
  }));
}
