/**
 * Auth Routes
 */
const { getUserByIdentifier, getUserById } = require('../database');
const { verifyPassword, createToken } = require('../auth');

function handleLogin(req, res, body) {
  const { identifier, password } = body || {};

  if (!identifier || !password) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, message: 'User ID / Mobile Number and Password are required.' }));
  }

  const user = getUserByIdentifier(identifier);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, message: 'Invalid Mobile Number / User ID. Member not found.' }));
  }

  const isValid = verifyPassword(String(password).trim(), user.password);
  if (!isValid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, message: 'Incorrect Password. Please check your password.' }));
  }

  // Generate Token
  const payload = {
    id: user.id,
    role: user.role,
    name: user.name,
    mobile: user.mobile,
    identifier: user.identifier
  };
  const token = createToken(payload, 86400 * 7); // 7 days

  // Determine redirection target based strictly on role
  const redirectUrl = user.role === 'admin' ? '/admin-dashboard.html' : '/user-dashboard.html';

  // Set secure HTTP-only cookie
  const cookieStr = `auth_token=${token}; HttpOnly; Path=/; Max-Age=${86400 * 7}; SameSite=Lax`;

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Set-Cookie': cookieStr
  });

  return res.end(JSON.stringify({
    success: true,
    token, // Also return in body for Authorization header fallback
    role: user.role,
    redirectUrl,
    user: {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      role: user.role,
      photo_url: user.photo_url
    }
  }));
}

function handleGetMe(req, res) {
  if (!req.user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ authenticated: false, message: 'Not authenticated' }));
  }

  const user = getUserById(req.user.id);
  if (!user) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ authenticated: false, message: 'User record not found' }));
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      role: user.role,
      joining_date: user.joining_date,
      address: user.address,
      photo_url: user.photo_url,
      created_at: user.created_at
    }
  }));
}

function handleLogout(req, res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Set-Cookie': 'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
  });
  return res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
}

module.exports = {
  handleLogin,
  handleGetMe,
  handleLogout
};
