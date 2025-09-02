import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const sql = neon(process.env.DATABASE_URL);
    
    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUsers = await sql`
      INSERT INTO users (email, password, name, role, created_at)
      VALUES (${email}, ${hashedPassword}, ${name}, 'user', NOW())
      RETURNING id, email, name, role, created_at
    `;

    if (newUsers.length === 0) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    return res.status(201).json({ 
      user: newUsers[0], 
      message: "Registration successful" 
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    return res.status(500).json({ 
      error: "Registration failed",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}