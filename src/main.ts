import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildCorsOriginCheck } from './config/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    // Acepta una lista separada por comas, con `*` como comodín de subdominio,
    // porque el frontend resuelve el tenant desde el subdominio
    origin: buildCorsOriginCheck(process.env.CORS_ORIGIN),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    // Sin esto el navegador no deja leer el nombre del archivo que se descarga (RF-17)
    exposedHeaders: 'Content-Disposition',
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.setGlobalPrefix('core/api/v1');

  await app.listen(process.env.PORT || 5000, () => {
    console.log(`Application is running on: http://localhost:${process.env.PORT || 5000}/core/api/v1`);
  });
}
bootstrap();
