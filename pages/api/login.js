export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { email, password } = req.body;
  
  if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
    return res.status(200).json({ 
      user: { id: '1', email, name: 'Omar Braham' }, 
      message: "Login successful" 
    });
  }
  
  return res.status(401).json({ error: "Invalid credentials" });
}