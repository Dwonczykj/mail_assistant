import 'reflect-metadata';
import { container } from 'tsyringe';
import { ILogger } from './lib/logger/ILogger';
import { WinstonLogger } from './lib/logger/WinstonLogger';

// Register WinstonLogger as the ILogger implementation for dependency injection.
container.register<ILogger>('ILogger', { useClass: WinstonLogger });

export { container }; 