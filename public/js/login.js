/**
 * IronPulse Gym - Login Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const identifierInput = document.getElementById('identifier');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const eyeIcon = document.getElementById('eye-icon');
  const errorBanner = document.getElementById('login-error-banner');
  const errorText = document.getElementById('login-error-text');
  const submitBtn = document.getElementById('login-submit-btn');

  // Immediately hide any error banner on load
  hideError();

  // Auto-hide error banner as soon as user types in either input
  if (identifierInput) {
    identifierInput.addEventListener('input', hideError);
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', hideError);
  }

  // Check if already authenticated
  checkExistingAuth();

  async function checkExistingAuth() {
    try {
      const data = await apiRequest('/api/auth/me');
      if (data && data.authenticated && data.user) {
        if (data.user.role === 'admin') {
          window.location.href = '/admin-dashboard.html';
        } else {
          window.location.href = '/user-dashboard.html';
        }
      }
    } catch (e) {
      // Not logged in, stay on login page
    }
  }

  // Toggle Password Visibility
  if (togglePasswordBtn && passwordInput && eyeIcon) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

      if (isPassword) {
        eyeIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>
        `;
      } else {
        eyeIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        `;
      }
    });
  }

  // Handle Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const identifier = identifierInput.value.trim();
      const password = passwordInput.value;

      if (!identifier || !password) {
        showError('Please enter your Mobile Number / User ID and Password.');
        return;
      }

      setLoading(true);

      try {
        const response = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: { identifier, password }
        });

        if (response.success) {
          if (response.token) {
            localStorage.setItem('auradesk_token', response.token);
          }
          if (response.role) {
            localStorage.setItem('auradesk_role', response.role);
          }
          if (response.user) {
            localStorage.setItem('auradesk_user', JSON.stringify(response.user));
          }

          showToast(`Welcome, ${response.user.name}! Redirecting...`, 'success');

          setTimeout(() => {
            window.location.href = response.redirectUrl || (response.role === 'admin' ? '/admin-dashboard.html' : '/user-dashboard.html');
          }, 350);
        } else {
          showError(response.message || 'Login failed. Please check your credentials.');
        }
      } catch (err) {
        showError(err.message || 'Invalid Mobile Number / User ID or Password.');
      } finally {
        setLoading(false);
      }
    });
  }

  function showError(msg) {
    if (errorBanner && errorText) {
      errorText.textContent = msg;
      errorBanner.style.display = 'flex';
    }
  }

  function hideError() {
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    if (loading) {
      submitBtn.innerHTML = `
        <svg class="animate-spin" width="18" height="18" fill="none" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; margin-right: 8px;">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity: 0.25;"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Verifying Credentials...</span>
      `;
    } else {
      submitBtn.innerHTML = `<span>Sign In to Portal</span>`;
    }
  }
});
