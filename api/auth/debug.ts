import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ 
    message: 'Auth debug endpoint working',
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });
}