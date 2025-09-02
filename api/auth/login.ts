import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import { generateToken } from './lib/jwt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check for test credentials first (works without database)
    if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
      const user = { 
        id: '1', 
        email, 
        name: 'Omar Braham',
        createdAt: new Date().toISOString(),
        role: 'admin'
      };
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      return res.status(200).json({
        user,
        token,
        message: 'Login successful (test mode)'
      });
    }

    // If DATABASE_URL is not set, return error
    if (!process.env.DATABASE_URL) {
      console.log('DATABASE_URL not configured');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Production mode with database
    const sql = neon(process.env.DATABASE_URL);
    
    // Query user from database
    const users = await sql`
      SELECT id, email, name, password, role, created_at 
      FROM users 
      WHERE email = ${email}
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Don't send password in response
    const { password: _, ...userWithoutPassword } = user;
    const token = generateToken({ 
      id: userWithoutPassword.id, 
      email: userWithoutPassword.email, 
      name: userWithoutPassword.name, 
      role: userWithoutPassword.role 
    });

    return res.status(200).json({
      user: userWithoutPassword,
      token,
      message: 'Login successful'
    });

  } catch (error: any) {
    console.error('Login error:', error);
    
    // If it's a database connection error, try test credentials
    const { email, password } = req.body;
    if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
      const user = { 
        id: '1', 
        email, 
        name: 'Omar Braham',
        createdAt: new Date().toISOString(),
        role: 'admin'
      };
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      return res.status(200).json({
        user,
        token,
        message: 'Login successful (fallback mode)'
      });
    }
    
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message || 'Database connection error'
    });
  }
}
