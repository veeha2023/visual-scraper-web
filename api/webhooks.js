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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ensure connection is established. If this fails, the catch block will run and return JSON.
    await ensureRedisConnection();
    
    if (req.method === 'GET') {
      // Get all webhooks or a specific one
      const { workspace, webhookId } = req.query;
      
      let webhooks = await redisClient.get('webhooks');
      if (!webhooks) {
        webhooks = {};
        await redisClient.set('webhooks', JSON.stringify(webhooks));
      } else {
        webhooks = JSON.parse(webhooks);
      }

      if (webhookId) {
        // Return specific webhook
        const webhook = webhooks[webhookId];
        if (webhook) {
          res.status(200).json({
            success: true,
            webhook: webhook
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'Webhook not found'
          });
        }
      } else if (workspace) {
        // Return webhooks for specific workspace
        const workspaceWebhooks = Object.entries(webhooks)
          .filter(([id, wh]) => wh.workspace === workspace)
          .map(([id, wh]) => ({ ...wh, id }));

        res.status(200).json({
          success: true,
          webhooks: workspaceWebhooks,
          count: workspaceWebhooks.length
        });
      } else {
        // Return all webhooks
        const allWebhooks = Object.entries(webhooks).map(([id, wh]) => ({ ...wh, id }));

        res.status(200).json({
          success: true,
          webhooks: allWebhooks,
          count: allWebhooks.length
        });
      }
      
    } else if (req.method === 'POST') {
      // Create a new webhook
      const { name, robotName, workspace, webhookUrl, secret, isActive = true } = req.body;
      
      if (!name || !robotName || !workspace) {
        return res.status(400).json({ success: false, error: 'Name, robot, and workspace are required' });
      }
      
      let webhooks = await redisClient.get('webhooks');
      if (!webhooks) {
        webhooks = {};
      } else {
        webhooks = JSON.parse(webhooks);
      }
      
      const newWebhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const newWebhook = {
        name,
        robotName,
        workspace,
        webhookUrl: webhookUrl || '',
        secret: secret || '',
        isActive: isActive,
        createdAt: new Date().toISOString()
      };
      
      webhooks[newWebhookId] = newWebhook;
      await redisClient.set('webhooks', JSON.stringify(webhooks));
      
      res.status(201).json({
        success: true,
        message: 'Webhook created successfully',
        webhook: { id: newWebhookId, ...newWebhook }
      });
      
    } else if (req.method === 'DELETE') {
      // Delete a webhook
      const { webhookId } = req.body;

      if (!webhookId) {
        return res.status(400).json({ success: false, error: 'Webhook ID is required' });
      }

      let webhooks = await redisClient.get('webhooks');
      if (!webhooks) {
        webhooks = {};
      } else {
        webhooks = JSON.parse(webhooks);
      }
      
      if (webhooks[webhookId]) {
        delete webhooks[webhookId];
        await redisClient.set('webhooks', JSON.stringify(webhooks));
        res.status(200).json({
          success: true,
          message: `Webhook "${webhookId}" deleted successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Webhook not found'
        });
      }
    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    // If connection fails, this catch block ensures a JSON 500 error is returned.
    console.error('Webhooks API error:', error);
    res.status(500).json({
      success: false,
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}

// Function to process a bulk job using a webhook (not directly exposed as an API endpoint)
// This function is kept for internal logic but is not the main API handler
async function processWebhookJob(webhook, urls) {
  // This function simulates processing a webhook job
  await ensureRedisConnection(); // Ensure connection is established here as well
  
  console.log(`Processing webhook job ${webhook.id} for robot ${webhook.robotName} on ${urls.length} URLs...`);
  
  // Get robot configuration (mock retrieval)
  let robots = await redisClient.get('robots');
  robots = robots ? JSON.parse(robots) : {};
  const robot = robots[webhook.robotName];
  
  if (!robot) {
    console.error(`Robot not found for webhook ${webhook.id}`);
    return;
  }
  
  const results = [];
  
  for (const url of urls) {
    try {
      const data = await simulateScraping(url, robot);
      results.push({ url, status: 'success', data });
      
      // Save data to workspace
      let workspaceData = await redisClient.get('workspace_data');
      workspaceData = workspaceData ? JSON.parse(workspaceData) : {};
      if (!workspaceData[webhook.workspace]) {
        workspaceData[webhook.workspace] = [];
      }
      
      workspaceData[webhook.workspace].push({ 
        ...data, 
        robotName: webhook.robotName,
        workspace: webhook.workspace,
        timestamp: new Date().toISOString()
      });
      await redisClient.set('workspace_data', JSON.stringify(workspaceData));
      
    } catch (error) {
      results.push({ 
        url, 
        status: 'error', 
        message: error.message
      });
    }
  }
  
  // Send results to webhook URL (if configured)
  if (webhook.webhookUrl) {
    try {
      const webhookPayload = {
        webhookId: webhook.id,
        workspace: webhook.workspace,
        robotName: webhook.robotName,
        processedAt: new Date().toISOString(),
        totalUrls: urls.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        results: results
      };
      
      await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(webhook.secret && { 'X-Webhook-Secret': webhook.secret })
        },
        body: JSON.stringify(webhookPayload)
      });
      
      console.log(`Results sent to webhook URL for ${webhook.id}`);
    } catch (error) {
      console.error('Failed to send results to webhook URL:', error);
    }
  }
  
  console.log(`Webhook processing completed for ${webhook.id}`);
}

// Simulate scraping function (replace with actual scraping logic)
async function simulateScraping(url, robot) {
  // This is a simulation - in production, you'd use actual scraping
  const data = {
    'Source URL': url,
    'Scraped At': new Date().toLocaleString(),
    'Webhook Processed': true
  };
  
  // Add mock data for each selector
  robot.forEach(selector => {
    data[selector.name] = `[Mock Data] Value for ${selector.name} from ${url.substring(0, 30)}...`;
  });
  
  return data;
}