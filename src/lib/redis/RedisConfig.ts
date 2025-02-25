

export const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    keys: {
        gmail: {
            daemon: {
                oauth: {
                    token: 'gmail:daemon:oauth:token',
                    expiry: 'gmail:daemon:oauth:expiry',
                    refreshToken: 'gmail:daemon:oauth:refreshToken'
                }
            },
            web: {
                oauth: {
                    token: 'gmail:web:oauth:token',
                    expiry: 'gmail:web:oauth:expiry',
                    refreshToken: 'gmail:web:oauth:refreshToken'
                }
            }
        }
    }
};