import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

// Connect to Redis
await redisClient.connect();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { robotName, selectors, data } = req.body;

    if (!robotName || !selectors || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    let robots = await redisClient.get('robots');
    if (!robots) {
      robots = {};
    } else {
      robots = JSON.parse(robots);
    }
    
    robots[robotName] = selectors;
    await redisClient.set('robots', JSON.stringify(robots));

    let scrapedData = await redisClient.get('scraped_data');
    if (!scrapedData) {
      scrapedData = [];
    } else {
      scrapedData = JSON.parse(scrapedData);
    }
    
    const newEntry = {
      ...data,
      robotName,
      timestamp: new Date().toISOString()
    };
    scrapedData.push(newEntry);
    await redisClient.set('scraped_data', JSON.stringify(scrapedData));

    res.status(200).json({ 
      success: true, 
      message: 'Data saved successfully',
      count: scrapedData.length,
      robotName: robotName
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}