

export const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    keys: {
        gmail: {
            oauth: {
                token: 'gmail:oauth:token',
                expiry: 'gmail:oauth:expiry'
            }
        }
    }
}