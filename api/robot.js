import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

// Connect to Redis
await redisClient.connect();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let robots = await redisClient.get('robots');
    if (!robots) {
      robots = {};
      await redisClient.set('robots', JSON.stringify(robots));
    } else {
      robots = JSON.parse(robots);
    }
    
    res.status(200).json({ 
      success: true,
      count: Object.keys(robots).length,
      robots: robots
    });
  } catch (error) {
    console.error('Robots fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}