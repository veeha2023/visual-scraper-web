import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

// Helper function to ensure connection is open, wrapping the original connection
async function ensureRedisConnection() {
  if (!redisClient.isOpen) {
    // This connection attempt must be inside the handler's try/catch for robust error handling
    await redisClient.connect();
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ensure connection is established. If this fails, the catch block will run and return JSON.
    await ensureRedisConnection();

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
    } 
    else if (req.method === 'POST') {
      const { robotName, selectors } = req.body;
      
      if (!robotName || !selectors) {
        return res.status(400).json({ success: false, error: 'Robot name and selectors required' });
      }

      let robots = await redisClient.get('robots');
      if (!robots) {
        robots = {};
      } else {
        robots = JSON.parse(robots);
      }
      
      // Check if robot exists (POST is used for creation)
      if (robots[robotName]) {
        return res.status(409).json({ success: false, error: 'Robot already exists. Use PUT to update.' });
      }
      
      robots[robotName] = selectors;
      await redisClient.set('robots', JSON.stringify(robots));

      res.status(201).json({ 
        success: true,
        message: `Robot "${robotName}" created successfully`
      });
    }
    else if (req.method === 'PUT') {
      const { robotName, selectors } = req.body;

      if (!robotName || !selectors) {
        return res.status(400).json({ success: false, error: 'Robot name and selectors required' });
      }

      let robots = await redisClient.get('robots');
      if (!robots) {
        robots = {};
      } else {
        robots = JSON.parse(robots);
      }
      
      if (!robots[robotName]) {
        return res.status(404).json({ 
          success: false, 
          error: 'Robot not found' 
        });
      }

      robots[robotName] = selectors;
      await redisClient.set('robots', JSON.stringify(robots));

      res.status(200).json({ 
        success: true,
        message: `Robot "${robotName}" updated successfully`
      });
    }
    else if (req.method === 'DELETE') {
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
    // If connection fails, this catch block ensures a JSON 500 error is returned.
    console.error('Robots API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}