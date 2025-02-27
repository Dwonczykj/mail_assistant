/**
 * Decorator that ensures a client is authenticated before executing a method.
 * If authentication is needed, it will automatically refresh the token.
 */
export function EnsureAuthenticated() {
    return function (
        target: any, // DONT USE TARGET AS ALL PRIVATE METHODS ARE LOST OUT OF INSTANCE CONTEXT WHICH WE HAVE IN THE CALLBACK
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const self = this as any;
            if ("needsTokenRefresh" in self && "refreshAuthClient" in self) {
                // Check if client needs token refresh
                if (await self.needsTokenRefresh()) {
                    await self.refreshAuthClient();
                }
            } else {
                throw new Error(`Object in EnsureAuthenticated decorator (self) of type '${self.constructor.name}' does not have needsTokenRefresh or refreshAuthClient method`);
            }

            // Proceed with the original method after ensuring authentication
            return originalMethod.apply(self, args);
        };

        return descriptor;
    };
} 