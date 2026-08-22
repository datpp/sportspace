import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { UPLOADS_ROOT_DIR } from './venue/venue-uploads.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(UPLOADS_ROOT_DIR, { prefix: '/uploads' });

  const config = new DocumentBuilder()
    .setTitle('SportSpace API')
    .setDescription('Đặt sân thể thao + kết nối đồng đội')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, { jsonDocumentUrl: 'api-json' });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
