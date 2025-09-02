module.exports = function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, always return not authenticated to show login page
    return res.status(401).json({ error: "Not authenticated" });
  } catch (error) {
    console.error("Auth check error:", error);
    return res.status(500).json({ error: "Authentication check failed" });
  }
}