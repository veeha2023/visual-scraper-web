import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

await redisClient.connect();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { workspace = 'general' } = req.query;

    if (req.method === 'GET') {
      let workspaceData = await redisClient.get('workspace_data');
      if (!workspaceData) {
        workspaceData = {};
        await redisClient.set('workspace_data', JSON.stringify(workspaceData));
      } else {
        workspaceData = JSON.parse(workspaceData);
      }

      const data = workspaceData[workspace] || [];
      
      res.status(200).json({ 
        success: true,
        count: data.length,
        data: data,
        workspace: workspace,
        lastUpdated: data.length > 0 ? data[data.length - 1].timestamp : null
      });

    } else if (req.method === 'DELETE') {
      let workspaceData = await redisClient.get('workspace_data');
      if (!workspaceData) {
        workspaceData = {};
      } else {
        workspaceData = JSON.parse(workspaceData);
      }

      workspaceData[workspace] = [];
      await redisClient.set('workspace_data', JSON.stringify(workspaceData));

      res.status(200).json({ 
        success: true,
        message: `Data cleared from workspace "${workspace}"`,
        workspace: workspace
      });

    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Data API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}