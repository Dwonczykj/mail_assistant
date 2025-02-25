import { Repository, FindOptionsWhere, DeepPartial, ObjectLiteral } from "typeorm";
import { DatabaseInitializerService } from "../data/data-source";
import { Inject, Injectable } from "@nestjs/common";

@Injectable()
export abstract class BaseRepository<T extends ObjectLiteral & { id: string | number }> {
    protected repository: Repository<T>;

    constructor(private entity: new () => T, @Inject(DatabaseInitializerService) private readonly databaseInitializer: DatabaseInitializerService) {
        this.repository = this.databaseInitializer.dataSource.getRepository(entity);
    }

    async create(data: DeepPartial<T>): Promise<T> {
        const entity = this.repository.create(data);
        return await this.repository.save(entity);
    }

    async findById(id: string | number): Promise<T | null> {
        return await this.repository.findOneBy({ id } as FindOptionsWhere<T>);
    }

    async findAll(): Promise<T[]> {
        return await this.repository.find();
    }

    async update(id: string | number, data: DeepPartial<T>): Promise<T | null> {
        await this.repository.update(id, data);
        return this.findById(id);
    }

    async delete(id: string | number): Promise<boolean> {
        const result = await this.repository.delete(id);
        return result.affected ? result.affected > 0 : false;
    }
} 