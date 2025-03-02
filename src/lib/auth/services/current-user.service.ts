import { Injectable, Inject, Scope } from '@nestjs/common';
import { RequestContext } from '../../context/request-context';
import { ServiceUserService } from './service-user.service';
import { User } from '../../../data/entity/User';
import { AuthEnvironment } from './google-auth-factory.service';
import { ILogger } from '../../logger/ILogger';

@Injectable()
export class CurrentUserService {
    constructor(
        private readonly serviceUserService: ServiceUserService,
        @Inject('ILogger') private readonly logger: ILogger,
        @Inject('APP_ENVIRONMENT') private readonly environment: AuthEnvironment
    ) { }

    async getCurrentUser(): Promise<User> {
        try {
            // For web environment, try to get user from request context
            if (this.environment === AuthEnvironment.WEB) {
                try {
                    const context = RequestContext.get();
                    if (context.user) {
                        return context.user;
                    }
                } catch (error) {
                    this.logger.warn('No request context available, falling back to service user');
                }
            }

            // For desktop environment or if no user in context, use service user
            const serviceUserId = await this.serviceUserService.getServiceUserId();
            return { id: serviceUserId } as User; // Simplified - you might want to load the full user
        } catch (error) {
            this.logger.error('Failed to get current user', error);
            throw error;
        }
    }
} 