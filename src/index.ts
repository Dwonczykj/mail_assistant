#!/usr/bin/env node
import './container';
import { initServices } from './services';

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

    // Example daemon loop: replace this with actual daemon logic
    while (true) {
        await emailServiceManager.fetchLastNEmails({ serviceName: "*", count: 10 });

        await new Promise<void>(resolve => setTimeout(resolve, 60000));
    }
}

main().catch((error: any) => {
    console.error("Error in daemon:", error);
    process.exit(1);
});
