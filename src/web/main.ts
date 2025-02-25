import '../container';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { EmailServiceManager } from '../EmailService/EmailServiceManager';
import { initServices } from '../services';

async function bootstrap(): Promise<void> {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Enable CORS for development
    app.enableCors({
        origin: ['http://localhost:5000', 'http://localhost:3000'],
        credentials: true,
    });

    // BUG: This EmailServiceManager calls dependencies on the container, but here we need the nestjs container... we need a simple and obvious fix like sharing the nestjs container with the container.ts file instead of using tsyringe or something but keeping the separate IGoogleAuth implementations for both daemon and web.
    // It should then be made very clear when authentication is needed and when it is called and why and where from.
    const emailServiceManager = EmailServiceManager.getInstance();

    const gmailService = await emailServiceManager.getEmailService('gmail');
    await gmailService.listenForIncomingEmails();

    const port = process.env.WEB_PORT || 3000;
    await app.listen(port);
    logger.log(`Web API is running on: http://localhost:${port}`);
}

bootstrap().catch((error) => {
    console.error('Failed to start web application:', error);
}); 