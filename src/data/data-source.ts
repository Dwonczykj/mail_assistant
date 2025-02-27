import { DataSource } from "typeorm";
import { FyxerAction } from "./entity/action";
import { ProcessedObject } from "./entity/ProcessedObject";
import { User } from "./entity/User";
import { AuthUser } from "./entity/AuthUser";
import path from "path";
import { ILogger } from "../lib/logger/ILogger";
import { Injectable, Inject, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";

const AppDataSource = new DataSource({
    type: "sqlite",
    database: path.join(process.cwd(), "data", "fyxer.sqlite"),
    entities: [FyxerAction, ProcessedObject, User, AuthUser],
    synchronize: true, // Be careful with this in production
    logging: true,
})

@Injectable()
export class DatabaseInitializerService implements OnApplicationBootstrap, OnApplicationShutdown {
    readonly dataSource: DataSource;
    private isInitialized = false;

    constructor(@Inject("ILogger") private readonly logger: ILogger) {
        this.dataSource = AppDataSource;
    }

    async onApplicationBootstrap() {
        await this.initialize();
    }

    async onApplicationShutdown() {
        await this.destroy();
    }

    async initialize() {
        if (this.isInitialized) {
            this.logger.info("Database connection already initialized, skipping");
            return;
        }

        if (this.dataSource.isInitialized) {
            this.logger.info("DataSource already initialized, skipping");
            this.isInitialized = true;
            return;
        }

        try {
            await this.dataSource.initialize();
            this.isInitialized = true;
            this.logger.info("Database connection initialized");
        } catch (error) {
            this.logger.error("Error initializing database:", { error: `${error}` });
        }
    }

    async destroy() {
        if (!this.isInitialized) {
            this.logger.info("Database connection not initialized, nothing to destroy");
            return;
        }

        try {
            await this.dataSource.destroy();
            this.isInitialized = false;
            this.logger.info("Database connection destroyed");
        } catch (error) {
            this.logger.error("Error destroying database:", { error: `${error}` });
        }
    }

    public static getDataSource(): DataSource {
        return AppDataSource;
    }
}