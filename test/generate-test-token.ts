import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

if (__dirname.includes('test')) {
    dotenv.config({ path: path.resolve(__dirname, '/.env') });
} else {
    console.error('This script must be run from the test directory');
    process.exit(1);
}

// Create a JWT service with the same secret as your application
const jwtService = new JwtService({
    secret: process.env.JWT_SECRET!,
    signOptions: { expiresIn: '1h' },
});

// Create a payload for testing
const payload = {
    email: 'jdwonczyk.corp@gmail.com',
    accessToken: 'ya29.a0AeXRPp65QHEu4hepYJMZXhy-WrxjHlYqnxkC5IuEXsn3FA7qP0QhfY0sZCvyTP_1dH5QrdVY8qJy8n-0rZNCY35On9Ug_xGl0eSxYla0sGxdtcFDJrzyI0Pdw15mtGWtqg3hASEGc8OF4B-fjXcF4Ieq5Z8tuaD8kTvRkpgDBwaCgYKAXESARASFQHGX2Mi8LlqU30j_hSYxi6DGtnDAQ0177',
};

// Generate the token
const token = jwtService.sign(payload);

console.log('Generated test token:');
console.log(token);

// Save to .env file
const envPath = path.resolve(__dirname, '.env');
const envContent = `TEST_JWT_BEARER_TOKEN=${token}\n`;

fs.writeFileSync(envPath, envContent);
console.log(`Token saved to ${envPath}`); 