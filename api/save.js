import { kv } from '@vercel/kv';

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
        const { robotName, selectors, data } = req.body;

        if (!robotName || !selectors || !data) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        let robots = await kv.get('robots') || {};
        robots[robotName] = selectors;
        await kv.set('robots', robots);

        let scrapedData = await kv.get('scraped_data') || [];
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
        res.status(500).json({ 
            success: false, 
            error: error.message
        });
    }
}