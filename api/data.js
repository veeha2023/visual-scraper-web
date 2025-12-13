import { supabase } from '../lib/supabase.js';

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
      let query = supabase
        .from('workspace_data')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspace)
        .order('created_at', { ascending: false });

      // Apply robot filter
      if (robotFilter) {
        query = query.eq('robot_name', robotFilter);
      }

      // Apply search filter
      if (search) {
        // Search in the JSONB data column
        query = query.or(`data.cs.${search}`);
      }

      // Apply pagination
      const parsedLimit = parseInt(limit) || 100;
      const startIndex = parseInt(offset) || 0;
      query = query.range(startIndex, startIndex + parsedLimit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform data to match expected format
      const transformedData = data.map(record => {
        return {
          ...record.data,
          robotName: record.robot_name,
          timestamp: record.created_at,
          sourceUrl: record.source_url,
          bulkJob: record.bulk_job
        };
      });

      res.status(200).json({ 
        success: true, 
        workspace: workspace,
        data: transformedData,
        count: count || 0
      });

    } else if (req.method === 'DELETE') {
      const { recordId } = req.query;
      
      if (recordId) {
        // Delete a single record by timestamp (created_at)
        const { data, error } = await supabase
          .from('workspace_data')
          .delete()
          .eq('workspace_id', workspace)
          .eq('created_at', recordId)
          .select();

        if (error) throw error;

        if (!data || data.length === 0) {
          return res.status(404).json({ 
            success: false,
            error: 'Record not found'
          });
        }

        res.status(200).json({ 
          success: true,
          message: `Record deleted from workspace "${workspace}"`,
          workspace: workspace
        });
      } else {
        // Clear all workspace data
        const { error } = await supabase
          .from('workspace_data')
          .delete()
          .eq('workspace_id', workspace);

        if (error) throw error;

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
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}