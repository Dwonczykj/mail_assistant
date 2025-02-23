import { FyxerAction } from "../data/entity/action";

export interface IFyxerActionRepository {
    create(data: Partial<FyxerAction>): Promise<FyxerAction>;
    findById(id: string | number): Promise<FyxerAction | null>;
    findAll(): Promise<FyxerAction[]>;
    update(id: string | number, data: Partial<FyxerAction>): Promise<FyxerAction | null>;
    delete(id: string | number): Promise<boolean>;
    findByName(name: string): Promise<FyxerAction[]>;
} 