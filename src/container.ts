import 'reflect-metadata';
import { container } from 'tsyringe';
import { ILogger } from './lib/logger/ILogger';
import { WinstonLogger } from './lib/logger/WinstonLogger';
import { CategoriserFactory } from './Categoriser/CategoriserFactory';
import { ICategoriser } from './Categoriser/ICategoriser';
import { MockEmailRepository } from './Repository/MockEmailRepository';
import { IMockEmailRepository } from './Repository/IMockEmailRepository';
import { IFyxerActionRepository } from './Repository/IFyxerActionRepository';
import { FyxerActionRepository } from './Repository/FyxerActionRepository';
import { AppDataSource } from './data/data-source';
import { createRedisClient } from './lib/redis/RedisProvider';
import Redis from 'ioredis';
import { IGmailAuth } from './lib/utils/IGmailAuth';
import { GmailAuthForDaemon } from './lib/utils/gmailAuth';

// Initialize TypeORM connection
AppDataSource.initialize()
    .then(() => {
        console.log("Database connection initialized");
    })
    .catch((error) => console.error("Error initializing database:", error));

// Register WinstonLogger as the ILogger implementation for dependency injection.
container.register<ILogger>('ILogger', { useClass: WinstonLogger });

// Register CategoriserFactory as the ICategoriser implementation for dependency injection.
container.register<ICategoriser>('ICategoriser', { useFactory: () => CategoriserFactory.createCategoriserOpenAI() });

// Register Redis client for dependency injection.
container.register<Redis>('REDIS_CLIENT', { useFactory: createRedisClient });

// Register GmailAuthForDaemon as the IGmailAuth implementation for dependency injection.
container.register<IGmailAuth>('IGmailAuth', { useClass: GmailAuthForDaemon });

// Register MockEmailRepository as the IMockEmailRepository implementation for dependency injection.
container.register<IMockEmailRepository>('IMockEmailRepository', { useClass: MockEmailRepository });

// Register FyxerActionRepository
container.register<IFyxerActionRepository>('IFyxerActionRepository', { useClass: FyxerActionRepository });

export { container }; 