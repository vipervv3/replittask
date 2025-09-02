export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { email, password } = req.body || {};
    
    if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
      const user = { 
        id: '1', 
        email, 
        name: 'Omar Braham',
        role: 'admin'
      };
      
      const token = Buffer.from(JSON.stringify({
        user,
        exp: Date.now() + (30 * 24 * 60 * 60 * 1000)
      })).toString('base64');
      
      return res.status(200).json({
        user,
        token,
        message: 'Login successful'
      });
    }
    
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.substring(7);
    try {
      const data = JSON.parse(Buffer.from(token, 'base64').toString());
      if (data.exp < Date.now()) {
        return res.status(401).json({ error: "Token expired" });
      }
      return res.status(200).json({ user: data.user });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}