export interface IProcessor<T> {
    run(payload: T): Promise<void>;
}