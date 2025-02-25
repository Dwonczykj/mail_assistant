import { Repository } from 'typeorm';
import { ProcessedObject, ObjectType } from '../data/entity/ProcessedObject';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseInitializerService } from '../data/data-source';

@Injectable()
export class ProcessedObjectRepository {
    private repository: Repository<ProcessedObject>;

    constructor(
        @Inject(DatabaseInitializerService) private readonly databaseInitializer: DatabaseInitializerService
    ) {
        this.repository = this.databaseInitializer.dataSource.getRepository(ProcessedObject);
    }

    async save(object: Partial<ProcessedObject>): Promise<ProcessedObject> {
        return this.repository.save(object);
    }

    async findByTimeRange(options: {
        lastNHours?: number;
        objectType?: ObjectType;
    }): Promise<ProcessedObject[]> {
        const { lastNHours = 24, objectType = '*' } = options;

        const query = this.repository.createQueryBuilder('object')
            .where('object.object_timestamp >= :date', {
                date: new Date(Date.now() - lastNHours * 60 * 60 * 1000)
            });

        if (objectType !== '*') {
            query.andWhere('object.type = :type', { type: objectType });
        }

        return query.getMany();
    }
} 