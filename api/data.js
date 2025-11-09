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
      const endIndex = limit ? startIndex + parseInt(limit) : data.length;
      const paginatedData = data.slice(startIndex, endIndex);
      
      res.status(200).json({ 
        success: true,
        count: paginatedData.length,
        totalCount: totalCount,
        data: paginatedData,
        workspace: workspace,
        hasMore: endIndex < totalCount,
        filters: {
          robot: robotFilter || null,
          search: search || null,
          limit: limit || null,
          offset: offset || 0
        },
        lastUpdated: data.length > 0 ? data[data.length - 1].timestamp : null
      });

    } else if (req.method === 'DELETE') {
      const { recordId } = req.query; // For deleting single record
      
      if (recordId) {
        // Delete single record
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
    console.error('Data API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}