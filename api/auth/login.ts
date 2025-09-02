import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage';
import { authService } from '../../server/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await authService.login({ email, password }, storage);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    return res.status(200).json({ user, message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
}
