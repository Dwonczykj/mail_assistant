import { MockEmailRepository } from '../../src/Repository/MockEmailRepository';
import { Email } from '../../src/models/Email';
import { ILogger } from '../../src/lib/logger/ILogger';
import { generateMockEmails } from '../mocks/mockEmail';
import { IAmEmailService } from '../../src/EmailService/IAmEmailService';

// Mock the fs modules
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        appendFile: jest.fn(),
    },
}));

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
}));

describe('MockEmailRepository', () => {
    let mockEmailRepository: MockEmailRepository;
    let mockLogger: ILogger;
    let fs: any;
    let fss: any;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
        };

        // Get the mocked fs modules
        fs = require('fs').promises;
        fss = require('fs');

        // Create repository instance with mock logger
        mockEmailRepository = new MockEmailRepository(mockLogger);
    });

    describe('getEmails', () => {
        it('should return emails from the mock file', async () => {
            const mockEmails = [
                { id: '1', subject: 'Test Email 1' },
                { id: '2', subject: 'Test Email 2' },
            ];

            fs.readFile.mockResolvedValueOnce(JSON.stringify(mockEmails));

            const result = await mockEmailRepository.getEmails();

            expect(result).toEqual(mockEmails);
            expect(fs.readFile).toHaveBeenCalledTimes(1);
            expect(fs.readFile).toHaveBeenCalledWith(
                expect.stringContaining('mock_emails.json'),
                'utf8'
            );
        });

        it('should handle errors when reading emails', async () => {
            fs.readFile.mockRejectedValueOnce(new Error('Read error'));

            await expect(mockEmailRepository.getEmails()).rejects.toThrow('Read error');
        });
    });

    describe('saveEmails', () => {
        it('should save emails to the mock file', async () => {
            const mockEmails: Email[] = generateMockEmails({ count: 2 });

            // Mock file exists check
            fss.existsSync.mockReturnValueOnce(true);

            // Mock reading existing emails
            fs.readFile.mockResolvedValueOnce(JSON.stringify([]));

            await mockEmailRepository.saveEmails(mockEmails);

            expect(fs.writeFile).toHaveBeenCalledTimes(1);
            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('mock_emails.json'),
                JSON.stringify(mockEmails, null, 2)
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Saved 2 emails')
            );
        });

        it('should create file if it does not exist', async () => {
            const mockEmails: Email[] = generateMockEmails({ count: 1 });

            // Mock file doesn't exist
            fss.existsSync.mockReturnValueOnce(false);

            await mockEmailRepository.saveEmails(mockEmails);

            expect(fs.writeFile).toHaveBeenCalledTimes(2); // Once for creation, once for saving
            expect(fs.writeFile).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('mock_emails.json'),
                '[]'
            );
        });

        it('should handle errors when reading existing emails', async () => {
            const mockEmails: { email: Email, service?: IAmEmailService<any> }[] = generateMockEmails({ count: 1 });

            fss.existsSync.mockReturnValueOnce(true);
            fs.readFile.mockRejectedValueOnce(new Error('Read error'));

            await mockEmailRepository.saveEmails(mockEmails);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error reading mock emails file:',
                expect.any(Object)
            );
            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('mock_emails.json'),
                JSON.stringify(mockEmails, null, 2)
            );
        });
    });

    describe('logFyxerAction', () => {
        it('should log fyxer action to csv file', async () => {
            const action = 'TEST_ACTION';
            const data = 'test_data';

            // Mock file exists check
            fss.existsSync.mockReturnValueOnce(true);

            await mockEmailRepository.logFyxerAction(action, data);

            expect(fs.appendFile).toHaveBeenCalledTimes(1);
            expect(fs.appendFile).toHaveBeenCalledWith(
                expect.stringContaining('mock_fyxer_actions.csv'),
                `${action},${data}\n`
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Logged FyxerBot action: ${action}, ${data}`
            );
        });

        it('should create csv file if it does not exist', async () => {
            const action = 'TEST_ACTION';
            const data = 'test_data';

            // Mock file doesn't exist
            fss.existsSync.mockReturnValueOnce(false);

            await mockEmailRepository.logFyxerAction(action, data);

            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('mock_fyxer_actions.csv'),
                'action,data\n'
            );
            expect(fs.appendFile).toHaveBeenCalledWith(
                expect.stringContaining('mock_fyxer_actions.csv'),
                `${action},${data}\n`
            );
        });
    });
});
