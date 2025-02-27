import { Controller, Get, UseGuards, Req, Res, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {
        // This route initiates the Google OAuth flow
        // The guard will handle the redirection
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        // After successful Google authentication, generate a JWT token
        const token = await this.authService.generateJwtToken((req as any).user);

        // Redirect to frontend with token (frontend will store in local storage)
        return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }
}