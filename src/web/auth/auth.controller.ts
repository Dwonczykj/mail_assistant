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
        // Passport handles the redirect as if we are not authenticated, it will redirect us to google auth, and we are authenticated then it will do nothing.
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
            // Generate a JWT token for the user so that they can use it to make API requests for protected routes
            const jwtToken = await this.authService.handleGoogleCallback(user);

            if (!jwtToken) {
                res.status(500).send('Failed to generate JWT token');
                return;
            }

            if (req.headers.accept === 'application/json') {
                res.status(200).json({
                    token: jwtToken,
                    message: 'Authentication successful',
                    user: user
                });
                return;
            }

            // Return the token in a user-friendly page
            res.status(200).send(`
                <html>
                    <head>
                        <title>Authentication Successful</title>
                        <style>
                            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                            .token-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; word-break: break-all; }
                            button { background: #4285f4; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
                        </style>
                    </head>
                    <body>
                        <h1>Authentication Successful!</h1>
                        <p>Your access token is:</p>
                        <div class="token-box">${jwtToken}</div>
                        <button onclick="copyToken()">Copy Token</button>
                        <p>You can now use this token for API requests.</p>
                        <script>
                            function copyToken() {
                                const tokenText = document.querySelector('.token-box').textContent;
                                navigator.clipboard.writeText(tokenText)
                                    .then(() => alert('Token copied to clipboard!'))
                                    .catch(err => console.error('Failed to copy: ', err));
                            }
                        </script>
                        <p>User details:</p>
                        <pre>${JSON.stringify(user, null, 2)}</pre>
                    </body>
                </html>
            `);
        } catch (error) {
            console.error('Authentication error:', error);
            res.status(500).send('Authentication failed. Please try again.');
        }
    }
}