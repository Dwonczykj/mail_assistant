/**
 * ILogger Interface - defines common logging methods.
 */
export interface ILogger {
    debug(message: any, meta?: any): void;
    info(message: any, meta?: any): void;
    warn(message: any, meta?: any): void;
    error(message: any, meta?: any): void;
} 