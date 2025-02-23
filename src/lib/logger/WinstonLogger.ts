import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ILogger } from './ILogger';
import { injectable } from 'tsyringe';

@injectable()
export class WinstonLogger implements ILogger {
    private logger: Logger;

    constructor() {
        this.logger = createLogger({
            level: 'info',
            format: format.combine(
                format.timestamp(),
                format.json()
            ),
            transports: [
                new transports.Console(),
                new transports.Console(
                    {
                        debugStdout: true,
                    }
                ),
                new DailyRotateFile({
                    filename: 'logs/application-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '14d'
                })
            ]
        });
    }

    debug(message: any, meta?: any): void {
        this.logger.debug(message?.toString() || "", meta);
    }

    info(message: any, meta?: any): void {
        this.logger.info(message?.toString() || "", meta);
    }

    warn(message: any, meta?: any): void {
        this.logger.warn(message?.toString() || "", meta);
    }

    error(message: any, meta?: any): void {
        this.logger.error(message?.toString() || "", meta);
    }
} 