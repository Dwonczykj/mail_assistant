import { FyxerActionRepository } from "../../src/Repository/FyxerActionRepository";
import { FyxerAction } from "../../src/data/entity/action";
import { DataSource, Repository } from "typeorm";
import { container } from "tsyringe";
import { beforeEach, describe, expect, it, jest, afterEach } from '@jest/globals';

describe('FyxerActionRepository', () => {
    let fyxerActionRepo: FyxerActionRepository;
    let mockTypeormRepo: jest.Mocked<Repository<FyxerAction>>;

    const mockAction: FyxerAction = {
        id: 1,
        actionName: 'testAction',
        actionData: { test: 'data' },
        createdAt: new Date(),
    };

    beforeEach(() => {
        // Mock the TypeORM repository
        mockTypeormRepo = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            findBy: jest.fn(),
            update: jest.fn(),
        } as any;

        // Mock DataSource
        const mockDataSource = {
            getRepository: jest.fn().mockReturnValue(mockTypeormRepo),
        } as unknown as DataSource;

        // Register mocks in container
        container.registerInstance(DataSource, mockDataSource);

        fyxerActionRepo = new FyxerActionRepository();
    });

    afterEach(() => {
        container.clearInstances();
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should successfully create a new action', async () => {
            mockTypeormRepo.create.mockReturnValue(mockAction);
            mockTypeormRepo.save.mockResolvedValue(mockAction);

            const result = await fyxerActionRepo.create(mockAction);

            expect(result).toEqual(mockAction);
            expect(mockTypeormRepo.create).toHaveBeenCalledWith(mockAction);
            expect(mockTypeormRepo.save).toHaveBeenCalledWith(mockAction);
        });

        it('should throw ValidationError when creating with invalid data', async () => {
            const invalidAction = {
                actionName: '', // Invalid empty name
                actionData: null,
                createdAt: 'invalid-date' as any,
            };

            mockTypeormRepo.create.mockImplementation(() => {
                throw new Error('Validation failed');
            });

            await expect(fyxerActionRepo.create(invalidAction))
                .rejects
                .toThrow('Validation failed');
        });
    });

    describe('findByName', () => {
        it('should find actions by name', async () => {
            const expectedActions = [mockAction];
            mockTypeormRepo.findBy.mockResolvedValue(expectedActions);

            const result = await fyxerActionRepo.findByName('testAction');

            expect(result).toEqual(expectedActions);
            expect(mockTypeormRepo.findBy).toHaveBeenCalledWith({ actionName: 'testAction' });
        });

        it('should return empty array when no actions found', async () => {
            mockTypeormRepo.findBy.mockResolvedValue([]);

            const result = await fyxerActionRepo.findByName('nonexistentAction');

            expect(result).toEqual([]);
        });

        it('should throw error when name parameter is invalid', async () => {
            await expect(fyxerActionRepo.findByName(''))
                .rejects
                .toThrow('Action name cannot be empty');
        });
    });

    describe('findById', () => {
        it('should find action by id', async () => {
            mockTypeormRepo.findOne.mockResolvedValue(mockAction);

            const result = await fyxerActionRepo.findById(1);

            expect(result).toEqual(mockAction);
            expect(mockTypeormRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
        });

        it('should return null when action not found', async () => {
            mockTypeormRepo.findOne.mockResolvedValue(null);

            const result = await fyxerActionRepo.findById(999);

            expect(result).toBeNull();
        });

        it('should throw error when id is invalid', async () => {
            await expect(fyxerActionRepo.findById(-1))
                .rejects
                .toThrow('Invalid ID provided');
        });
    });

    describe('update', () => {
        it('should successfully update an action', async () => {
            const updatedAction = { ...mockAction, actionName: 'updatedAction' };
            mockTypeormRepo.findOne.mockResolvedValue(mockAction);
            mockTypeormRepo.save.mockResolvedValue(updatedAction);

            const result = await fyxerActionRepo.update(1, { actionName: 'updatedAction' });

            expect(result).toEqual(updatedAction);
        });

        it('should throw error when updating non-existent action', async () => {
            mockTypeormRepo.findOne.mockResolvedValue(null);

            await expect(fyxerActionRepo.update(999, { actionName: 'updatedAction' }))
                .rejects
                .toThrow('Action not found');
        });
    });

    describe('delete', () => {
        it('should successfully delete an action', async () => {
            mockTypeormRepo.findOne.mockResolvedValue(mockAction);
            mockTypeormRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

            await fyxerActionRepo.delete(1);

            expect(mockTypeormRepo.delete).toHaveBeenCalledWith(1);
        });

        it('should throw error when deleting non-existent action', async () => {
            mockTypeormRepo.findOne.mockResolvedValue(null);

            await expect(fyxerActionRepo.delete(999))
                .rejects
                .toThrow('Action not found');
        });
    });

    describe('findAll', () => {
        it('should return all actions', async () => {
            const expectedActions = [mockAction];
            mockTypeormRepo.find.mockResolvedValue(expectedActions);

            const result = await fyxerActionRepo.findAll();

            expect(result).toEqual(expectedActions);
            expect(mockTypeormRepo.find).toHaveBeenCalled();
        });

        it('should return empty array when no actions exist', async () => {
            mockTypeormRepo.find.mockResolvedValue([]);

            const result = await fyxerActionRepo.findAll();

            expect(result).toEqual([]);
        });
    });
}); 