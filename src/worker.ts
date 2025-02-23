#!/usr/bin/env node
import './container';
import { ILogger } from './lib/logger/ILogger';
import { initServices } from './services';
import { container } from './container';
/**
 * Entry point for the async daemon Node.js TypeScript application.
 * This script will be run by PM2 as the daemon's entrypoint.
 */

async function main(): Promise<void> {
    console.log("Daemon started");

    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', () => {
        console.log("Received SIGINT, shutting down...");
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log("Received SIGTERM, shutting down...");
        process.exit(0);
    });

    const { emailServiceManager } = await initServices();

    const logger = container.resolve<ILogger>('ILogger');

    await emailServiceManager.saveLastNEmails({ serviceName: "*", count: 10 });
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
