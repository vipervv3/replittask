module.exports = function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
    return res.status(200).json({ 
      user: { 
        id: '1', 
        email: email, 
        name: 'Omar Braham',
        username: 'omar_braham'
      }, 
      message: "Login successful" 
    });
  }

  return res.status(401).json({ error: "Invalid email or password" });
}
