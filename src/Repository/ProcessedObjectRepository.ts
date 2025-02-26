import { Repository } from 'typeorm';
import { ProcessedObject, ObjectType } from '../data/entity/ProcessedObject';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseInitializerService } from '../data/data-source';
import { ILogger } from '../lib/logger/ILogger';

@Injectable()
export class ProcessedObjectRepository implements OnModuleInit {
    private repository!: Repository<ProcessedObject>;

    constructor(
        @Inject(DatabaseInitializerService) private readonly databaseInitializer: DatabaseInitializerService,
        @Inject("ILogger") private readonly logger: ILogger
    ) { }

    async onModuleInit() {
        try {
            // Wait for database initialization to complete
            if (!this.databaseInitializer.dataSource.isInitialized) {
                this.logger.info("Waiting for database to initialize before setting up ProcessedObjectRepository");
                await this.databaseInitializer.initialize();
            }

            if (!this.databaseInitializer.dataSource.isInitialized) {
                this.logger.error("Database failed to initialize, repository will not be available");
                return;
            }

            this.repository = this.databaseInitializer.dataSource.getRepository(ProcessedObject);
            this.logger.info("ProcessedObjectRepository initialized successfully");
        } catch (error) {
            this.logger.error("Error initializing ProcessedObjectRepository:", { error: `${error}` });
        }
    }

    async save(object: Partial<ProcessedObject>): Promise<ProcessedObject> {
        if (!this.repository) {
            throw new Error("Repository not initialized");
        }
        return this.repository.save(object);
    }

    async findByTimeRange(options: {
        lastNHours?: number;
        objectType?: ObjectType;
    }): Promise<ProcessedObject[]> {
        if (!this.repository || !this.databaseInitializer.dataSource.isInitialized) {
            this.logger.error("Repository not initialized or database connection lost");
            return []; // Return empty array instead of throwing
        }

        try {
            const { lastNHours = 24, objectType = '*' } = options;

            const query = this.repository.createQueryBuilder('object')
                .where('object.object_timestamp >= :date', {
                    date: new Date(Date.now() - lastNHours * 60 * 60 * 1000)
                });

            if (objectType !== '*') {
                query.andWhere('object.type = :type', { type: objectType });
            }

            return await query.getMany();
        } catch (error) {
            this.logger.error("Error in findByTimeRange:", { error: `${error}` });
            return [];
        }
    }
} 