import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from './lib/jwt';

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
    const user = verifyToken(token);

    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Auth check error:", error);
    return res.status(500).json({ error: "Authentication check failed" });
  }
}
