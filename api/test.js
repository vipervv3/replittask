export default function handler(req, res) {
  return res.status(200).json({ 
    message: "API is working perfectly!", 
    method: req.method,
    timestamp: new Date().toISOString(),
    url: req.url
  });
}