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
      return res.status(404).json({ 
        success: false, 
        error: 'No robots found' 
      });
    }
    
    robots = JSON.parse(robots);
    const robotConfig = robots[robotName];
    
    if (!robotConfig) {
      return res.status(404).json({ 
        success: false, 
        error: `Robot "${robotName}" not found` 
      });
    }

    const results = [];
    
    // Process URLs (this would need actual scraping service)
    for (const url of limitedUrls) {
      try {
        // Simulate scraping - in real implementation, you'd use a headless browser
        const mockData = {
          'Source URL': url,
          'Scraped At': new Date().toLocaleString(),
          'robotName': robotName,
          'workspace': workspace,
          'Title': `Mock title for ${url}`,
          'Status': 'Processed via bulk API'
        };

        // Add robot fields with mock data
        robotConfig.forEach(field => {
          mockData[field.name] = `Mock ${field.name} for ${url}`;
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
          bulkJob: true
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
    console.error('Bulk processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}