import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      res.status(200).json({
        success: true,
        workspaces: data,
        count: data.length
      });

    } else if (req.method === 'POST') {
      const { workspaceId, workspaceName } = req.body;

      if (!workspaceId || !workspaceName) {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID and name are required'
        });
      }
      
      if (workspaceId.toLowerCase() === 'general') {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID "general" is reserved'
        });
      }

      // Check if workspace already exists
      const { data: existing } = await supabase
        .from('workspaces')
        .select('id')
        .eq('id', workspaceId)
        .single();

      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID already exists'
        });
      }

      const { data, error } = await supabase
        .from('workspaces')
        .insert([
          { id: workspaceId, name: workspaceName }
        ])
        .select();

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: `Workspace "${workspaceName}" created successfully`,
        workspace: data[0]
      });

    } else if (req.method === 'DELETE') {
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

      const { data, error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Workspace not found'
        });
      }

      res.status(200).json({
        success: true,
        message: `Workspace "${workspaceId}" deleted successfully`
      });

    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Workspaces API error:', error);
    res.status(500).json({
      success: false,
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}