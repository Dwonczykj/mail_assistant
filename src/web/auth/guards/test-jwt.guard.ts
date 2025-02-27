import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TestJwtGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            return false;
        }

        const [type, token] = authHeader.split(' ');

        if (type !== 'Bearer') {
            return false;
        }

        try {
            // Verify the token
            const payload = this.jwtService.verify(token);

            // In test mode, also check against environment variable
            if (process.env.NODE_ENV === 'test' && process.env.TEST_JWT_BEARER_TOKEN) {
                return token === process.env.TEST_JWT_BEARER_TOKEN;
            }

            // Store the payload on the request object
            request.user = payload;
            return true;
        } catch (error) {
            return false;
        }
    }
} 