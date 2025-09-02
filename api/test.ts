import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ 
    message: "API is working!", 
    method: req.method,
    timestamp: new Date().toISOString(),
    databaseConfigured: !!process.env.DATABASE_URL,
    sessionSecretConfigured: !!process.env.SESSION_SECRET,
    environment: process.env.NODE_ENV || 'production'
  });
}