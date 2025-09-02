import { storage } from '../../server/storage';
import { authService } from '../../server/auth';
import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
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

    // Return user data (session handling will be added later)
    res.json({ user, message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
}