import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { User } from '../../data/entity/User';

export interface RequestContextData {
    user?: User | null;
    requestId?: string;
    process_type?: "daemon" | "webapi";
    // Add other context data as needed
}

@Injectable()
export class RequestContext {
    private static asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

    /**
     * Gets the current request context
     */
    static get(): RequestContextData {
        return this.asyncLocalStorage.getStore() || {};
    }

    /**
     * Sets data in the current request context
     */
    static set(data: RequestContextData): void {
        const currentStore = this.asyncLocalStorage.getStore() || {};
        this.asyncLocalStorage.enterWith({ ...currentStore, ...data });
    }

    /**
     * Initializes a new context and runs the callback within it
     * @param data Initial context data
     * @param callback Function to run within the context
     */
    static run<T>(data: RequestContextData, callback: () => T): T {
        return this.asyncLocalStorage.run(data, callback);
    }
} 