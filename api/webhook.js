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

          // In a real implementation, you'd queue this for processing
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
            await redisClient.set('workspace_data', JSON.stringify(works