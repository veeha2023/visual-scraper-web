import { supabase } from '../lib/supabase.js';

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
    const { robotName, selectors, data, workspace = 'general' } = req.body;

    if (!robotName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Robot name is required' 
      });
    }

    // Save robot (shared across all workspaces)
    if (selectors) {
      // Check if robot exists
      const { data: existingRobot } = await supabase
        .from('robots')
        .select('id')
        .eq('name', robotName)
        .single();

      if (existingRobot) {
        // Update existing robot
        const { error } = await supabase
          .from('robots')
          .update({ selectors: selectors, updated_at: new Date().toISOString() })
          .eq('name', robotName);

        if (error) throw error;
      } else {
        // Create new robot
        const { error } = await supabase
          .from('robots')
          .insert([{ name: robotName, selectors: selectors }]);

        if (error) throw error;
      }
    }

    // Save data to specific workspace
    if (data) {
      const { error } = await supabase
        .from('workspace_data')
        .insert([{
          workspace_id: workspace,
          robot_name: robotName,
          data: data,
          source_url: data['Source URL'] || data.sourceUrl || null,
          bulk_job: data.bulkJob || false
        }]);

      if (error) throw error;
    }

    res.status(200).json({ 
      success: true, 
      message: 'Data saved successfully',
      workspace: workspace,
      robotName: robotName
    });

  } catch (error) {
    console.error('Save API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}