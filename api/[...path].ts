import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import session from 'express-session';
import { registerRoutes } from '../server/routes';

// Create Express app instance
const app = express();

// Configure middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session configuration for Vercel
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Set to true for production HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax'
  }
}));

// Initialize routes once
let routesInitialized = false;
const initializeRoutes = async () => {
  if (!routesInitialized) {
    await registerRoutes(app);
    routesInitialized = true;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Initialize routes if not already done
  await initializeRoutes();

  // Create a mock Express request/response from Vercel's
  return new Promise((resolve, reject) => {
    // Convert Vercel request to Express format
    const expressReq = Object.assign(req, {
      // Add any Express-specific properties if needed
      session: {},
      sessionID: '',
    }) as any;

    const expressRes = Object.assign(res, {
      // Ensure Express methods are available
      locals: {},
    }) as any;

    // Handle the request through Express
    app(expressReq, expressRes, (err: any) => {
      if (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Internal server error' });
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}