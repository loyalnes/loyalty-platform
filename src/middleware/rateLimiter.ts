import rateLimit, { type Options } from 'express-rate-limit';
import type { RequestHandler } from 'express';

// express-rate-limit starts a cleanup timer when a limiter is created. Workers forbid timers at
// import time, so each limiter is built on its first request. Behaviour on Node is unchanged.
function lazyRateLimit(options: Partial<Options>): RequestHandler {
  let limiter: RequestHandler | undefined;
  return (req, res, next) => (limiter ??= rateLimit({ ...options, validate: { creationStack: false } }))(req, res, next);
}

/**
 * Rate limiter for authentication endpoints (login, register)
 * Prevents brute-force attacks
 * - 5 requests per minute per IP for login
 * - 3 requests per hour per IP for register
 */
export const authRateLimiter = lazyRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export const registerRateLimiter = lazyRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: {
    error: 'Too many registration attempts from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for gamification play endpoint
 * Prevents abuse of prize system
 * - 10 plays per minute per IP
 */
export const gamificationRateLimiter = lazyRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: 'Too many play attempts, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for feedback/review submission
 * Prevents spam reviews
 * - 10 submissions per minute per IP
 */
export const feedbackRateLimiter = lazyRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: 'Too many feedback submissions, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General rate limiter for public API endpoints
 * - 100 requests per minute per IP
 */
export const generalRateLimiter = lazyRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for authenticated merchants (they have API keys)
    return !!req.merchantId;
  }
});
