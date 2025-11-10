import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

await redisClient.connect();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { 
        action, 
        workspace, 
        robotName, 
        urls, 
        data,
        webhookUrl,
        secret 
      } = req.body;

      if (!action) {
        return res.status(400).json({ 
          success: false, 
          error: 'Action is required' 
        });
      }

      let result;

      switch (action) {
        case 'scrape_urls':
          if (!urls || !robotName) {
            return res.status(400).json({ 
              success: false, 
              error: 'URLs and robotName are required for scrape_urls action' 
            });
          }

          // Store the job in Redis
          const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const jobData = {
            id: jobId,
            action: 'scrape_urls',
            workspace: workspace || 'general',
            robotName: robotName,
            urls: Array.isArray(urls) ? urls : [urls],
            status: 'pending',
            createdAt: new Date().toISOString(),
            webhookUrl: webhookUrl,
            secret: secret
          };

          // Save job to Redis
          let jobs = await redisClient.get('webhook_jobs');
          if (!jobs) {
            jobs = {};
          } else {
            jobs = JSON.parse(jobs);
          }
          
          jobs[jobId] = jobData;
          await redisClient.set('webhook_jobs', JSON.stringify(jobs));

          result = {
            success: true,
            jobId: jobId,
            message: 'Scraping job queued successfully',
            details: {
              urlsCount: jobData.urls.length,
              workspace: jobData.workspace,
              robot: jobData.robotName
            }
          };
          break;

        case 'create_workspace':
          const { workspaceId, workspaceName } = req.body;
          
          if (!workspaceId || !workspaceName) {
            return res.status(400).json({ 
              success: false, 
              error: 'workspaceId and workspaceName are required' 
            });
          }

          // Create workspace via workspaces API logic
          let workspaces = await redisClient.get('workspaces');
          if (!workspaces) {
            workspaces = {
              'general': 'General (Testing)'
            };
          } else {
            workspaces = JSON.parse(workspaces);
          }

          if (workspaces[workspaceId]) {
            return res.status(400).json({
              success: false,
              error: 'Workspace ID already exists'
            });
          }

          workspaces[workspaceId] = workspaceName;
          await redisClient.set('workspaces', JSON.stringify(workspaces));

          // Initialize empty data for new workspace
          let workspaceData = await redisClient.get('workspace_data');
          if (!workspaceData) {
            workspaceData = {};
          } else {
            workspaceData = JSON.parse(workspaceData);
          }

          if (!workspaceData[workspaceId]) {
            workspaceData[workspaceId] = [];
            await redisClient.set('workspace_data', JSON.stringify(workspaceData));
          }

          result = {
            success: true,
            message: `Workspace "${workspaceName}" created successfully`,
            workspace: { id: workspaceId, name: workspaceName }
          };
          break;

        case 'get_data':
          // Get data from specific workspace
          const targetWorkspace = workspace || 'general';
          let allWorkspaceData = await redisClient.get('workspace_data');
          if (!allWorkspaceData) {
            allWorkspaceData = {};
          } else {
            allWorkspaceData = JSON.parse(allWorkspaceData);
          }

          const wsData = allWorkspaceData[targetWorkspace] || [];
          
          result = {
            success: true,
            workspace: targetWorkspace,
            count: wsData.length,
            data: wsData
          };
          break;

        default:
          return res.status(400).json({
            success: false,
            error: `Unknown action: ${action}. Supported actions: scrape_urls, create_workspace, get_data`
          });
      }

      res.status(200).json(result);

    } else if (req.method === 'GET') {
      // Get job status or list webhooks
      const { jobId, action } = req.query;

      if (action === 'job_status' && jobId) {
        let jobs = await redisClient.get('webhook_jobs');
        if (!jobs) {
          return res.status(404).json({
            success: false,
            error: 'Job not found'
          });
        }

        jobs = JSON.parse(jobs);
        const job = jobs[jobId];

        if (!job) {
          return res.status(404).json({
            success: false,
            error: 'Job not found'
          });
        }

        res.status(200).json({
          success: true,
          job: job
        });
      } else {
        // Return webhook API info
        res.status(200).json({
          success: true,
          message: 'Visual Scraper Webhook API',
          endpoints: {
            'POST /api/webhooks': {
              actions: [
                {
                  action: 'scrape_urls',
                  parameters: ['urls', 'robotName', 'workspace?', 'webhookUrl?', 'secret?']
                },
                {
                  action: 'create_workspace', 
                  parameters: ['workspaceId', 'workspaceName']
                },
                {
                  action: 'get_data',
                  parameters: ['workspace?']
                }
              ]
            },
            'GET /api/webhooks': {
              parameters: ['jobId', 'action=job_status']
            }
          }
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