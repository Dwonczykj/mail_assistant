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

    // Initialize email service and set up Gmail webhook
    await initServices();
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