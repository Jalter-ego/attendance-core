import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept',
  });

  app.setGlobalPrefix('core/api/v1');

  await app.listen(process.env.PORT || 5000, () => {
    console.log(`Application is running on: http://localhost:${process.env.PORT || 5000}/core/api/v1`);
  });
}
bootstrap();
