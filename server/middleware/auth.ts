import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

// Middleware to ensure user is authenticated
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  req.userId = req.session.userId;
  next();
}

// Middleware to add user ID to request if available (optional auth)
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
}

// Get user ID with fallback to mock for backward compatibility
export function getUserId(req: AuthenticatedRequest, mockUserId: string): string {
  return req.session?.userId || req.userId || mockUserId;
}