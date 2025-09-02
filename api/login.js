module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    
    // Check test credentials
    if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
      const user = { 
        id: '1', 
        email, 
        name: 'Omar Braham',
        role: 'admin'
      };
      
      // Create simple token
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
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};