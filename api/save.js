import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

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
    const { robotName, selectors, data, workspace = 'general' } = req.body;

    if (!robotName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Robot name is required' 
      });
    }

    // Save robot (shared across all workspaces)
    if (selectors) {
      let robots = await redisClient.get('robots');
      if (!robots) {
        robots = {};
      } else {
        robots = JSON.parse(robots);
      }
      
      robots[robotName] = selectors;
      await redisClient.set('robots', JSON.stringify(robots));
    }

    // Save data to specific workspace
    if (data) {
      let workspaceData = await redisClient.get('workspace_data');
      if (!workspaceData) {
        workspaceData = {};
      } else {
        workspaceData = JSON.parse(workspaceData);
      }

      if (!workspaceData[workspace]) {
        workspaceData[workspace] = [];
      }

      const newEntry = {
        ...data,
        robotName,
        workspace: workspace,
        timestamp: new Date().toISOString()
      };
      
      workspaceData[workspace].push(newEntry);
      await redisClient.set('workspace_data', JSON.stringify(workspaceData));
    }

    res.status(200).json({ 
      success: true, 
      message: 'Data saved successfully',
      workspace: workspace,
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