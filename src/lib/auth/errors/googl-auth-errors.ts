

export class GoogleDesktopAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GoogleDesktopAuthError';
    }
}
export class GoogleWebAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GoogleWebAuthError';
    }
}
