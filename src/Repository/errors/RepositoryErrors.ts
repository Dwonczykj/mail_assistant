export class RepositoryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class ValidationError extends RepositoryError {
    constructor(message: string) {
        super(`Validation Error: ${message}`);
    }
}

export class NotFoundError extends RepositoryError {
    constructor(message: string) {
        super(`Not Found Error: ${message}`);
    }
}

export class InvalidArgumentError extends RepositoryError {
    constructor(message: string) {
        super(`Invalid Argument Error: ${message}`);
    }
} 