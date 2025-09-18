import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    app.enableCors();

    const port = process.env.PORT || 3000;

    await app.listen(port);

    logger.log(`Aplicação rodando na porta ${port}`);
  } catch (error) {
    logger.error('Erro ao iniciar aplicação:', error);
    process.exit(1);
  }
}

bootstrap();
