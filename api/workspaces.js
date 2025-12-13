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
      // Get all workspaces
      let workspaces = await redisClient.get('workspaces');
      if (!workspaces) {
        // Initialize with default workspace
        workspaces = {
          'general': 'General (Testing)'
        };
        await redisClient.set('workspaces', JSON.stringify(workspaces));
      } else {
        workspaces = JSON.parse(workspaces);
      }

      // Convert to array for frontend
      const workspacesArray = Object.entries(workspaces).map(([id, name]) => ({
        id, name
      }));

      res.status(200).json({
        success: true,
        workspaces: workspacesArray,
        count: workspacesArray.length
      });

    } else if (req.method === 'POST') {
      // Create new workspace
      const { workspaceId, workspaceName } = req.body;

      if (!workspaceId || !workspaceName) {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID and name are required'
        });
      }
      
      // Basic validation
      if (workspaceId.toLowerCase() === 'general') {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID "general" is reserved'
        });
      }

      let workspaces = await redisClient.get('workspaces');
      if (!workspaces) {
        workspaces = {
          'general': 'General (Testing)'
        };
      } else {
        workspaces = JSON.parse(workspaces);
      }

      // Check if workspace already exists
      if (workspaces[workspaceId]) {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID already exists'
        });
      }

      // Add new workspace
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

      res.status(200).json({
        success: true,
        message: `Workspace "${workspaceName}" created successfully`,
        workspace: { id: workspaceId, name: workspaceName }
      });

    } else if (req.method === 'DELETE') {
      // Delete workspace
      const { workspaceId } = req.query;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID is required for deletion'
        });
      }
      if (workspaceId.toLowerCase() === 'general') {
        return res.status(403).json({
          success: false,
          error: 'The "general" workspace cannot be deleted'
        });
      }

      let workspaces = await redisClient.get('workspaces');
      if (!workspaces) {
        workspaces = {};
      } else {
        workspaces = JSON.parse(workspaces);
      }

      if (!workspaces[workspaceId]) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      }

      // Delete workspace and its data
      delete workspaces[workspaceId];
      await redisClient.set('workspaces', JSON.stringify(workspaces));

      let workspaceData = await redisClient.get('workspace_data');
      if (workspaceData) {
        workspaceData = JSON.parse(workspaceData);
        delete workspaceData[workspaceId];
        await redisClient.set('workspace_data', JSON.stringify(workspaceData));
      }

      res.status(200).json({
        success: true,
        message: `Workspace "${workspaceId}" deleted successfully`
      });

    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    // If connection fails, this catch block ensures a JSON 500 error is returned.
    console.error('Workspaces API error:', error);
    res.status(500).json({
      success: false,
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}