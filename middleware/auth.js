const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided. Access denied." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify token with expiration check
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is expired (jwt.verify already does this, but double-check)
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      return res.status(401).json({ error: "Token expired. Please login again." });
    }
    
    req.user = {
      id: decoded.id,
      email: decoded.email
    };
    
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please login again." });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token. Please login again." });
    }
    return res.status(401).json({ error: "Authentication failed." });
  }
};

module.exports = authMiddleware;