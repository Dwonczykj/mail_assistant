import { DataSource } from "typeorm";
import { FyxerAction } from "./entity/action";
import path from "path";
import { ILogger } from "../lib/logger/ILogger";
import { Injectable, Inject, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";

const AppDataSource = new DataSource({
    type: "sqlite",
    database: path.join(process.cwd(), "data", "fyxer.sqlite"),
    entities: [FyxerAction],
    synchronize: true, // Be careful with this in production
    logging: true,
})

@Injectable()
export class DatabaseInitializerService implements OnApplicationBootstrap, OnApplicationShutdown {
    readonly dataSource: DataSource;

    constructor( @Inject("ILogger") private readonly logger: ILogger) {
        this.dataSource = AppDataSource;
    }

    async onApplicationBootstrap() {
        await this.initialize();
    }

    async onApplicationShutdown() {
        await this.destroy();
    }

    async initialize() {
        await this.dataSource.initialize()
            .then(() => {
                this.logger.info("Database connection initialized");
            })
            .catch((error) => this.logger.error("Error initializing database:", error));
    }

    async destroy() {
        await this.dataSource.destroy()
            .then(() => {
                this.logger.info("Database connection destroyed");
            })
            .catch((error) => this.logger.error("Error destroying database:", error));
    }
}