import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ILogger } from './ILogger';
import { injectable } from 'tsyringe';

@injectable()
export class WinstonLogger implements ILogger {
    private logger: Logger;

    constructor() {
        this.logger = createLogger({
            level: 'debug',
            format: format.combine(
                format.timestamp(),
                format.errors({ stack: true }),
                format.printf(({ timestamp, level, message, meta }) => {
                    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
                    return `${timestamp} [${level}]: ${message}${metaStr}`;
                })
            ),
            transports: [
                new transports.Console({
                    format: format.combine(
                        format.colorize(),
                        format.simple()
                    )
                }),
                new DailyRotateFile({
                    filename: 'logs/application-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '14d',
                    format: format.json()
                })
            ]
        });
    }

    debug(message: any, meta?: any): void {
        this.logger.debug(message?.toString() || "", { meta });
    }

    info(message: any, meta?: any): void {
        this.logger.info(message?.toString() || "", { meta });
    }

    warn(message: any, meta?: any): void {
        this.logger.warn(message?.toString() || "", { meta });
    }

    error(message: any, meta?: any): void {
        this.logger.error(message?.toString() || "", { meta });
    }
} 