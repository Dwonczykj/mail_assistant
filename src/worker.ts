#!/usr/bin/env node
import { ILogger } from './lib/logger/ILogger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './web/app.module';
import { EmailServiceManager } from './EmailService/EmailServiceManager';
import { AuthEnvironment } from './lib/auth/services/google-auth-factory.service';


/**
 * Entry point for the async daemon Node.js TypeScript application.
 * This script will be run by PM2 as the daemon's entrypoint.
 */
async function main(): Promise<void> {
    console.log("Daemon started");

    // Create the app context with the DESKTOP environment
    const appContext = await NestFactory.createApplicationContext(
        AppModule.forRoot(AuthEnvironment.DESKTOP)
    );

    const logger = await appContext.resolve<ILogger>('ILogger');

    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', async () => {
        logger.info("Received SIGINT, shutting down...");
        await appContext.close();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info("Received SIGTERM, shutting down...");
        await appContext.close();
        process.exit(0);
    });

    logger.info("Worker started");

    const emailServiceManager = appContext.get(EmailServiceManager);

    if (!(await emailServiceManager.authenticated)) {
        await emailServiceManager.authenticate();
    }

    await emailServiceManager.fetchAndLabelLastEmails({ serviceName: "*", count: 10 });
    // Example daemon loop: replace this with actual daemon logic
    while (true) {
        // POLL for new emails every 60 seconds? before we register the webhook to process each new email for us rather than running this daemon.
        await new Promise<void>(resolve => setTimeout(resolve, 60000));
    }
}

main().catch((error: any) => {
    console.error("Error in daemon:", error);
    process.exit(1);
});
