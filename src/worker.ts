#!/usr/bin/env node
import { ILogger } from './lib/logger/ILogger';
import { NestFactory } from '@nestjs/core';
// import { DaemonModule } from './daemon.module';
import { EmailServiceManager } from './EmailService/EmailServiceManager';
import { AuthEnvironment } from './lib/auth/services/google-auth-factory.service';
import { ServiceUserService } from './lib/auth/services/service-user.service';
import { RequestContext } from './lib/context/request-context';
import { DaemonModule } from './daemon.module';
import { User } from './data/entity/User';

/**
 * Entry point for the async daemon Node.js TypeScript application.
 * This script will be run by PM2 as the daemon's entrypoint.
 */
async function main(): Promise<void> {
    console.log("Daemon initialising...");

    // Create the app context with the DESKTOP environment
    const appContext = await NestFactory.createApplicationContext(
        DaemonModule.forRoot(AuthEnvironment.DESKTOP)
    );

    const logger = await appContext.resolve<ILogger>('ILogger');

    logger.debug("NestJS Daemon context created");

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

    const getServiceUser = async () => {
        const serviceUserService = appContext.get(ServiceUserService);
        const serviceUserId = await serviceUserService.getServiceUserId();
        return {
            serviceUser: serviceUserService.getServiceUser(),
            serviceUserCredentials: serviceUserService.getServiceUserCredentials(),
        };
    };

    const { serviceUser, serviceUserCredentials } = await getServiceUser();
    if (!serviceUserCredentials) {
        logger.error("Service user credentials not found");
        process.exit(1);
    }
    if (!serviceUser) {
        logger.error("Service user not found");
        process.exit(1);
    }
    logger.debug("Service user fetched");

    logger.debug(`Service user: ${serviceUser.email}`);
    logger.debug(`Service user credentials: ${serviceUserCredentials.accessToken}`);


    // Initialize the RequestContext which MUST WRAP THE ENTIRE DAEMON PROCESS.
    logger.debug("Initialising RequestContext for Daemon Application Scope");
    const threadId = Math.random().toString(36).slice(2, 9);
    RequestContext.run<Promise<void>>({
        process_type: "daemon",
        user: serviceUser,
        requestId: `daemon-worker-[${threadId}]-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }, async () => {
        try {


            logger.info("Worker started");

            // Verify that RequestContext is available and has a user
            const checkRequestContextExist = await appContext.resolve<RequestContext>('RequestContext');
            const contextData = RequestContext.get();
            if (!contextData.user) {
                logger.error('RequestContext user is null, trying to set it again');
                process.exit(1);
            }
            logger.info("RequestContext initialized successfully");

            // Now use the email service
            const emailServiceManager = appContext.get(EmailServiceManager);
            await emailServiceManager.registerMailboxListeners();
            await emailServiceManager.fetchAndLabelLastEmails({ serviceName: "*", count: 10 });

            // Example daemon loop: replace this with actual daemon logic
            process.exit(0);
        } catch (error) {
            console.error("Error in daemon:", error);
            process.exit(1);
        }
    });
}

main().catch((error: any) => {
    console.error("Error in daemon:", error);
    process.exit(1);
});


// TODO: 
// Fixes - Fix the continuous reauth issue for daemon constantly needing to run google-localauth authenticate due to loadCredentails not working
// - Run Daemon to register gmail to pubsub
// - Run WebAPI
// - Run NGrok
// - Send Test Message to Pub/Sub to check that webapi webhook gets the callback data
// - Ack the message with a post back from webapi to pubsub
// - Receive Test Email to check the webhook for emails
// - Ack the message with a post back from webapi to pubsub
// - Check Daemon Pull Sub?
// - Add webapi endpoint to check lifetime of pubsub subscription for both config.pull and push subscriptions