import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('robots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert to the format expected by frontend: { robotName: selectors }
      const robotsObject = {};
      data.forEach(robot => {
        robotsObject[robot.name] = robot.selectors;
      });

      res.status(200).json({ 
        success: true,
        count: data.length,
        robots: robotsObject
      });
    } 
    else if (req.method === 'POST') {
      const { robotName, selectors } = req.body;
      
      if (!robotName || !selectors) {
        return res.status(400).json({ success: false, error: 'Robot name and selectors required' });
      }

      // Check if robot already exists
      const { data: existing } = await supabase
        .from('robots')
        .select('id')
        .eq('name', robotName)
        .single();

      if (existing) {
        return res.status(409).json({ success: false, error: 'Robot already exists. Use PUT to update.' });
      }

      const { data, error } = await supabase
        .from('robots')
        .insert([
          { name: robotName, selectors: selectors }
        ])
        .select();

      if (error) throw error;

      res.status(201).json({ 
        success: true,
        message: `Robot "${robotName}" created successfully`
      });
    }
    else if (req.method === 'PUT') {
      const { robotName, selectors } = req.body;

      if (!robotName || !selectors) {
        return res.status(400).json({ success: false, error: 'Robot name and selectors required' });
      }

      const { data, error } = await supabase
        .from('robots')
        .update({ selectors: selectors, updated_at: new Date().toISOString() })
        .eq('name', robotName)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Robot not found' 
        });
      }

      res.status(200).json({ 
        success: true,
        message: `Robot "${robotName}" updated successfully`
      });
    }
    else if (req.method === 'DELETE') {
      const { robotName } = req.body;
      
      if (!robotName) {
        return res.status(400).json({ success: false, error: 'Robot name required' });
      }

      const { data, error } = await supabase
        .from('robots')
        .delete()
        .eq('name', robotName)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Robot not found'
        });
      }

      res.status(200).json({ 
        success: true,
        message: `Robot "${robotName}" deleted successfully`
      });
    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Robots API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}