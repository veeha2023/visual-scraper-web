// Vercel Serverless Function - Get all robots
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const robots = await kv.get('robots') || {};
        
        res.status(200).json({ 
            success: true,
            count: Object.keys(robots).length,
            robots: robots
        });
    } catch (error) {
        console.error('Robots fetch error:', error);
        res.status(500).json({ error: error.message });
    }
}