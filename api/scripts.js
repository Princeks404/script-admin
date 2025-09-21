import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getScripts(req, res);
      case 'POST':
        return await createScript(req, res);
      case 'PUT':
        return await updateScript(req, res);
      case 'DELETE':
        return await deleteScript(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getScripts(req, res) {
  try {
    const scriptKeys = await redis.keys('script:*');
    const scripts = {};
    
    if (scriptKeys.length > 0) {
      // Get all scripts in one pipeline for better performance
      const pipeline = redis.pipeline();
      scriptKeys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();
      
      scriptKeys.forEach((key, index) => {
        if (results[index]) {
          const id = key.replace('script:', '');
          scripts[id] = results[index];
        }
      });
    }
    
    return res.json(scripts);
  } catch (error) {
    console.error('Get scripts error:', error);
    return res.status(500).json({ error: 'Failed to fetch scripts' });
  }
}

async function createScript(req, res) {
  const { name, content } = req.body;
  
  if (!name || !content) {
    return res.status(400).json({ error: 'Name and content are required' });
  }

  // FIXED: Keep original name structure, only remove dangerous characters
  const safeName = name
    .replace(/[<>:"/\\|?*]/g, '') // Remove only dangerous file system characters
    .replace(/\s+/g, '-')         // Replace spaces with dashes
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

  try {
    // Store script with ID
    await redis.set(`script:${id}`, JSON.stringify(script));
    
    // Create name-to-id mapping for faster lookups
    await redis.set(`name:${safeName}`, id);
    
    return res.status(201).json(script);
  } catch (error) {
    console.error('Create script error:', error);
    return res.status(500).json({ error: 'Failed to create script' });
  }
}

async function updateScript(req, res) {
  const { id, content } = req.body;
  
  if (!id || !content) {
    return res.status(400).json({ error: 'ID and content are required' });
  }

  try {
    const scriptData = await redis.get(`script:${id}`);
    if (!scriptData) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const script = JSON.parse(scriptData);
    script.content = content;
    script.updated = new Date().toISOString();

    await redis.set(`script:${id}`, JSON.stringify(script));
    return res.json(script);
  } catch (error) {
    console.error('Update script error:', error);
    return res.status(500).json({ error: 'Failed to update script' });
  }
}

async function deleteScript(req, res) {
  const { id } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
  }

  try {
    // Get script data first
    const scriptData = await redis.get(`script:${id}`);
    if (!scriptData) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const script = JSON.parse(scriptData);
    
    // Delete script and name mapping
    await redis.del(`script:${id}`);
    await redis.del(`name:${script.name}`);

    return res.json({ success: true, message: 'Script deleted successfully' });
  } catch (error) {
    console.error('Delete script error:', error);
    return res.status(500).json({ error: 'Failed to delete script' });
  }
    }
