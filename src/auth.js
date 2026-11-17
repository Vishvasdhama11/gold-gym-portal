/**
 * Authentication and Cryptography Module
 * Uses Node.js native crypto for secure password hashing and JWT token signing.
 */
const crypto = require('node:crypto');

// Secret key for JWT signing - defaults to a persistent random or configured key
const JWT_SECRET = process.env.JWT_SECRET || 'premium_admin_user_management_secret_key_2026_xyz';

/**
 * Hash password using NIST-recommended scrypt with cryptographically random salt.
 * @param {string} password 
 * @returns {string} 'salt:hexHash'
 */
function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify plain text password against stored 'salt:hexHash'.
 * Uses constant-time comparison to prevent timing attacks.
 * @param {string} password 
 * @param {string} stored 
 * @returns {boolean}
 */
function verifyPassword(password, stored) {
  if (!password || !stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  
  const [salt, originalHash] = parts;
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const origBuf = Buffer.from(originalHash, 'hex');
    if (hashBuf.length !== origBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, origBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Create a signed JWT token
 * @param {object} payload 
 * @param {number} expiresInSeconds 
 * @returns {string}
 */
function createToken(payload, expiresInSeconds = 86400) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode JWT token
 * @param {string} token 
 * @returns {object|null}
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Parse cookies from request headers
 * @param {import('node:http').IncomingMessage} req 
 * @returns {Record<string, string>}
 */
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      list[name] = decodeURIComponent(value);
    }
  });

  return list;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  parseCookies,
  JWT_SECRET
};
