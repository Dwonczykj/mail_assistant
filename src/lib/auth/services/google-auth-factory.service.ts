import { Inject, Injectable, Scope } from '@nestjs/common';
import { IGoogleAuthService } from '../interfaces/google-auth.interface';
import { WebGoogleAuthService } from './web-google-auth.service';
import { DesktopGoogleAuthService } from './desktop-google-auth.service';
import { ILogger } from '../../logger/ILogger';

export enum AuthEnvironment {
  WEB = 'web',
  DESKTOP = 'desktop'
}

@Injectable({ scope: Scope.DEFAULT })
export class GoogleAuthFactoryService {
  private readonly services: Map<AuthEnvironment, IGoogleAuthService> = new Map();

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly webGoogleAuthService: WebGoogleAuthService,
    private readonly desktopGoogleAuthService: DesktopGoogleAuthService,
  ) {
    this.services.set(AuthEnvironment.WEB, webGoogleAuthService);
    this.services.set(AuthEnvironment.DESKTOP, desktopGoogleAuthService);
  }

  getAuthService(environment: AuthEnvironment): IGoogleAuthService {
    const service = this.services.get(environment);
    if (!service) {
      throw new Error(`No auth service available for environment: ${environment}`);
    }
    this.logger.info(`Returning [${service.constructor.name}] auth service for environment: ${environment}`);
    return service;
  }
} 