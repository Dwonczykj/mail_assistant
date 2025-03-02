import { Inject, Injectable, Scope } from '@nestjs/common';
import { IGoogleAuthService, IGoogleAuthService2 } from '../interfaces/google-auth.interface';
// import { WebGoogleAuthService } from './web-google-auth.service';
// import { DesktopGoogleAuthService } from './desktop-google-auth.service';
import { DesktopGoogleAuthService2, WebGoogleAuthService2 } from './desktop-google-auth.service';
import { ILogger } from '../../logger/ILogger';

export enum AuthEnvironment {
  WEB = 'web',
  DESKTOP = 'desktop'
}

@Injectable({ scope: Scope.DEFAULT })
export class GoogleAuthFactoryService {
  private readonly services: Map<AuthEnvironment, IGoogleAuthService2> = new Map();

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    // private readonly webGoogleAuthService: WebGoogleAuthService, // Need to chagne the module providers to include the 2 versions.
    // private readonly desktopGoogleAuthService: DesktopGoogleAuthService,
    private readonly webGoogleAuthService2: WebGoogleAuthService2,
    private readonly desktopGoogleAuthService2: DesktopGoogleAuthService2,
  ) {
    this.services.set(AuthEnvironment.WEB, webGoogleAuthService2);
    this.services.set(AuthEnvironment.DESKTOP, desktopGoogleAuthService2);
    // this.services.set(AuthEnvironment.WEB, webGoogleAuthService);
    // this.services.set(AuthEnvironment.DESKTOP, desktopGoogleAuthService);
  }

  getWebAuthService2() {
    return this.webGoogleAuthService2;
  }

  getDesktopAuthService2() {
    return this.desktopGoogleAuthService2;
  }

  getAuthService(environment: AuthEnvironment): IGoogleAuthService2 { // TODO: Change this so that type compilation fails and we can see all the calls from gmailClient, gmailservice, manager etc that we need to change.
    const service = this.services.get(environment);
    if (!service) {
      throw new Error(`No auth service available for environment: ${environment}`);
    }
    this.logger.info(`Returning [${service.constructor.name}] auth service for environment: ${environment}`);
    return service;
  }
} 