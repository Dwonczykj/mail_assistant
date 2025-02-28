// TODO: Add a very simple default get("/") endpoint that if request has header "Authorization" then it returns a 200 status code and a message "Hello World" else a button to navigate to "/auth/google" except if request has application/json content type then it returns a 200 status code and a message "Hello World" else a json object with link to navigate to "/auth/google"

import { Controller, Get, Header, Req } from "@nestjs/common";
import { AuthService } from "./auth/auth.service";

@Controller()
export class AppController {
    constructor(private readonly authService: AuthService) { }

    @Get()
    @Header('Content-Type', 'text/html')
    @Header('Authorization', 'Bearer <token>')
    async getHello(@Req() req: Request): Promise<string> {
        if (req.headers.get('authorization')) {
            const bearerToken = req.headers.get('authorization')?.split(' ')[1];
            if (bearerToken) {
                const token = await this.authService.validateToken(bearerToken);
                if (token) {
                    return 'Hello User';
                }
            }
            return '<a href="/auth/google">Login with Google</a>';
        } else {
            return '<a href="/auth/google">Login with Google</a>';
        }
    }

    @Get()
    @Header('Content-Type', 'application/json')
    async getHelloJson(@Req() req: Request): Promise<{ link?: string, message?: string }> {
        if (req.headers.get('authorization')) {
            const bearerToken = req.headers.get('authorization')?.split(' ')[1];
            if (bearerToken) {
                const token = await this.authService.validateToken(bearerToken);
                if (token) {
                    return { message: 'Hello User' };
                }
            }
            return { link: '/auth/google' };
        } else {
            return { link: '/auth/google' };
        }

    }
}
