import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import Redis from 'ioredis';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Res() res: Response) {
        const authUrl = await this.authService.getGoogleAuthUrl();
        if (authUrl === "ALREADY_AUTHENTICATED") {
            res.send("Already authenticated, no further action required.");
        } else {
            res.redirect(authUrl);
        }
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(
        @Req() req: Request,
        @Query('code') code: string,
        @Res() res: Response,
    ) {
        // const authenticatedUser = req.user;
        await this.authService.handleGoogleCallback(code, "daemon");
        res.send('Authentication successful! You can close this window.');
    }
} 