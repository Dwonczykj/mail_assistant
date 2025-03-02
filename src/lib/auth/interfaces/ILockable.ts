
export abstract class ILockable {
    private labelCreationLock: Promise<void> = Promise.resolve();

    protected async withLock<T>(operation: () => Promise<T>): Promise<T> {
        const unlock = await this.acquireLock();
        try {
            return await operation();
        } finally {
            unlock();
        }
    }

    /**
     * Acquires a lock on the label creation process.
     * This ensures that only one label creation can happen at a time.
     * It does it by creating a new promise each time we want mutex lock(){<code>} syntax 
     * so that each promise contains the <code> inside and the promises are chained 
     * so that only next one can start after the previous one has finished.
     * @returns A promise that resolves to a function to release the lock.
     */
    protected acquireLock(): Promise<() => void> {
        let unlockNext: () => void;
        const previousLock = this.labelCreationLock;
        this.labelCreationLock = new Promise<void>((resolve) => {
            unlockNext = resolve;
        });

        return previousLock.then(() => unlockNext);
    }
}