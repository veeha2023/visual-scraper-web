// Vercel Serverless Function - Save robots and scraped data
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { robotName, selectors, data } = req.body;

        if (!robotName || !selectors || !data) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Save or update robot configuration
        const robots = await kv.get('robots') || {};
        robots[robotName] = selectors;
        await kv.set('robots', robots);

        // Save scraped data
        const scrapedData = await kv.get('scraped_data') || [];
        const newEntry = {
            ...data,
            robotName,
            timestamp: new Date().toISOString()
        };
        scrapedData.push(newEntry);
        await kv.set('scraped_data', scrapedData);

        res.status(200).json({ 
            success: true, 
            message: 'Data saved successfully',
            count: scrapedData.length,
            robotName: robotName
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: error.message });
    }
}