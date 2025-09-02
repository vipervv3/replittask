module.exports = (req, res) => {
  res.status(200).json({
    message: "Simple API working!",
    timestamp: new Date().toISOString()
  });
};