import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import Redis from 'ioredis';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Get('google')
    async googleAuth(@Res() res: Response) {
        const authUrl = await this.authService.getGoogleAuthUrl();
        if (authUrl === "ALREADY_AUTHENTICATED") {
            res.send("Already authenticated, no further action required.");
        } else {
            res.redirect(authUrl);
        }
    }

    @Get('google/callback')
    async googleAuthCallback(
        @Query('code') code: string,
        @Res() res: Response,
    ) {
        // TODO: Check the state and get the sender from the state.
        await this.authService.handleGoogleCallback(code, "daemon");
        // Publish the OAuth code to Redis so the daemon can receive it.
        const redisPublisher = new Redis();
        redisPublisher.publish('googleAuthCode', code);
        res.send('Authentication successful! You can close this window.');
    }
} 