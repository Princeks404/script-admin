// api/scripts.js - Replace entire file
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        const scriptKeys = await redis.keys('script:*');
        const scripts = {};
        
        if (scriptKeys.length > 0) {
          const pipeline = redis.pipeline();
          scriptKeys.forEach(key => pipeline.get(key));
          const results = await pipeline.exec();
          
          scriptKeys.forEach((key, index) => {
            if (results[index]) {
              const id = key.replace('script:', '');
              // Check if result is already an object or needs parsing
              const scriptData = typeof results[index] === 'string' 
                ? JSON.parse(results[index]) 
                : results[index];
              scripts[id] = scriptData;
            }
          });
        }
        
        return res.json(scripts);

      case 'POST':
        const { name, content } = req.body;
        
        if (!name || !content) {
          return res.status(400).json({ error: 'Name and content are required' });
        }

        const safeName = name
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase();

        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const script = {
          id,
          name: safeName,
          originalName: name,
          content,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };

        await redis.set(`script:${id}`, script);
        await redis.set(`name:${safeName}`, id);
        
        return res.status(201).json(script);

      case 'PUT':
        const { id: updateId, content: updateContent } = req.body;
        
        if (!updateId || !updateContent) {
          return res.status(400).json({ error: 'ID and content are required' });
        }

        const scriptData = await redis.get(`script:${updateId}`);
        if (!scriptData) {
          return res.status(404).json({ error: 'Script not found' });
        }

        // Check if scriptData is already an object or needs parsing
        const updateScript = typeof scriptData === 'string' 
          ? JSON.parse(scriptData) 
          : scriptData;
        
        updateScript.content = updateContent;
        updateScript.updated = new Date().toISOString();

        await redis.set(`script:${updateId}`, updateScript);
        return res.json(updateScript);

      case 'DELETE':
        const { id: deleteId } = req.body;
        
        if (!deleteId) {
          return res.status(400).json({ error: 'ID is required' });
        }

        const deleteScriptData = await redis.get(`script:${deleteId}`);
        if (!deleteScriptData) {
          return res.status(404).json({ error: 'Script not found' });
        }

        // Check if deleteScriptData is already an object or needs parsing
        const deleteScript = typeof deleteScriptData === 'string' 
          ? JSON.parse(deleteScriptData) 
          : deleteScriptData;
        
        await redis.del(`script:${deleteId}`);
        await redis.del(`name:${deleteScript.name}`);

        return res.json({ success: true, message: 'Script deleted successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
