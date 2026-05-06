const User = require('../models/User');
const { verifyAccessToken } = require('../utils/jwtAccess');
const { logger } = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided, authorization denied' });
    }

    // Verify token (supports JWT_SECRET rotation via JWT_SECRET_PREVIOUS)
    let decoded;
    try {
      const out = verifyAccessToken(token);
      if (out.expired) {
        return res.status(401).json({ message: 'Token expired, please login again' });
      }
      decoded = out.decoded;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired, please login again' });
      }
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Get user from token
    const user = await User.findById(decoded._id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    logger.error('Auth middleware error', { err: error.message });
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = authMiddleware;
