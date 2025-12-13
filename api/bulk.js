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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Ensure connection is established. If this fails, the catch block will run and return JSON.
    await ensureRedisConnection();
    
    const { urls, robotName, workspace = 'general' } = req.body;

    if (!urls || !robotName) {
      return res.status(400).json({ 
        success: false, 
        error: 'URLs and robot name are required' 
      });
    }

    // Validate URLs array
    const urlArray = Array.isArray(urls) ? urls : [urls];
    if (urlArray.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one URL is required' 
      });
    }

    // Limit to 50 URLs to prevent abuse
    const limitedUrls = urlArray.slice(0, 50);

    // Get robot configuration
    let robots = await redisClient.get('robots');
    if (!robots) {
      return res.status(404).json({ success: false, error: 'No robots configured' });
    }
    robots = JSON.parse(robots);
    
    const robotConfig = robots[robotName];
    if (!robotConfig) {
      return res.status(404).json({ success: false, error: `Robot "${robotName}" not found` });
    }

    const results = [];

    // Simulate bulk scraping process (since actual scraping requires a browser environment)
    for (const url of limitedUrls) {
      try {
        // Mock data creation based on robot selectors
        const mockData = {};
        
        robotConfig.forEach(field => {
          // Simple mock extraction for all types
          mockData[field.name] = `[MOCK] ${field.name} for ${url}`;
        });

        // Save to workspace
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
          ...mockData,
          timestamp: new Date().toISOString(),
          bulkJob: true,
          robotName: robotName,
          sourceUrl: url // Add source URL for context
        };
        
        workspaceData[workspace].push(newEntry);
        await redisClient.set('workspace_data', JSON.stringify(workspaceData));

        results.push({ 
          url, 
          success: true, 
          data: newEntry 
        });
        
      } catch (error) {
        results.push({ 
          url, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      processed: results.length,
      successCount: successCount,
      failureCount: failureCount,
      results: results,
      summary: {
        workspace: workspace,
        robot: robotName,
        totalUrls: limitedUrls.length
      }
    });
    
  } catch (error) {
    // If connection fails, this catch block ensures a JSON 500 error is returned.
    console.error('Bulk processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}