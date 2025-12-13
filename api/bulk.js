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
    const { data: robotData, error: robotError } = await supabase
      .from('robots')
      .select('selectors')
      .eq('name', robotName)
      .single();

    if (robotError || !robotData) {
      return res.status(404).json({ success: false, error: `Robot "${robotName}" not found` });
    }

    const robotConfig = robotData.selectors;
    const results = [];
    const dataToInsert = [];

    // Simulate bulk scraping process (since actual scraping requires a browser environment)
    for (const url of limitedUrls) {
      try {
        // Mock data creation based on robot selectors
        const mockData = {};
        
        robotConfig.forEach(field => {
          mockData[field.name] = `[MOCK] ${field.name} for ${url}`;
        });

        const newEntry = {
          workspace_id: workspace,
          robot_name: robotName,
          data: mockData,
          source_url: url,
          bulk_job: true
        };
        
        dataToInsert.push(newEntry);

        results.push({ 
          url, 
          success: true, 
          data: mockData 
        });
        
      } catch (error) {
        results.push({ 
          url, 
          success: false, 
          error: error.message 
        });
      }
    }

    // Bulk insert all data at once
    if (dataToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('workspace_data')
        .insert(dataToInsert);

      if (insertError) throw insertError;
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
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}