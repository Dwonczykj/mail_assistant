import { Controller, Get, Post, UseGuards, Inject, Res } from '@nestjs/common';
import { Response } from 'express';
import { EmailServiceManager } from '../../EmailService/EmailServiceManager';
import { AuthGuard } from '@nestjs/passport';
import { ILogger } from '../../lib/logger/ILogger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';


@Controller('webhook')
export class WebhookController {
    constructor(
        @Inject('EmailServiceManager') private readonly emailServiceManager: EmailServiceManager,
        @Inject('ILogger') private readonly logger: ILogger,
    ) { }

    /**
     * Registers Gmail mailbox listeners to watch for incoming emails
     * Requires authentication via Google OAuth
     */
    @Post('register-gmail')
    @UseGuards(JwtAuthGuard)
    async registerGmailWebhook(@Res() res: Response) {
        try {
            // Ensure we're authenticated
            const isAuthenticated = await this.emailServiceManager.authenticated;

            if (!isAuthenticated) {
                await this.emailServiceManager.authenticate();
            }

            // Register the mailbox listeners
            await this.emailServiceManager.registerMailboxListeners();

            this.logger.info('Gmail webhook registration successful');
            return res.status(200).json({
                success: true,
                message: 'Gmail webhook registration successful'
            });
        } catch (error) {
            this.logger.error('Failed to register Gmail webhook', { error });
            return res.status(500).json({
                success: false,
                message: 'Failed to register Gmail webhook',
                error: error instanceof Error ? error.message : `Unknown error: ${error}`
            });
        }
    }

    /**
     * Stops Gmail mailbox listeners
     * Requires authentication via Google OAuth
     */
    @Post('unregister-gmail')
    @UseGuards(JwtAuthGuard)
    async unregisterGmailWebhook(@Res() res: Response) {
        try {
            // Ensure we're authenticated
            const isAuthenticated = await this.emailServiceManager.authenticated;

            if (!isAuthenticated) {
                await this.emailServiceManager.authenticate();
            }

            // Destroy the mailbox listeners
            await this.emailServiceManager.destroyMailboxListeners();

            this.logger.info('Gmail webhook unregistered successfully');
            return res.status(200).json({
                success: true,
                message: 'Gmail webhook unregistered successfully'
            });
        } catch (error) {
            this.logger.error('Failed to unregister Gmail webhook', { error });
            return res.status(500).json({
                success: false,
                message: 'Failed to unregister Gmail webhook',
                error: error instanceof Error ? error.message : `Unknown error: ${error}`
            });
        }
    }

    /**
     * Gets the status of Gmail webhook registration
     */
    @Get('gmail-status')
    @UseGuards(JwtAuthGuard)
    async getGmailWebhookStatus(@Res() res: Response) {
        try {
            const isAuthenticated = await this.emailServiceManager.authenticated;

            // Get all email services
            const emailServices = await this.emailServiceManager.getEmailServices();

            // Get Gmail service specifically
            const gmailService = await this.emailServiceManager.getEmailService('gmail');

            // Check if listener is active
            const listenerStatus = gmailService.listenerService.isActive();

            return res.status(200).json({
                authenticated: isAuthenticated,
                listenerActive: listenerStatus,
                serviceCount: emailServices.length
            });
        } catch (error) {
            this.logger.error('Failed to get Gmail webhook status', { error });
            return res.status(500).json({
                success: false,
                message: 'Failed to get Gmail webhook status',
                error: error instanceof Error ? error.message : `Unknown error: ${error}`
            });
        }
    }

    /**
     * Development-only endpoint for registering Gmail webhook
     * WARNING: Remove in production
     */
    @Post('dev-register-gmail')
    async devRegisterGmailWebhook(@Res() res: Response) {
        try {
            await this.emailServiceManager.authenticate();
            await this.emailServiceManager.registerMailboxListeners();

            this.logger.info('Gmail webhook registration successful (dev mode)');
            return res.status(200).json({
                success: true,
                message: 'Gmail webhook registration successful (dev mode)'
            });
        } catch (error) {
            this.logger.error('Failed to register Gmail webhook (dev mode)', { error });
            return res.status(500).json({
                success: false,
                message: 'Failed to register Gmail webhook (dev mode)',
                error: error instanceof Error ? error.message : `Unknown error: ${error}`
            });
        }
    }
} 