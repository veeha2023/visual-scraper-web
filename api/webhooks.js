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
      const { workspace, webhookId } = req.query;

      if (webhookId) {
        // Return specific webhook
        const { data, error } = await supabase
          .from('webhooks')
          .select('*')
          .eq('id', webhookId)
          .single();

        if (error || !data) {
          return res.status(404).json({
            success: false,
            error: 'Webhook not found'
          });
        }

        res.status(200).json({
          success: true,
          webhook: data
        });
      } else if (workspace) {
        // Return webhooks for specific workspace
        const { data, error } = await supabase
          .from('webhooks')
          .select('*')
          .eq('workspace_id', workspace)
          .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json({
          success: true,
          webhooks: data,
          count: data.length
        });
      } else {
        // Return all webhooks
        const { data, error } = await supabase
          .from('webhooks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json({
          success: true,
          webhooks: data,
          count: data.length
        });
      }
      
    } else if (req.method === 'POST') {
      const { name, robotName, workspace, webhookUrl, secret, isActive = true } = req.body;
      
      if (!name || !robotName || !workspace) {
        return res.status(400).json({ success: false, error: 'Name, robot, and workspace are required' });
      }
      
      const newWebhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const { data, error } = await supabase
        .from('webhooks')
        .insert([{
          id: newWebhookId,
          name: name,
          robot_name: robotName,
          workspace_id: workspace,
          webhook_url: webhookUrl || '',
          secret: secret || '',
          is_active: isActive
        }])
        .select();

      if (error) throw error;

      res.status(201).json({
        success: true,
        message: 'Webhook created successfully',
        webhook: data[0]
      });
      
    } else if (req.method === 'DELETE') {
      const { webhookId } = req.body;

      if (!webhookId) {
        return res.status(400).json({ success: false, error: 'Webhook ID is required' });
      }

      const { data, error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Webhook not found'
        });
      }

      res.status(200).json({
        success: true,
        message: `Webhook "${webhookId}" deleted successfully`
      });
    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Webhooks API error:', error);
    res.status(500).json({
      success: false,
      error: 'A server error has occurred. Details: ' + error.message,
      internalError: error.message
    });
  }
}