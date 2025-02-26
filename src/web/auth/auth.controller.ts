import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {
        // Passport handles the redirect
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        try {
            // The user data is available in req.user after successful authentication
            const user = req.user;

            // Handle the callback with the auth service
            await this.authService.handleGoogleCallback(user);

            res.send('Authentication successful! You can close this window.');
        } catch (error) {
            console.error('Authentication error:', error);
            res.status(500).send('Authentication failed. Please try again.');
        }
    }
} 