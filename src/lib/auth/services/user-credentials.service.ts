import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../../data/entity/User';
import { AuthUser, AuthProvider } from '../../../data/entity/AuthUser';
import { ILogger } from '../../../lib/logger/ILogger';

export interface UserCredentials {
    accessToken: string;
    refreshToken: string;
    expiryDate?: Date;
    userId: string;
    email?: string;
}

@Injectable()
export class UserCredentialsService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AuthUser)
        private authUserRepository: Repository<AuthUser>,
        @Inject('ILogger') private readonly logger: ILogger
    ) { }

    /**
     * Get the credentials for a user and provider
     * @param userId - The id of the user
     * @param provider - The provider of the credentials i.e. google, microsoft, etc.
     * @returns The credentials for the user and provider
     */
    async getUserCredentials(userId: string, provider: AuthProvider): Promise<UserCredentials | null> {
        try {
            const authUser = await this.authUserRepository.findOne({
                where: {
                    userId,
                    provider
                },
                relations: ['user']
            });

            if (!authUser) {
                this.logger.warn(`No credentials found for user ${userId} with provider ${provider}`);
                return null;
            }

            return {
                accessToken: authUser.accessToken,
                refreshToken: authUser.refreshToken,
                expiryDate: authUser.expiryDate,
                userId: authUser.userId,
                email: authUser.user?.email
            };
        } catch (error) {
            this.logger.error(`Error fetching user credentials: ${error}`, { error });
            return null;
        }
    }

    async updateUserCredentials(
        userId: string,
        provider: AuthProvider,
        credentials: Partial<UserCredentials>
    ): Promise<boolean> {
        try {
            const authUser = await this.authUserRepository.findOne({
                where: {
                    userId,
                    provider
                }
            });

            if (!authUser) {
                this.logger.warn(`Cannot update credentials: No auth record found for user ${userId} with provider ${provider}`);
                return false;
            }

            if (credentials.accessToken) {
                authUser.accessToken = credentials.accessToken;
            }

            if (credentials.refreshToken) {
                authUser.refreshToken = credentials.refreshToken;
            }

            if (credentials.expiryDate) {
                authUser.expiryDate = credentials.expiryDate;
            }

            await this.authUserRepository.save(authUser);
            return true;
        } catch (error) {
            this.logger.error(`Error updating user credentials: ${error}`, { error });
            return false;
        }
    }

    async saveUserCredentials(
        userId: string,
        provider: AuthProvider,
        credentials: Partial<UserCredentials>
    ): Promise<boolean> {
        try {
            const existingAuthUser = await this.authUserRepository.findOne({
                where: {
                    userId,
                    provider
                }
            });

            if (existingAuthUser) {
                return this.updateUserCredentials(userId, provider, credentials);
            }

            const authUser = new AuthUser();
            authUser.userId = userId;
            authUser.provider = provider;

            if (credentials.accessToken) {
                authUser.accessToken = credentials.accessToken;
            }

            if (credentials.refreshToken) {
                authUser.refreshToken = credentials.refreshToken;
            }

            if (credentials.expiryDate) {
                authUser.expiryDate = credentials.expiryDate;
            }

            await this.authUserRepository.save(authUser);
            return true;
        } catch (error) {
            this.logger.error(`Error updating user credentials: ${error}`, { error });
            return false;
        }
    }

    async getProviderForService(serviceName: string): Promise<AuthProvider> {
        // Map service names to auth providers
        switch (serviceName.toLowerCase()) {
            case 'gmail':
                return AuthProvider.GOOGLE;
            case 'exchange':
                return AuthProvider.MICROSOFT;

            default:
                throw new Error(`Unknown service: ${serviceName}`);
        }
    }
} 