import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

// Connect to Redis
await redisClient.connect();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
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
    } else if (req.method === 'DELETE') {
      const { robotName } = req.body;
      
      if (!robotName) {
        return res.status(400).json({ success: false, error: 'Robot name required' });
      }

      let robots = await redisClient.get('robots');
      if (!robots) {
        robots = {};
      } else {
        robots = JSON.parse(robots);
      }
      
      if (robots[robotName]) {
        delete robots[robotName];
        await redisClient.set('robots', JSON.stringify(robots));
        res.status(200).json({ 
          success: true,
          message: `Robot "${robotName}" deleted successfully`
        });
      } else {
        res.status(404).json({ 
          success: false,
          error: 'Robot not found'
        });
      }
    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Robots API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}