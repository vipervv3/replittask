import { createHmac } from 'crypto';

const JWT_SECRET = process.env.SESSION_SECRET || 'dev-secret-key-change-in-production';

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Simple token implementation without external dependencies
export function generateToken(user: TokenPayload): string {
  const payload = {
    ...user,
    exp: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  };
  
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = createHmac('sha256', JWT_SECRET).update(data).digest('base64');
  
  return `${data}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;
    
    // Verify signature
    const expectedSignature = createHmac('sha256', JWT_SECRET).update(data).digest('base64');
    if (signature !== expectedSignature) return null;
    
    // Parse payload
    const payload = JSON.parse(Buffer.from(data, 'base64').toString());
    
    // Check expiration
    if (payload.exp < Date.now()) return null;
    
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role
    };
  } catch (error) {
    return null;
  }
}