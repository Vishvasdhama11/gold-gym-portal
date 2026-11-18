/**
 * Premium Admin & User Management Web Server
 * Fully self-contained, enterprise-grade architecture using Node.js native capabilities.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { parseCookies, verifyToken } = require('./src/auth');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const userRoutes = require('./src/routes/userRoutes');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = parseInt(process.env.PORT, 10) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive'
};

/**
 * Read request body safely
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Safeguard against unbounded payloads (10MB limit)
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

/**
 * Extract authenticated user from cookies or Authorization header
 */
function authenticateRequest(req) {
  let token = null;

  // 1. From Cookie
  const cookies = parseCookies(req);
  if (cookies.auth_token) {
    token = cookies.auth_token;
  }

  // 2. From Authorization header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    }
  }

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
      return payload;
    }
  }

  req.user = null;
  return null;
}

/**
 * Static file server handler
 */
function serveStaticFile(req, res, pathname) {
  let safePath = pathname === '/' ? '/index.html' : pathname;
  
  // Clean query strings or relative path tricks
  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  // Security: prevent directory traversal outside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  // Check if file exists, or if extensionless HTML route
  let targetPath = filePath;
  if (!fs.existsSync(targetPath) && fs.existsSync(targetPath + '.html')) {
    targetPath = targetPath + '.html';
  }

  fs.stat(targetPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Set cache headers - disable caching during development
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(targetPath);
    stream.pipe(res);
  });
}

/**
 * Main Server Handler
 */
const server = http.createServer(async (req, res) => {
  // Add CORS headers for developer convenience
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Parse URL
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method;

  // Extract authentication
  authenticateRequest(req);

  // ================= API ROUTES =================
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    }

    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(req) : {};

    // 1. Auth Endpoints
    if (pathname === '/api/auth/login' && method === 'POST') {
      return authRoutes.handleLogin(req, res, body);
    }
    if (pathname === '/api/auth/me' && method === 'GET') {
      return authRoutes.handleGetMe(req, res);
    }
    if (pathname === '/api/auth/logout' && method === 'POST') {
      return authRoutes.handleLogout(req, res);
    }

    // 2. Admin Protected Endpoints (Role must be admin)
    if (pathname.startsWith('/api/admin/')) {
      if (!req.user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Authentication required. Please log in as Admin.' }));
      }
      if (req.user.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Forbidden. Admin privileges required.' }));
      }

      // Stats
      if (pathname === '/api/admin/stats' && method === 'GET') {
        return adminRoutes.handleGetStats(req, res);
      }

      // Users List & Create
      if (pathname === '/api/admin/users' && method === 'GET') {
        return adminRoutes.handleGetUsers(req, res, urlObj);
      }
      if (pathname === '/api/admin/users' && method === 'POST') {
        return adminRoutes.handleCreateUser(req, res, body);
      }

      if (pathname === '/api/admin/backup-db' && method === 'GET') {
        return adminRoutes.handleDownloadDb(req, res);
      }

      // Single User Operations: /api/admin/users/:id
      const userMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
      if (userMatch) {
        const targetUserId = parseInt(userMatch[1], 10);
        if (method === 'GET') return adminRoutes.handleGetUserDetail(req, res, targetUserId);
        if (method === 'PUT') return adminRoutes.handleUpdateUser(req, res, targetUserId, body);
        if (method === 'DELETE') return adminRoutes.handleDeleteUser(req, res, targetUserId);
      }

      // Fee Operations: /api/admin/fees/:userId
      const feeMatch = pathname.match(/^\/api\/admin\/fees\/(\d+)$/);
      if (feeMatch) {
        const targetUserId = parseInt(feeMatch[1], 10);
        if (method === 'GET') return adminRoutes.handleGetFee(req, res, targetUserId);
        if (method === 'PUT') return adminRoutes.handleUpdateTotalFee(req, res, targetUserId, body);
      }

      // Payment Recording: /api/admin/fees/:userId/payments
      const paymentMatch = pathname.match(/^\/api\/admin\/fees\/(\d+)\/payments$/);
      if (paymentMatch && method === 'POST') {
        const targetUserId = parseInt(paymentMatch[1], 10);
        return adminRoutes.handleRecordPayment(req, res, targetUserId, body);
      }

      // Manual 30-Day Cycle Advance: /api/admin/fees/:userId/add-cycle
      const cycleMatch = pathname.match(/^\/api\/admin\/fees\/(\d+)\/add-cycle$/);
      if (cycleMatch && method === 'POST') {
        const targetUserId = parseInt(cycleMatch[1], 10);
        return adminRoutes.handleAdvanceCycle(req, res, targetUserId);
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Admin API route not found' }));
    }

    // 3. User Protected Endpoints (Role can be user or admin)
    if (pathname.startsWith('/api/user/')) {
      if (!req.user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Authentication required. Please log in.' }));
      }

      if (pathname === '/api/user/my-profile' && method === 'GET') {
        return userRoutes.handleGetMyProfile(req, res);
      }
      if (pathname === '/api/user/my-fees' && method === 'GET') {
        return userRoutes.handleGetMyFees(req, res);
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'User API route not found' }));
    }

    // Unknown API
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, message: 'Endpoint not found' }));
  }

  // ================= STATIC FILES =================
  serveStaticFile(req, res, pathname);
});

// Render Free Service Keepalive Ping
// Render spins down instances after 15 minutes of inactivity.
// Pinging every 9 minutes resets the timer and keeps the service active 24/7!
const https = require('node:https');

function startKeepAlivePing() {
  const PING_INTERVAL = 9 * 60 * 1000; // 9 minutes
  const pingUrl = process.env.RENDER_EXTERNAL_URL || 'https://gold-gym-portal.onrender.com';

  setInterval(() => {
    try {
      const client = pingUrl.startsWith('https:') ? https : http;
      client.get(pingUrl + '/api/health', (res) => {
        // Ping success - keeps Render active 24/7
      }).on('error', () => {
        // Silently ignore ping errors
      });
    } catch (e) {}
  }, PING_INTERVAL);
}

// Start listening with port fallback
function startServer(port) {
  server.listen(port, () => {
    console.log(`\n=============================================================`);
    console.log(`  🏋️ Gold Gym - Management & Member Fee Portal 🏋️`);
    console.log(`  🚀 Server running at: http://localhost:${port}`);
    console.log(`-------------------------------------------------------------`);
    console.log(`  Single Admin Account:`);
    console.log(`  👑 Admin Mobile: "7302424139"     Password: "jatt4321"`);
    console.log(`=============================================================\n`);

    // Start 24/7 keep-alive ping for Render
    startKeepAlivePing();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Server] Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[Server Error]', err);
    }
  });
}

startServer(PORT);
