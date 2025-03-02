import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext, RequestContextData } from './request-context';
import { User } from '../../data/entity/User';
import { UserCredentials } from '../auth/services/user-credentials.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Create context data with user from request (if available)
        const process_type = "webapi";
        const contextData: RequestContextData = {
            user: req.user as User | undefined, // Type assertion to match RequestContextData
            requestId: req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            process_type: process_type,
        };

        // Run the next middleware within this context (in the daemon context we have to run this around the enitire deameon process like we would the redux store.)
        RequestContext.run(contextData, () => {
            next();
        });
    }
} 