import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple test response
  if (req.url === '/api' || req.url === '/api/') {
    return res.status(200).json({ 
      message: "API is working!", 
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  }

  // Handle auth endpoints
  if (req.url === '/api/auth/me') {
    if (req.method === 'GET') {
      return res.status(401).json({ error: "Not authenticated" });
    }
  }

  if (req.url === '/api/auth/login') {
    if (req.method === 'POST') {
      const { email, password } = req.body || {};
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // For now, return a test response
      if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
        return res.status(200).json({ 
          user: { id: '1', email, name: 'Omar Braham' }, 
          message: "Login successful" 
        });
      }

      return res.status(401).json({ error: "Invalid email or password" });
    }
  }

  // Return 404 for unknown endpoints
  return res.status(404).json({ error: "Not found" });
}