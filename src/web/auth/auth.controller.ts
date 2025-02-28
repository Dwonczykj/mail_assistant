import { Controller, Get, UseGuards, Req, Res, HttpStatus, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { InitialiseGoogleAuthenticatedDependenciesService } from '../initialization/InitialiseGoogleAuthenticatedDependenciesService.service';
import { ILogger } from '../../lib/logger/ILogger';
import { IGoogleAuthService } from '../../lib/auth/interfaces/google-auth.interface';
import { AuthEnvironment, GoogleAuthFactoryService } from '../../lib/auth/services/google-auth-factory.service';
import { User } from '../../data/entity/User';
import { AuthUser } from '../../data/entity/AuthUser';
@Controller('auth')
export class AuthController {
    private googleAuthService: IGoogleAuthService;
    constructor(
        private readonly authService: AuthService,
        @Inject("ILogger") private readonly logger: ILogger,
        @Inject("GoogleAuthFactoryService") private readonly googleAuthFactoryService: GoogleAuthFactoryService,
        @Inject("APP_ENVIRONMENT") private readonly environment: AuthEnvironment,
        @Inject("InitialiseGoogleAuthenticatedDependenciesService") private readonly initialiseGoogleAuthenticatedDependenciesService: InitialiseGoogleAuthenticatedDependenciesService,
    ) {
        this.googleAuthService = this.googleAuthFactoryService.getAuthService(this.environment);
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {
        // This route initiates the Google OAuth flow
        // The guard will handle the redirection
    }

    /**
     * having the google authguard means this method calls validate in the google strategy 
     * after internally converting the code into an access token etc, it then uses the code so we 
     * cannot use it again here as we will get a GaxiosError: invalid_grant error for reusing the code 
     * after it has been used in the AuthGuard. If we removed the auth guar then then the followoing snippet would work:
     * ```
     * const params = new URLSearchParams(req.url.split('?')[1]);
     * const code = params.get('code');
     * const scope = params.get('scope');
     * const prompt = params.get('prompt');
     * this.logger.info('Google authentication callback received with params:', { code, scope, prompt });
     * 
     * await this.googleAuthService.handleOAuthCallback({
     *     code: code,
     *     scope: scope,
     *     prompt: prompt,
     * });
     * ```
     */
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        this.logger.info('Google authentication callback received with request:', { reqUrl: req.url });


        if (!('user' in req)) {
            this.logger.error('No user found in request but user should be present as it is added by the google strategy with @UseGuards(AuthGuard("google"))');
            throw new Error('No user found in request');
        }
        const user = (req as any).user;
        if (!('accessToken' in user)) {
            this.logger.error('No access token found in request but access token should be present as it is added by the google strategy with @UseGuards(AuthGuard("google"))');
            throw new Error('No access token found in request');
        }
        const { authUser, accessToken, refreshToken }: User & { authUser?: AuthUser, accessToken?: string, refreshToken?: string | null } = user;
        // After successful Google authentication, generate a JWT token
        const token = await this.authService.generateJwtToken({ user, accessToken });

        try {
            this.logger.info('Redirecting to frontend with token:', token);
            await this.authService.dummyAuthForUseAfterAuthGuard({ tokens: { access_token: accessToken, refresh_token: refreshToken } });

            //TODO: Apply an injected initialise-google-authenticated-dependencies service here
            // todo: why has the web google auth service got so complicated when the dummy does all we need for web -> create a new web google auth service that maps a jwtToken to the users accessToken and uses that to recreate the credentials OAuth2Client
            this.initialiseGoogleAuthenticatedDependenciesService.initialiseDependencies(token);
            // Redirect to frontend with token (frontend will store in local storage)
            return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
        } catch (error) {
            this.logger.error('Error redirecting to frontend:', error);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Error redirecting to frontend');
        }
    }
}