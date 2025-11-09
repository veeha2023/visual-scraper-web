// Vercel Serverless Function - Get all scraped data (for n8n)
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            // Get all scraped data
            const scrapedData = await kv.get('scraped_data') || [];
            
            res.status(200).json({ 
                success: true,
                count: scrapedData.length,
                data: scrapedData,
                lastUpdated: scrapedData.length > 0 ? scrapedData[scrapedData.length - 1].timestamp : null
            });
        } else if (req.method === 'DELETE') {
            // Clear all data (optional - for dashboard)
            await kv.set('scraped_data', []);
            res.status(200).json({ 
                success: true,
                message: 'All data cleared'
            });
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Data fetch error:', error);
        res.status(500).json({ error: error.message });
    }
}