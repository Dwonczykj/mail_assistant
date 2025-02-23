import { DataSource } from "typeorm";
import { FyxerAction } from "./entity/action";
import path from "path";

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: path.join(process.cwd(), "data", "fyxer.sqlite"),
    entities: [FyxerAction],
    synchronize: true, // Be careful with this in production
    logging: true,
})