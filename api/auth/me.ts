import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, return not authenticated to show the login page
    res.status(401).json({ error: "Not authenticated" });
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(500).json({ error: "Authentication check failed" });
  }
}