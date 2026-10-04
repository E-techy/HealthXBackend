const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('connect', () => {
    console.log('✔ Redis connection initialized');
});

redis.on('ready', () => {
    console.log('✔ Redis ready to accept real-time commands');
});

redis.on('error', (err) => {
    console.error('✘ Redis Connection Error:', err.message);
});

module.exports = redis;
