// src/decorators/ensure-authenticated.decorator.ts

export function EnsureAuthenticated() {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ) {
      const originalMethod = descriptor.value;
  
      descriptor.value = async function (...args: any[]) {
        // 'this' refers to the instance of the EmailClient.
        // Check if the client is authenticated (e.g., token exists and is valid)
        if (!await this.isAuthenticated()) {
          await this.refreshAuthentication();
        }
        // Proceed with the original method after ensuring authentication.
        return originalMethod.apply(this, args);
      };
  
      return descriptor;
    };
  }