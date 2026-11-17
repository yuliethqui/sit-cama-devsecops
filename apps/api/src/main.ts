import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  configureApp(app);
  await app.listen(Number(process.env.PORT || '3000'), '0.0.0.0');
}
bootstrap().catch((error: unknown) => {
  console.error('La API no pudo iniciar:', error instanceof Error ? error.message : 'error');
  process.exit(1);
});
