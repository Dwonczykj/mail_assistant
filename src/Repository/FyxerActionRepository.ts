import { FyxerAction } from "../data/entity/action";
import { BaseRepository } from "./BaseRepository";
import { IFyxerActionRepository } from "./IFyxerActionRepository";
import { injectable } from "tsyringe";
import { ValidationError, NotFoundError, InvalidArgumentError } from "./errors/RepositoryErrors";

@injectable()
export class FyxerActionRepository extends BaseRepository<FyxerAction> implements IFyxerActionRepository {
    constructor() {
        super(FyxerAction);
    }

    // Add custom methods specific to FyxerAction here
    async findByName(name: string): Promise<FyxerAction[]> {
        if (!name || name.trim().length === 0) {
            throw new InvalidArgumentError('Action name cannot be empty');
        }
        return await this.repository.findBy({ actionName: name });
    }

    async findById(id: string | number): Promise<FyxerAction | null> {
        if (!id || (typeof id === 'string' && id.trim().length === 0) || (typeof id === 'number' && id < 1)) {
            throw new InvalidArgumentError('Invalid ID provided');
        }
        return await this.repository.findOne({ where: { id: id as number } });
    }

    async create(action: Partial<FyxerAction>): Promise<FyxerAction> {
        try {
            if (!action.actionName || !action.actionData) {
                throw new ValidationError('Action name and data are required');
            }
            const newAction = this.repository.create(action);
            return await this.repository.save(newAction);
        } catch (error) {
            if (error instanceof Error) {
                throw new ValidationError(error.message);
            }
            throw error;
        }
    }

    async update(id: number, action: Partial<FyxerAction>): Promise<FyxerAction> {
        const existingAction = await this.findById(id);
        if (!existingAction) {
            throw new NotFoundError('Action not found');
        }

        Object.assign(existingAction, action);
        return await this.repository.save(existingAction);
    }

    async delete(id: string | number): Promise<boolean> {
        const existingAction = await this.findById(id);
        if (!existingAction) {
            throw new NotFoundError('Action not found');
            return false;
        }
        await this.repository.delete(id);
        return true;
    }

    async createAction(actionData: any): Promise<FyxerAction> {
        const action = new FyxerAction();
        action.setActionData(actionData);
        return await this.repository.save(action);
    }

    async getAction(id: number): Promise<FyxerAction | null> {
        const action = await this.findById(id);
        return action;
    }
} 