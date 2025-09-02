export default function handler(req, res) {
  return res.status(401).json({ error: "Not authenticated" });
}