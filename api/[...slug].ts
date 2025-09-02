import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import session from 'express-session';
import { registerRoutes } from '../server/routes';

// Create Express app for handling API requests
const app = express();

// Increase payload limit for voice recordings (up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session middleware for Vercel
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
  resave: true,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    sameSite: 'lax'
  },
  name: 'ai-project-hub-session'
}));

// Register routes without starting server
let routesRegistered = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Register routes only once
    if (!routesRegistered) {
      await registerRoutes(app);
      routesRegistered = true;
    }

    // Handle the request with Express
    return app(req as any, res as any);
  } catch (error) {
    console.error('Vercel API handler error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}