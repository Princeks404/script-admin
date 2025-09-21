import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  try {
    console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Not Set');
    console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Not Set');
    
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return res.status(500).json({ 
        error: 'Missing Upstash environment variables',
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
      });
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Test connection with a simple ping
    await redis.set('test-key', 'test-value');
    const testValue = await redis.get('test-key');
    await redis.del('test-key');

    res.json({ 
      status: 'success', 
      message: 'Redis connection working',
      testValue: testValue
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ 
      error: 'Redis connection failed', 
      details: error.message 
    });
  }
}
