/**
 * Gold Gym - User Dashboard Controller (Mobile & Desktop)
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

      if (photoLarge && p.photo_url) photoLarge.src = p.photo_url;
      if (displayName) displayName.textContent = p.name;
      if (mobileVal) mobileVal.textContent = p.mobile;
      if (joinVal) joinVal.textContent = p.joining_date ? formatDate(p.joining_date) : (p.created_at ? formatDate(p.created_at) : 'N/A');
      if (addressVal) addressVal.textContent = p.address || 'N/A';
    }
  } catch (err) {
    showToast('Failed to load profile details: ' + err.message, 'error');
  }
}

// Fetch Fee Details & Payment History (Desktop & Mobile)
async function fetchUserFees() {
  const tbody = document.getElementById('user-payment-history-tbody');
  const mobileContainer = document.getElementById('user-mobile-receipts-container');
  const countSpan = document.getElementById('user-payment-count');

  try {
    const data = await apiRequest('/api/user/my-fees');
    if (data.success) {
      const fee = data.fee || {};
      const payments = data.payments || [];

      // Update Fee Cards
      const totalEl = document.getElementById('user-total-fees');
      const paidEl = document.getElementById('user-paid-fees');
      const remEl = document.getElementById('user-remaining-fees');

      if (totalEl) totalEl.textContent = formatCurrency(fee.total_fees);
      if (paidEl) paidEl.textContent = formatCurrency(fee.paid_fees);
      if (remEl) remEl.textContent = formatCurrency(fee.remaining_fees);

      // Monthly Plan & Next Renewal Date
      const planElem = document.getElementById('profile-monthly-plan');
      const nextElem = document.getElementById('profile-next-renewal');
      if (planElem) planElem.textContent = fee.monthly_fee ? `₹${fee.monthly_fee} / mo` : 'Flexible / N/A';
      if (nextElem) nextElem.textContent = fee.next_billing_date ? `${formatDate(fee.next_billing_date)} (30-Day Auto)` : 'N/A';

      // Status Badge
      const status = fee.payment_status || 'Unpaid';
      const statusClass = status === 'Paid' ? 'badge-paid' : status === 'Partial' ? 'badge-partial' : 'badge-unpaid';
      const badgeContainer = document.getElementById('user-fee-status-badge');
      if (badgeContainer) {
        badgeContainer.innerHTML = `<span class="badge ${statusClass}">${escapeHtml(status)}</span>`;
      }

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

      // 1. Render Desktop Table View
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
              <td style="font-weight: 800; color: #34D399;">${formatCurrency(p.amount)}</td>
              <td><span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">${escapeHtml(p.payment_method || 'Cash')}</span></td>
              <td style="color: var(--text-muted);">${escapeHtml(p.notes || '-')}</td>
            </tr>
          `).join('');
        }
      }

      // 2. Render Mobile Cards View
      if (mobileContainer) {
        if (payments.length === 0) {
          mobileContainer.innerHTML = `
            <div class="empty-state" style="padding: 24px 10px;">
              <svg fill="currentColor" viewBox="0 0 24 24" style="width: 44px; height: 44px; margin-bottom: 8px; color: var(--text-light);">
                <path d="M5 4h1v16H5V4zm13 0h1v16h-1V4zM3 7h2v10H3V7zm16 0h2v10h-2V7zm-8 4h2v2h-2v-2zm-3 0h2v2H8v-2zm6 0h2v2h-2v-2zM6 9h12v6H6V9z"/>
              </svg>
              <div class="empty-state-title" style="font-size: 1rem;">No Payment Receipts Yet</div>
              <p class="empty-state-text" style="font-size: 0.8rem;">When payments are credited by Gold Gym administration, official receipts will be logged here.</p>
            </div>
          `;
        } else {
          mobileContainer.innerHTML = payments.map(p => `
            <div class="receipt-mobile-card">
              <div class="receipt-card-top">
                <span class="receipt-card-date">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  ${formatDate(p.payment_date)}
                </span>
                <span class="receipt-card-method">${escapeHtml(p.payment_method || 'Cash')}</span>
              </div>
              <div class="receipt-card-main">
                <span style="font-size: 0.775rem; color: var(--text-muted); font-weight: 600;">Paid Installment</span>
                <span class="receipt-card-amount">+${formatCurrency(p.amount)}</span>
              </div>
              ${p.notes ? `<div class="receipt-card-note">📝 ${escapeHtml(p.notes)}</div>` : ''}
            </div>
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
    if (mobileContainer) {
      mobileContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #DC2626; font-size: 0.85rem;">
          Failed to load fee information: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}
