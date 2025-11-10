import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

await redisClient.connect();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
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
          .reduce((acc, [id, wh]) => {
            acc[id] = wh;
            return acc;
          }, {});

        res.status(200).json({
          success: true,
          webhooks: workspaceWebhooks,
          count: Object.keys(workspaceWebhooks).length
        });
      } else {
        // Return all webhooks
        res.status(200).json({
          success: true,
          webhooks: webhooks,
          count: Object.keys(webhooks).length
        });
      }

    } else if (req.method === 'POST') {
      // Create or trigger a webhook
      const { action, webhookId, workspace, robotName, urls, webhookUrl, secret } = req.body;

      if (action === 'create') {
        // Create new webhook
        if (!webhookId || !workspace || !robotName || !webhookUrl) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: webhookId, workspace, robotName, webhookUrl'
          });
        }

        let webhooks = await redisClient.get('webhooks');
        if (!webhooks) {
          webhooks = {};
        } else {
          webhooks = JSON.parse(webhooks);
        }

        // Check if webhook already exists
        if (webhooks[webhookId]) {
          return res.status(400).json({
            success: false,
            error: 'Webhook ID already exists'
          });
        }

        // Create webhook
        webhooks[webhookId] = {
          id: webhookId,
          workspace: workspace,
          robotName: robotName,
          webhookUrl: webhookUrl,
          secret: secret || '',
          createdAt: new Date().toISOString(),
          lastTriggered: null,
          triggerCount: 0
        };

        await redisClient.set('webhooks', JSON.stringify(webhooks));

        res.status(200).json({
          success: true,
          message: 'Webhook created successfully',
          webhook: webhooks[webhookId]
        });

      } else if (action === 'trigger') {
        // Trigger webhook to scrape URLs
        if (!webhookId || !urls) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: webhookId, urls'
          });
        }

        let webhooks = await redisClient.get('webhooks');
        if (!webhooks) {
          return res.status(404).json({
            success: false,
            error: 'Webhook not found'
          });
        } else {
          webhooks = JSON.parse(webhooks);
        }

        const webhook = webhooks[webhookId];
        if (!webhook) {
          return res.status(404).json({
            success: false,
            error: 'Webhook not found'
          });
        }

        // Validate URLs
        const urlList = Array.isArray(urls) ? urls : [urls];
        const validUrls = urlList.filter(url => 
          url && (url.startsWith('http://') || url.startsWith('https://'))
        );

        if (validUrls.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid URLs provided'
          });
        }

        // Get robot configuration
        let robots = await redisClient.get('robots');
        if (!robots) {
          return res.status(400).json({
            success: false,
            error: 'Robot not found'
          });
        } else {
          robots = JSON.parse(robots);
        }

        const robot = robots[webhook.robotName];
        if (!robot) {
          return res.status(400).json({
            success: false,
            error: `Robot "${webhook.robotName}" not found`
          });
        }

        // Update webhook stats
        webhook.lastTriggered = new Date().toISOString();
        webhook.triggerCount = (webhook.triggerCount || 0) + 1;
        webhooks[webhookId] = webhook;
        await redisClient.set('webhooks', JSON.stringify(webhooks));

        // Return immediate response (async processing)
        res.status(200).json({
          success: true,
          message: 'Webhook triggered successfully',
          webhookId: webhookId,
          urlsReceived: validUrls.length,
          processing: 'Webhook processing started asynchronously'
        });

        // Process URLs asynchronously (this happens after response)
        processWebhookUrls(webhook, robot, validUrls);

      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Use "create" or "trigger"'
        });
      }

    } else if (req.method === 'DELETE') {
      // Delete webhook
      const { webhookId } = req.body;

      if (!webhookId) {
        return res.status(400).json({
          success: false,
          error: 'Webhook ID required'
        });
      }

      let webhooks = await redisClient.get('webhooks');
      if (!webhooks) {
        return res.status(404).json({
          success: false,
          error: 'Webhook not found'
        });
      } else {
        webhooks = JSON.parse(webhooks);
      }

      if (webhooks[webhookId]) {
        delete webhooks[webhookId];
        await redisClient.set('webhooks', JSON.stringify(webhooks));
        
        res.status(200).json({
          success: true,
          message: 'Webhook deleted successfully'
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
    console.error('Webhooks API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Async function to process webhook URLs
async function processWebhookUrls(webhook, robot, urls) {
  console.log(`Processing ${urls.length} URLs for webhook ${webhook.id}`);
  
  const results = [];
  
  for (const url of urls) {
    try {
      // Simulate scraping (in real implementation, you'd use Puppeteer or similar)
      const scrapedData = await simulateScraping(url, robot);
      
      // Save to workspace
      const saveResponse = await fetch(`https://visual-scraper-web.vercel.app/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robotName: webhook.robotName,
          selectors: robot,
          data: scrapedData,
          workspace: webhook.workspace
        })
      });

      if (saveResponse.ok) {
        results.push({
          url: url,
          status: 'success',
          data: scrapedData
        });
      } else {
        results.push({
          url: url,
          status: 'error',
          error: 'Failed to save data'
        });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      results.push({
        url: url,
        status: 'error',
        error: error.message
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
    data[selector.name] = `Mock data for ${selector.name} from ${url}`;
  });
  
  return data;
}