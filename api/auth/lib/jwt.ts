import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SESSION_SECRET || 'dev-secret-key-change-in-production';

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function generateToken(user: TokenPayload): string {
  return jwt.sign(user, JWT_SECRET, { 
    expiresIn: '30d' 
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}