import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { EmailServiceManager } from '../EmailService/EmailServiceManager';
import { AuthEnvironment } from '../lib/auth/services/google-auth-factory.service';

async function bootstrap(): Promise<void> {
    const logger = new Logger('Bootstrap');

    // Create the app with the WEB environment
    const app = await NestFactory.create(
        AppModule.forRoot(AuthEnvironment.WEB),
        { logger: ['error', 'warn', 'log', 'debug', 'verbose'] }
    );

    // Enable CORS for development
    app.enableCors({
        origin: ['http://localhost:5000', 'http://localhost:3000'],
        credentials: true,
    });

    // Get the email service manager
    const emailServiceManager = app.get(EmailServiceManager);

    const port = process.env.WEB_PORT || 3000;
    await app.listen(port);
    logger.log(`Web API is running on: http://localhost:${port}`);

    process.on('SIGINT', async () => {
        logger.log('SIGINT received, shutting down...');
        await emailServiceManager.destroyMailboxListeners();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.log('SIGTERM received, shutting down...');
        await emailServiceManager.destroyMailboxListeners();
        process.exit(0);
    });
}

bootstrap().catch((error) => {
    console.error('Failed to start web application:', error);
    process.exit(1);
}); 