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
      let scrapedData = await redisClient.get('scraped_data');
      if (!scrapedData) {
        scrapedData = [];
        await redisClient.set('scraped_data', JSON.stringify(scrapedData));
      } else {
        scrapedData = JSON.parse(scrapedData);
      }
      
      res.status(200).json({ 
        success: true,
        count: Array.isArray(scrapedData) ? scrapedData.length : 0,
        data: scrapedData,
        lastUpdated: Array.isArray(scrapedData) && scrapedData.length > 0 
          ? scrapedData[scrapedData.length - 1].timestamp 
          : null
      });
    } else if (req.method === 'DELETE') {
      await redisClient.set('scraped_data', JSON.stringify([]));
      res.status(200).json({ 
        success: true,
        message: 'All data cleared'
      });
    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Data fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Redis connection error'
    });
  }
}