import { DataSource } from "typeorm";
import { EmailAction } from "./entity/action";


export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "test",
    password: "test",
    database: "test",
    synchronize: true,
    logging: true,
    entities: [EmailAction],
    subscribers: [],
    migrations: [],
})