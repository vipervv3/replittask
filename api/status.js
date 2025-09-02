// Simple working API test
export default function handler(request, response) {
  response.status(200).json({
    message: "✅ Vercel API is working!",
    timestamp: new Date().toISOString(),
    success: true
  });
}