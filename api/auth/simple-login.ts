import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Simple authentication - works without any external dependencies
    if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
      const user = { 
        id: '1', 
        email, 
        name: 'Omar Braham',
        createdAt: new Date().toISOString(),
        role: 'admin'
      };
      
      // Create a simple token (base64 encoded user data with timestamp)
      const tokenData = {
        user,
        exp: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
      };
      const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      
      return res.status(200).json({
        user,
        token,
        message: 'Login successful'
      });
    }

    return res.status(401).json({ error: 'Invalid email or password' });

  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message
    });
  }
}