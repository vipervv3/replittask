import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.substring(7);
    
    try {
      // Decode the simple token
      const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Check expiration
      if (tokenData.exp < Date.now()) {
        return res.status(401).json({ error: "Token expired" });
      }

      return res.status(200).json({ user: tokenData.user });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

  } catch (error) {
    console.error("Auth check error:", error);
    return res.status(500).json({ error: "Authentication check failed" });
  }
}