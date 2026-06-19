import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 启用 CORS
  app.enableCors();
  
  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe());
  
  // 监听端口 3092
  await app.listen(3092);
  console.log('简历解析服务已启动，端口: 3092');
}

bootstrap();
