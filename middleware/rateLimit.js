// ============================================================
// middleware/rateLimit.js
// ============================================================
import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20,
  message: { message: 'Too many login attempts, please try again after 15 minutes.' },
  validate: { xForwardedForHeader: false, default: false },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: { message: 'Upload limit reached, please try again later.' },
  validate: { xForwardedForHeader: false, default: false },
});