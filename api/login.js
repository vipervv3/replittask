// Login endpoint for Vercel
export default function handler(request, response) {
  // Handle CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = request.body || {};
  
  if (!email || !password) {
    return response.status(400).json({ error: "Email and password required" });
  }

  // Test credentials
  if (email === 'omar_braham@wgresorts.com' && password === 'test123') {
    return response.status(200).json({ 
      success: true,
      user: { 
        id: '1', 
        email: email, 
        name: 'Omar Braham',
        username: 'omar_braham'
      }, 
      message: "Login successful" 
    });
  }

  return response.status(401).json({ error: "Invalid credentials" });
}