import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { RequestContext } from '../../../lib/context/request-context';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedException('No authorization header found');
        }

        const [type, token] = authHeader.split(' ');

        if (type !== 'Bearer') {
            throw new UnauthorizedException('Invalid authorization header format');
        }

        try {
            // Verify the token
            const payload = this.jwtService.verify(token);

            // Store the payload on the request object
            request.user = payload;

            // Also update the request context if it exists so that we can access the user in the global context
            try {
                RequestContext.set({ user: payload });
            } catch (error) {
                // Context might not be initialized yet, that's okay
            }

            return true;
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }
} 