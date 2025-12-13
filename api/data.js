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
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Ensure connection is established. If this fails, the catch block will run and return JSON.
    await ensureRedisConnection();

    const { workspace = 'general', robot: robotFilter, limit, offset, search } = req.query;

    if (req.method === 'GET') {
      let workspaceData = await redisClient.get('workspace_data');
      if (!workspaceData) {
        workspaceData = {};
        await redisClient.set('workspace_data', JSON.stringify(workspaceData));
      } else {
        workspaceData = JSON.parse(workspaceData);
      }

      let data = workspaceData[workspace] || [];
      
      // Apply filters
      if (robotFilter) {
        data = data.filter(item => item.robotName === robotFilter);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        data = data.filter(item => 
          Object.values(item).some(value => 
            String(value).toLowerCase().includes(searchLower)
          )
        );
      }

      // Apply pagination
      const totalCount = data.length;
      const startIndex = parseInt(offset) || 0;
      const parsedLimit = parseInt(limit) || 100;
      const paginatedData = data.slice(startIndex, startIndex + parsedLimit);

      res.status(200).json({ 
        success: true, 
        workspace: workspace,
        data: paginatedData,
        count: totalCount
      });

    } else if (req.method === 'DELETE') {
      const { recordId } = req.query;
      
      if (recordId) {
        // Delete a single record
        let workspaceData = await redisClient.get('workspace_data');
        if (!workspaceData) {
          workspaceData = {};
        } else {
          workspaceData = JSON.parse(workspaceData);
        }

        if (workspaceData[workspace]) {
          const initialLength = workspaceData[workspace].length;
          workspaceData[workspace] = workspaceData[workspace].filter(
            item => item.timestamp !== recordId
          );
          
          if (workspaceData[workspace].length < initialLength) {
            await redisClient.set('workspace_data', JSON.stringify(workspaceData));
            res.status(200).json({ 
              success: true,
              message: `Record deleted from workspace "${workspace}"`,
              workspace: workspace
            });
          } else {
            res.status(404).json({ 
              success: false,
              error: 'Record not found'
            });
          }
        } else {
          res.status(404).json({ 
            success: false,
            error: 'Workspace not found'
          });
        }
      } else {
        // Clear all workspace data
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
      }

    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    // If connection fails, this catch block ensures a JSON 500 error is returned.
    console.error('Data API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}