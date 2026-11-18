/**
 * AuraDesk - User Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Guard check: Verify authentication
  const authUser = await checkAuth('user');
  if (!authUser) return;

  // 2. Load User Profile and Fees
  await Promise.all([
    fetchUserProfile(),
    fetchUserFees()
  ]);
});

// Fetch Personal Profile Details
async function fetchUserProfile() {
  try {
    const data = await apiRequest('/api/user/my-profile');
    if (data.success && data.profile) {
      const p = data.profile;

      // Nav elements
      const navName = document.getElementById('nav-user-name');
      const navMobile = document.getElementById('nav-user-mobile');
      const navAvatar = document.getElementById('nav-user-avatar');

      if (navName) navName.textContent = p.name;
      if (navMobile) navMobile.textContent = p.mobile;
      if (navAvatar && p.photo_url) navAvatar.src = p.photo_url;

      // Welcome header
      const welcomeTitle = document.getElementById('welcome-title');
      if (welcomeTitle) {
        welcomeTitle.textContent = `Welcome, ${p.name}`;
      }

      // Profile Card elements
      const photoLarge = document.getElementById('profile-photo-large');
      const displayName = document.getElementById('profile-display-name');
      const mobileVal = document.getElementById('profile-mobile');
      const joinVal = document.getElementById('profile-joining-date');
      const addressVal = document.getElementById('profile-address');
      const dateVal = document.getElementById('profile-registered-date');

      if (photoLarge && p.photo_url) photoLarge.src = p.photo_url;
      if (displayName) displayName.textContent = p.name;
      if (mobileVal) mobileVal.textContent = p.mobile;
      if (joinVal) joinVal.textContent = p.joining_date ? formatDate(p.joining_date) : (p.created_at ? formatDate(p.created_at) : 'N/A');
      if (addressVal) addressVal.textContent = p.address || 'N/A';
      if (dateVal) dateVal.textContent = formatDate(p.created_at);
    }
  } catch (err) {
    showToast('Failed to load profile details: ' + err.message, 'error');
  }
}

// Fetch Fee Details & Payment History
async function fetchUserFees() {
  const tbody = document.getElementById('user-payment-history-tbody');
  const countSpan = document.getElementById('user-payment-count');

  try {
    const data = await apiRequest('/api/user/my-fees');
    if (data.success) {
      const fee = data.fee || {};
      const payments = data.payments || [];

      // Update Fee Cards
      document.getElementById('user-total-fees').textContent = formatCurrency(fee.total_fees);
      document.getElementById('user-paid-fees').textContent = formatCurrency(fee.paid_fees);
      document.getElementById('user-remaining-fees').textContent = formatCurrency(fee.remaining_fees);

      // Monthly Plan & Next Renewal Date
      const planElem = document.getElementById('profile-monthly-plan');
      const nextElem = document.getElementById('profile-next-renewal');
      if (planElem) planElem.textContent = fee.monthly_fee ? `₹${fee.monthly_fee} / month` : 'Flexible / N/A';
      if (nextElem) nextElem.textContent = fee.next_billing_date ? `${formatDate(fee.next_billing_date)} (30-Day Auto)` : 'N/A';

      // Status Badge
      const status = fee.payment_status || 'Unpaid';
      const statusClass = status === 'Paid' ? 'badge-paid' : status === 'Partial' ? 'badge-partial' : 'badge-unpaid';
      document.getElementById('user-fee-status-badge').innerHTML = `<span class="badge ${statusClass}">${escapeHtml(status)}</span>`;

      // Progress Bar Calculation
      const total = Number(fee.total_fees) || 0;
      const paid = Number(fee.paid_fees) || 0;
      let pct = total > 0 ? Math.round((paid / total) * 100) : (paid > 0 ? 100 : 0);
      pct = Math.min(100, Math.max(0, pct));

      const pctLabel = document.getElementById('fee-percentage-label');
      const pctBar = document.getElementById('fee-progress-bar-fill');
      if (pctLabel) pctLabel.textContent = `${pct}% Paid`;
      if (pctBar) pctBar.style.width = `${pct}%`;

      // Payment History Count
      if (countSpan) countSpan.textContent = payments.length;

      // Render Payment History
      if (tbody) {
        if (payments.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">
                <div class="empty-state" style="padding: 10px;">
                  <div class="empty-state-title" style="font-size: 1rem;">No Payment Receipts Yet</div>
                  <p class="empty-state-text" style="font-size: 0.85rem;">Once payments are credited by the administration, they will appear here with date and transaction details.</p>
                </div>
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = payments.map(p => `
            <tr>
              <td>${formatDate(p.payment_date)}</td>
              <td style="font-weight: 700; color: #059669;">${formatCurrency(p.amount)}</td>
              <td><span class="badge" style="background:#F1F5F9; color:#475569;">${escapeHtml(p.payment_method || 'Cash')}</span></td>
              <td style="color: var(--text-muted);">${escapeHtml(p.notes || '-')}</td>
            </tr>
          `).join('');
        }
      }
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 30px; color: #DC2626;">
            Failed to load fee information: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }
}
