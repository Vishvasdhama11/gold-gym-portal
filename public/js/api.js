/**
 * AuraDesk - Core API & UI Helper
 */

// Global Toast System
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success' 
    ? `<svg class="toast-icon" width="20" height="20" fill="none" stroke="#10B981" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`
    : type === 'error'
    ? `<svg class="toast-icon" width="20" height="20" fill="none" stroke="#EF4444" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`
    : `<svg class="toast-icon" width="20" height="20" fill="none" stroke="#4F46E5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-message">${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Escape HTML helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Format Currency
function formatCurrency(num) {
  const n = Number(num) || 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// Core API Request Helper
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('auradesk_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
    credentials: 'include' // include HttpOnly cookies
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  try {
    const res = await fetch(endpoint, fetchOptions);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.message || `Request failed with status ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

// Logout helper
async function logout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // Continue with client logout
  }
  localStorage.removeItem('auradesk_token');
  localStorage.removeItem('auradesk_role');
  localStorage.removeItem('auradesk_user');
  window.location.href = '/login.html';
}

// Auth Guard Check
async function checkAuth(requiredRole = null) {
  try {
    const data = await apiRequest('/api/auth/me');
    if (!data.authenticated || !data.user) {
      window.location.href = '/login.html';
      return null;
    }

    // Role Enforcement
    if (requiredRole && data.user.role !== requiredRole) {
      if (data.user.role === 'admin') {
        window.location.href = '/admin-dashboard.html';
      } else {
        window.location.href = '/user-dashboard.html';
      }
      return null;
    }

    return data.user;
  } catch (err) {
    window.location.href = '/login.html';
    return null;
  }
}
