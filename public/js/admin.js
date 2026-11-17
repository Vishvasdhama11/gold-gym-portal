/**
 * IronPulse Gym - Admin Dashboard Controller (Optimized for Mobile Phone UX)
 * Automated 30-Day Monthly Fee Management & Live Camera Capture
 */

let currentUsersList = [];
let activeTargetUserId = null;
let activeDeleteUserId = null;
let addPhotoBase64 = null;
let editPhotoBase64 = null;

// Live Camera State
let liveCameraStream = null;
let liveCameraTarget = 'add'; // 'add' | 'edit'
let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Immediately setup event listeners so buttons work without delay
  setupEventListeners();

  // 2. Guard check: Role must be admin
  const adminUser = await checkAuth('admin');
  if (!adminUser) return;

  // Set Nav Profile info
  const navName = document.getElementById('nav-admin-name');
  const navAvatar = document.getElementById('nav-admin-avatar');
  if (navName) navName.textContent = adminUser.name || 'Gym Admin';
  if (navAvatar && adminUser.photo_url) navAvatar.src = adminUser.photo_url;

  // 3. Initial Data Load
  await loadDashboardData();
});

async function loadDashboardData() {
  await Promise.all([
    fetchStats(),
    fetchUsers()
  ]);
}

// Fetch KPI Stats
async function fetchStats() {
  try {
    const data = await apiRequest('/api/admin/stats');
    if (data.success && data.stats) {
      const stats = data.stats;
      document.getElementById('stat-total-users').textContent = stats.totalUsers || 0;
      document.getElementById('stat-total-allocated').textContent = formatCurrency(stats.totalAllocated);
      document.getElementById('stat-total-collected').textContent = formatCurrency(stats.totalCollected);
      document.getElementById('stat-total-pending').textContent = formatCurrency(stats.totalPending);
    }
  } catch (err) {
    showToast('Failed to load stats: ' + err.message, 'error');
  }
}

// Fetch Users with Search & Filter
async function fetchUsers() {
  const searchInput = document.getElementById('user-search-input');
  const statusFilter = document.getElementById('status-filter-select');
  const search = searchInput ? searchInput.value.trim() : '';
  const status = statusFilter ? statusFilter.value : '';

  const tbody = document.getElementById('users-table-body');
  const mobileContainer = document.getElementById('mobile-cards-container');
  const countDisplay = document.getElementById('user-count-display');

  try {
    const queryParams = new URLSearchParams();
    if (search) queryParams.set('search', search);
    if (status && status !== 'All') queryParams.set('status', status);

    const data = await apiRequest(`/api/admin/users?${queryParams.toString()}`);
    if (data.success && Array.isArray(data.users)) {
      currentUsersList = data.users;
      renderDesktopTable(currentUsersList);
      renderMobileCards(currentUsersList);

      if (countDisplay) {
        countDisplay.textContent = `${currentUsersList.length} ${currentUsersList.length === 1 ? 'member' : 'members'} registered`;
      }
    }
  } catch (err) {
    const errMsg = `Failed to load members: ${escapeHtml(err.message)}`;
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: #F87171;">${errMsg}</td></tr>`;
    }
    if (mobileContainer) {
      mobileContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: #F87171;">${errMsg}</div>`;
    }
  }
}

// 1. Render Desktop Table (>768px)
function renderDesktopTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 4h1v16H5V4zm13 0h1v16h-1V4zM3 7h2v10H3V7zm16 0h2v10h-2V7zm-8 4h2v2h-2v-2zm-3 0h2v2H8v-2zm6 0h2v2h-2v-2zM6 9h12v6H6V9z"/>
            </svg>
            <div class="empty-state-title">No Gym Members Yet</div>
            <p class="empty-state-text">No gym members found. Click "Add New Member" to register your first member.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const status = user.payment_status || 'Unpaid';
    const statusClass = status === 'Paid' ? 'badge-paid' : status === 'Partial' ? 'badge-partial' : 'badge-unpaid';
    const avatarSrc = user.photo_url || '/uploads/default-avatar.svg';

    return `
      <tr data-user-id="${user.id}">
        <td>
          <div class="user-info-cell">
            <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(user.name)}" class="user-table-avatar" onerror="this.src='/uploads/default-avatar.svg'">
            <div>
              <div class="user-name-title">${escapeHtml(user.name)}</div>
              <div class="user-id-sub">📱 ${escapeHtml(user.mobile)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(user.father_name || 'N/A')}</td>
        <td style="max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(user.address || '')}">
          ${escapeHtml(user.address || 'N/A')}
        </td>
        <td>
          <div style="font-weight: 800; color: #FFFFFF;">${formatCurrency(user.total_fees)}</div>
          <div style="font-size: 0.75rem; color: var(--primary);">₹${user.monthly_fee || 0}/mo auto</div>
        </td>
        <td>
          <span style="font-weight: 800; color: ${user.remaining_fees > 0 ? '#F87171' : '#34D399'};">
            ${formatCurrency(user.remaining_fees)}
          </span>
          ${user.next_billing_date ? `<div style="font-size: 0.72rem; color: var(--text-muted);">Due: ${formatDate(user.next_billing_date)}</div>` : ''}
        </td>
        <td>
          <span class="badge ${statusClass}">${escapeHtml(status)}</span>
        </td>
        <td style="text-align: right;">
          <div class="actions-cell" style="justify-content: flex-end;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="openViewProfileModal(${user.id})" title="View Profile">
              Profile
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="openFeeManagementModal(${user.id})" title="Manage Fees">
              Fees
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="openEditUserModal(${user.id})" title="Edit Details">
              Edit
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="openDeleteUserModal(${user.id}, '${escapeHtml(user.name.replace(/'/g, "\\'"))}')" title="Delete">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 2. Render Mobile Member Cards (<=768px Phone UX)
function renderMobileCards(users) {
  const container = document.getElementById('mobile-cards-container');
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 4h1v16H5V4zm13 0h1v16h-1V4zM3 7h2v10H3V7zm16 0h2v10h-2V7zm-8 4h2v2h-2v-2zm-3 0h2v2H8v-2zm6 0h2v2h-2v-2zM6 9h12v6H6V9z"/>
        </svg>
        <div class="empty-state-title">No Gym Members Yet</div>
        <p class="empty-state-text">Tap the "+ Add Member" button below to register your first gym member.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = users.map(user => {
    const status = user.payment_status || 'Unpaid';
    const statusClass = status === 'Paid' ? 'badge-paid' : status === 'Partial' ? 'badge-partial' : 'badge-unpaid';
    const avatarSrc = user.photo_url || '/uploads/default-avatar.svg';

    return `
      <div class="member-mobile-card">
        <div class="member-card-header">
          <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(user.name)}" class="member-card-avatar" onerror="this.src='/uploads/default-avatar.svg'">
          <div class="member-card-name-group">
            <div class="member-card-name">${escapeHtml(user.name)}</div>
            <a href="tel:${escapeHtml(user.mobile)}" class="member-card-phone">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>${escapeHtml(user.mobile)}</span>
            </a>
          </div>
          <span class="badge ${statusClass}">${escapeHtml(status)}</span>
        </div>

        <div class="member-card-details-grid">
          <div class="member-card-detail-item">
            <span class="member-card-detail-label">Monthly Plan</span>
            <span class="member-card-detail-val" style="color: var(--primary);">₹${user.monthly_fee || 0}/mo</span>
          </div>
          <div class="member-card-detail-item">
            <span class="member-card-detail-label">Total / Remaining</span>
            <span class="member-card-detail-val" style="color: ${user.remaining_fees > 0 ? '#F87171' : '#34D399'};">
              ${formatCurrency(user.remaining_fees)} <span style="font-size: 0.725rem; color: var(--text-muted); font-weight: normal;">of ${formatCurrency(user.total_fees)}</span>
            </span>
          </div>
          <div class="member-card-detail-item" style="grid-column: span 2;">
            <span class="member-card-detail-label">Next Renewal Due</span>
            <span class="member-card-detail-val" style="font-weight: 600; font-size: 0.8rem; color: #34D399;">
              ${user.next_billing_date ? formatDate(user.next_billing_date) + ' (30-Day Cycle)' : 'Next month'}
            </span>
          </div>
          <div class="member-card-detail-item" style="grid-column: span 2;">
            <span class="member-card-detail-label">Father / Address</span>
            <span class="member-card-detail-val" style="font-weight: 500; font-size: 0.8rem; color: #CBD5E1;">
              ${escapeHtml(user.father_name && user.father_name !== 'N/A' ? user.father_name + ' • ' : '')}${escapeHtml(user.address || 'N/A')}
            </span>
          </div>
        </div>

        <div class="member-card-actions">
          <button type="button" class="btn btn-primary btn-sm" onclick="openFeeManagementModal(${user.id})">
            💳 Fees (${formatCurrency(user.remaining_fees)})
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="openViewProfileModal(${user.id})">
            👤 Profile
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="openEditUserModal(${user.id})">
            ✏️ Edit
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="openDeleteUserModal(${user.id}, '${escapeHtml(user.name.replace(/'/g, "\\'"))}')">
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Setup Event Listeners
function setupEventListeners() {
  // Search & Filter with debounce
  const searchInput = document.getElementById('user-search-input');
  const statusFilter = document.getElementById('status-filter-select');

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchUsers, 250);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', fetchUsers);
  }

  // Add Member Modal Triggers (Header button + Toolbar button + Mobile FAB)
  const btnOpenAdd = document.getElementById('btn-open-add-user');
  const btnToolbarAdd = document.getElementById('btn-toolbar-add-user');
  const btnFabAdd = document.getElementById('btn-fab-add-user');

  function openAddModal() {
    resetAddForm();
    openModal('modal-add-user');
  }

  if (btnOpenAdd) btnOpenAdd.addEventListener('click', openAddModal);
  if (btnToolbarAdd) btnToolbarAdd.addEventListener('click', openAddModal);
  if (btnFabAdd) btnFabAdd.addEventListener('click', openAddModal);

  // Dynamic Monthly Fee preview and auto-initial sync
  const addMonthlyFeeInput = document.getElementById('add-monthly-fee');
  const addInitialPayInput = document.getElementById('add-initial-pay');
  const addPreviewMonthly = document.getElementById('add-preview-monthly');

  if (addMonthlyFeeInput) {
    addMonthlyFeeInput.addEventListener('input', () => {
      const val = addMonthlyFeeInput.value || '0';
      if (addPreviewMonthly) addPreviewMonthly.textContent = val;
      // Auto-populate initial payment if user hasn't explicitly changed it
      if (addInitialPayInput && (addInitialPayInput.value === '700' || addInitialPayInput.value === '' || addInitialPayInput.value === '0')) {
        addInitialPayInput.value = val;
      }
    });
  }

  // Choose Photo from file buttons
  const btnChooseAddPhoto = document.getElementById('btn-choose-add-photo');
  const addPhotoInput = document.getElementById('add-photo-file');
  if (btnChooseAddPhoto && addPhotoInput) {
    btnChooseAddPhoto.addEventListener('click', () => addPhotoInput.click());
  }

  if (addPhotoInput) {
    addPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          addPhotoBase64 = event.target.result;
          document.getElementById('add-photo-preview').src = addPhotoBase64;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Edit photo from file
  const btnChooseEditPhoto = document.getElementById('btn-choose-edit-photo');
  const editPhotoInput = document.getElementById('edit-photo-file');
  if (btnChooseEditPhoto && editPhotoInput) {
    btnChooseEditPhoto.addEventListener('click', () => editPhotoInput.click());
  }

  if (editPhotoInput) {
    editPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          editPhotoBase64 = event.target.result;
          document.getElementById('edit-photo-preview').src = editPhotoBase64;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Live Camera Buttons
  const btnLiveCamAdd = document.getElementById('btn-live-cam-add');
  if (btnLiveCamAdd) {
    btnLiveCamAdd.addEventListener('click', () => startLiveCamera('add'));
  }

  const btnLiveCamEdit = document.getElementById('btn-live-cam-edit');
  if (btnLiveCamEdit) {
    btnLiveCamEdit.addEventListener('click', () => startLiveCamera('edit'));
  }

  // Camera Action Buttons
  const btnCameraSnap = document.getElementById('btn-camera-snap');
  if (btnCameraSnap) {
    btnCameraSnap.addEventListener('click', snapLivePhoto);
  }

  const btnCameraFlip = document.getElementById('btn-camera-flip');
  if (btnCameraFlip) {
    btnCameraFlip.addEventListener('click', flipLiveCamera);
  }

  // Fallback Camera File Input
  const fallbackCameraFile = document.getElementById('fallback-camera-file');
  if (fallbackCameraFile) {
    fallbackCameraFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          if (liveCameraTarget === 'add') {
            addPhotoBase64 = dataUrl;
            document.getElementById('add-photo-preview').src = dataUrl;
          } else {
            editPhotoBase64 = dataUrl;
            document.getElementById('edit-photo-preview').src = dataUrl;
          }
          showToast('Photo captured successfully!', 'success');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Advance 30-Day Billing Cycle Button in Fee Modal
  const btnAdvanceCycle = document.getElementById('btn-advance-cycle');
  if (btnAdvanceCycle) {
    btnAdvanceCycle.addEventListener('click', async () => {
      if (!activeTargetUserId) return;
      btnAdvanceCycle.disabled = true;
      try {
        const res = await apiRequest(`/api/admin/fees/${activeTargetUserId}/add-cycle`, {
          method: 'POST'
        });

        if (res.success) {
          showToast(res.message || '30-Day Cycle advanced! (+monthly fee added)', 'success');
          const paymentsRes = await apiRequest(`/api/admin/fees/${activeTargetUserId}`);
          updateFeeModalDisplay(res.fee, paymentsRes.payments);
          await loadDashboardData();
        } else {
          showToast(res.message || 'Failed to advance billing cycle', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnAdvanceCycle.disabled = false;
      }
    });
  }

  // Submit Add User Form
  const formAddUser = document.getElementById('form-add-user');
  if (formAddUser) {
    formAddUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-new-user');
      const originalText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span>Saving Member...</span>`;

      try {
        const monthlyFeeVal = Number(document.getElementById('add-monthly-fee').value) || 0;
        const initialPayVal = Number(document.getElementById('add-initial-pay').value) || 0;

        const payload = {
          name: document.getElementById('add-name').value.trim(),
          mobile: document.getElementById('add-mobile').value.trim(),
          password: document.getElementById('add-password').value.trim(),
          father_name: document.getElementById('add-father').value.trim() || 'N/A',
          address: document.getElementById('add-address').value.trim() || 'N/A',
          photo_url: addPhotoBase64 || '',
          monthly_fee: monthlyFeeVal,
          initial_payment: initialPayVal
        };

        const res = await apiRequest('/api/admin/users', {
          method: 'POST',
          body: payload
        });

        if (res.success) {
          showToast('Gym member created successfully!', 'success');
          closeModal('modal-add-user');
          resetAddForm();
          await loadDashboardData();
        } else {
          showToast(res.message || 'Failed to create member', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Error creating member', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    });
  }

  // Submit Edit User Form
  const formEditUser = document.getElementById('form-edit-user');
  if (formEditUser) {
    formEditUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('edit-user-id').value;
      const saveBtn = document.getElementById('btn-update-user');
      saveBtn.disabled = true;

      try {
        const payload = {
          name: document.getElementById('edit-name').value.trim(),
          mobile: document.getElementById('edit-mobile').value.trim(),
          password: document.getElementById('edit-password').value.trim(),
          father_name: document.getElementById('edit-father').value.trim(),
          address: document.getElementById('edit-address').value.trim(),
          monthly_fee: Number(document.getElementById('edit-monthly-fee').value) || 0
        };

        if (editPhotoBase64) {
          payload.photo_url = editPhotoBase64;
        }

        const res = await apiRequest(`/api/admin/users/${userId}`, {
          method: 'PUT',
          body: payload
        });

        if (res.success) {
          showToast('Member details updated successfully!', 'success');
          closeModal('modal-edit-user');
          await loadDashboardData();
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // Submit Record Payment Form
  const formRecordPayment = document.getElementById('form-record-payment');
  if (formRecordPayment) {
    formRecordPayment.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeTargetUserId) return;

      const amtInput = document.getElementById('pay-amount');
      const dateInput = document.getElementById('pay-date');
      const methodInput = document.getElementById('pay-method');
      const notesInput = document.getElementById('pay-notes');

      try {
        const payload = {
          amount: Number(amtInput.value),
          payment_date: dateInput.value,
          payment_method: methodInput.value,
          notes: notesInput.value.trim()
        };

        const res = await apiRequest(`/api/admin/fees/${activeTargetUserId}/payments`, {
          method: 'POST',
          body: payload
        });

        if (res.success) {
          showToast('Payment recorded successfully!', 'success');
          amtInput.value = '';
          notesInput.value = '';
          updateFeeModalDisplay(res.fee, res.payments);
          await loadDashboardData();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Submit Update Total Fee Form
  const formUpdateTotal = document.getElementById('form-update-total-fee');
  if (formUpdateTotal) {
    formUpdateTotal.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeTargetUserId) return;

      const totalInput = document.getElementById('update-total-amount');

      try {
        const res = await apiRequest(`/api/admin/fees/${activeTargetUserId}`, {
          method: 'PUT',
          body: { total_fees: Number(totalInput.value) }
        });

        if (res.success) {
          showToast('Membership fee allocation updated!', 'success');
          const paymentsRes = await apiRequest(`/api/admin/fees/${activeTargetUserId}`);
          updateFeeModalDisplay(res.fee, paymentsRes.payments);
          await loadDashboardData();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Confirm Delete Button
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      if (!activeDeleteUserId) return;
      btnConfirmDelete.disabled = true;

      try {
        const res = await apiRequest(`/api/admin/users/${activeDeleteUserId}`, {
          method: 'DELETE'
        });

        if (res.success) {
          showToast('Member deleted permanently.', 'success');
          closeModal('modal-delete-confirm');
          activeDeleteUserId = null;
          await loadDashboardData();
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnConfirmDelete.disabled = false;
      }
    });
  }

  // Modal Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.currentTarget.getAttribute('data-close');
      closeModal(modalId);
    });
  });

  // Click on modal backdrop overlay to close modal and restore page scrolling
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Escape key to dismiss any open modal and restore scrolling
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(activeModal => {
        closeModal(activeModal.id);
      });
    }
  });

  // Modal Tabs switching
  document.querySelectorAll('.tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.getAttribute('data-tab');
      const parent = e.currentTarget.closest('.modal-body') || document;

      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      e.currentTarget.classList.add('active');
      const targetPane = document.getElementById(targetTab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Button in profile modal to open fee modal
  const btnProfileFees = document.getElementById('btn-profile-manage-fees');
  if (btnProfileFees) {
    btnProfileFees.addEventListener('click', () => {
      closeModal('modal-view-profile');
      if (activeTargetUserId) {
        openFeeManagementModal(activeTargetUserId);
      }
    });
  }
}

// Reset Add Form
function resetAddForm() {
  const form = document.getElementById('form-add-user');
  if (form) form.reset();
  addPhotoBase64 = null;
  const preview = document.getElementById('add-photo-preview');
  if (preview) preview.src = '/uploads/default-avatar.svg';

  const monthlyInput = document.getElementById('add-monthly-fee');
  if (monthlyInput) monthlyInput.value = '700';

  const initInput = document.getElementById('add-initial-pay');
  if (initInput) initInput.value = '700';

  const previewSpan = document.getElementById('add-preview-monthly');
  if (previewSpan) previewSpan.textContent = '700';
}

// ================= LIVE CAMERA CONTROLLER =================

async function startLiveCamera(target) {
  liveCameraTarget = target;
  openModal('modal-camera-capture');

  const video = document.getElementById('camera-stream-video');
  if (!video) return;

  try {
    if (liveCameraStream) {
      stopLiveCamera();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Webcam mediaDevices not supported');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 640 },
        height: { ideal: 640 }
      },
      audio: false
    });

    liveCameraStream = stream;
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    console.warn('Camera stream cannot be started directly:', err.message);
    // Smooth fallback to native camera file input for mobile phones/environments
    const fallback = document.getElementById('fallback-camera-file');
    if (fallback) {
      fallback.click();
    } else {
      showToast('Camera not available. Please use Choose Photo button.', 'error');
    }
    closeModal('modal-camera-capture');
  }
}

function stopLiveCamera() {
  if (liveCameraStream) {
    liveCameraStream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
    liveCameraStream = null;
  }
  const video = document.getElementById('camera-stream-video');
  if (video) {
    video.srcObject = null;
  }
}

async function flipLiveCamera() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  stopLiveCamera();
  await startLiveCamera(liveCameraTarget);
}

function snapLivePhoto() {
  const video = document.getElementById('camera-stream-video');
  const canvas = document.getElementById('camera-snapshot-canvas');
  if (!video || !canvas) return;

  const width = video.videoWidth || 480;
  const height = video.videoHeight || 480;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  // If front user camera, mirror capture
  if (currentFacingMode === 'user') {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

  if (liveCameraTarget === 'add') {
    addPhotoBase64 = dataUrl;
    const preview = document.getElementById('add-photo-preview');
    if (preview) preview.src = dataUrl;
  } else {
    editPhotoBase64 = dataUrl;
    const preview = document.getElementById('edit-photo-preview');
    if (preview) preview.src = dataUrl;
  }

  stopLiveCamera();
  closeModal('modal-camera-capture');
  showToast('Live photo captured successfully!', 'success');
}

// Open View Profile Modal
async function openViewProfileModal(userId) {
  activeTargetUserId = userId;
  const content = document.getElementById('view-profile-content');
  content.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted);">Loading member profile...</div>`;
  openModal('modal-view-profile');

  try {
    const data = await apiRequest(`/api/admin/users/${userId}`);
    if (data.success && data.user) {
      const user = data.user;
      const fee = data.fee || {};
      const statusClass = fee.payment_status === 'Paid' ? 'badge-paid' : fee.payment_status === 'Partial' ? 'badge-partial' : 'badge-unpaid';

      content.innerHTML = `
        <div style="text-align: center; margin-bottom: 22px;">
          <img src="${escapeHtml(user.photo_url || '/uploads/default-avatar.svg')}" 
               alt="${escapeHtml(user.name)}" 
               class="user-profile-avatar-large" 
               onerror="this.src='/uploads/default-avatar.svg'">
          <h2 style="font-size: 1.4rem; font-weight: 900; color: #FFFFFF; margin-bottom: 4px;">
            ${escapeHtml(user.name)}
          </h2>
          <span class="badge badge-role-user">Active Gym Member</span>
        </div>

        <div style="background-color: var(--gym-dark); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; margin-bottom: 18px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Mobile Number (Login)</div>
              <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary);">
                <a href="tel:${escapeHtml(user.mobile)}">📱 ${escapeHtml(user.mobile)}</a>
              </div>
            </div>
            <div>
              <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Father / Guardian</div>
              <div style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF;">${escapeHtml(user.father_name || 'N/A')}</div>
            </div>
          </div>
          <div style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Address / City</div>
            <div style="font-size: 0.9rem; font-weight: 500; color: #E2E8F0; margin-top: 2px;">${escapeHtml(user.address || 'N/A')}</div>
          </div>
        </div>

        <!-- Fee Snapshot -->
        <div style="border-top: 1px solid var(--border); padding-top: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <span style="font-weight: 800; font-size: 0.9rem; color: #FFFFFF;">
              Monthly Plan: <span style="color: var(--primary);">₹${fee.monthly_fee || 0}/mo</span>
            </span>
            <span class="badge ${statusClass}">${escapeHtml(fee.payment_status || 'Unpaid')}</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
            <div style="background: var(--gym-card); border: 1px solid var(--border); padding: 10px; border-radius: var(--radius-sm);">
              <div style="font-size: 0.675rem; color: var(--text-muted); font-weight: 700;">TOTAL</div>
              <div style="font-size: 1rem; font-weight: 900; color: #FFFFFF;">${formatCurrency(fee.total_fees)}</div>
            </div>
            <div style="background: var(--gym-card); border: 1px solid var(--border); padding: 10px; border-radius: var(--radius-sm);">
              <div style="font-size: 0.675rem; color: var(--text-muted); font-weight: 700;">PAID</div>
              <div style="font-size: 1rem; font-weight: 900; color: #34D399;">${formatCurrency(fee.paid_fees)}</div>
            </div>
            <div style="background: var(--gym-card); border: 1px solid var(--border); padding: 10px; border-radius: var(--radius-sm);">
              <div style="font-size: 0.675rem; color: var(--text-muted); font-weight: 700;">REMAINING</div>
              <div style="font-size: 1rem; font-weight: 900; color: #F87171;">${formatCurrency(fee.remaining_fees)}</div>
            </div>
          </div>

          <div style="font-size: 0.775rem; color: var(--text-muted); text-align: center; margin-top: 10px;">
            ⚡ Next 30-Day Auto Billing: <strong style="color: #34D399;">${fee.next_billing_date ? formatDate(fee.next_billing_date) : 'N/A'}</strong>
          </div>
        </div>
      `;
    } else {
      content.innerHTML = `<div style="color: #F87171; text-align: center; padding: 20px;">Member profile not found.</div>`;
    }
  } catch (err) {
    content.innerHTML = `<div style="color: #F87171; text-align: center; padding: 20px;">Failed to load profile: ${escapeHtml(err.message)}</div>`;
  }
}

// Open Edit User Modal (Safe lookup + server fetch fallback)
async function openEditUserModal(userId) {
  let user = currentUsersList.find(u => Number(u.id) === Number(userId));

  if (!user) {
    try {
      const data = await apiRequest(`/api/admin/users/${userId}`);
      if (data && data.success && data.user) {
        user = data.user;
      }
    } catch (e) {
      showToast('Member not found. Refreshing list...', 'error');
      await fetchUsers();
      return;
    }
  }

  if (!user) {
    showToast('Member not found. Refreshing list...', 'error');
    await fetchUsers();
    return;
  }

  document.getElementById('edit-user-id').value = user.id;
  document.getElementById('edit-name').value = user.name || '';
  document.getElementById('edit-mobile').value = user.mobile || '';
  document.getElementById('edit-password').value = '';
  document.getElementById('edit-father').value = user.father_name && user.father_name !== 'N/A' ? user.father_name : '';
  document.getElementById('edit-address').value = user.address && user.address !== 'N/A' ? user.address : '';
  document.getElementById('edit-monthly-fee').value = user.monthly_fee || 0;

  editPhotoBase64 = null;
  document.getElementById('edit-photo-preview').src = user.photo_url || '/uploads/default-avatar.svg';

  openModal('modal-edit-user');
}

// Open Fee Management Modal
async function openFeeManagementModal(userId) {
  activeTargetUserId = userId;
  let user = currentUsersList.find(u => Number(u.id) === Number(userId));
  document.getElementById('fee-manage-user-id').value = userId;

  if (user) {
    document.getElementById('fee-modal-username').textContent = `${user.name} (${user.mobile})`;
  }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('pay-date').value = today;

  // Reset tab to Record Payment
  document.querySelectorAll('#modal-fee-management .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#modal-fee-management .tab-pane').forEach(p => p.classList.remove('active'));
  const firstTab = document.querySelector('[data-tab="tab-record-payment"]');
  if (firstTab) firstTab.classList.add('active');
  document.getElementById('tab-record-payment').classList.add('active');

  openModal('modal-fee-management');

  try {
    const data = await apiRequest(`/api/admin/fees/${userId}`);
    if (data.success) {
      if (data.user && !user) {
        document.getElementById('fee-modal-username').textContent = `${data.user.name} (${data.user.mobile})`;
      }
      updateFeeModalDisplay(data.fee, data.payments);
    }
  } catch (err) {
    showToast('Failed to load fee records: ' + err.message, 'error');
  }
}

// Update Fee Modal UI
function updateFeeModalDisplay(fee, payments = []) {
  document.getElementById('fee-modal-total').textContent = formatCurrency(fee.total_fees);
  document.getElementById('fee-modal-paid').textContent = formatCurrency(fee.paid_fees);
  document.getElementById('fee-modal-remaining').textContent = formatCurrency(fee.remaining_fees);

  const statusClass = fee.payment_status === 'Paid' ? 'badge-paid' : fee.payment_status === 'Partial' ? 'badge-partial' : 'badge-unpaid';
  document.getElementById('fee-modal-status-badge').innerHTML = `<span class="badge ${statusClass}">${escapeHtml(fee.payment_status)}</span>`;

  // 30-Day Auto Billing Info
  const monthlyPlanElem = document.getElementById('fee-modal-plan');
  if (monthlyPlanElem) monthlyPlanElem.textContent = `₹${fee.monthly_fee || 0} / month`;

  const nextDueElem = document.getElementById('fee-modal-next-date');
  if (nextDueElem) nextDueElem.textContent = fee.next_billing_date ? formatDate(fee.next_billing_date) : 'N/A';

  const advanceAmtElem = document.getElementById('fee-advance-amt');
  if (advanceAmtElem) advanceAmtElem.textContent = fee.monthly_fee || 0;

  document.getElementById('update-total-amount').value = fee.total_fees || 0;
  document.getElementById('fee-history-count').textContent = payments.length;

  const historyTbody = document.getElementById('payment-history-tbody');
  if (historyTbody) {
    if (payments.length === 0) {
      historyTbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No payments recorded yet.
          </td>
        </tr>
      `;
    } else {
      historyTbody.innerHTML = payments.map(p => `
        <tr>
          <td>${formatDate(p.payment_date)}</td>
          <td style="font-weight: 800; color: #34D399;">${formatCurrency(p.amount)}</td>
          <td><span class="badge" style="background:var(--gym-dark); color:var(--text-muted);">${escapeHtml(p.payment_method || 'Cash')}</span></td>
          <td style="color: var(--text-muted);">${escapeHtml(p.notes || '-')}</td>
        </tr>
      `).join('');
    }
  }
}

// Open Delete User Modal
function openDeleteUserModal(userId, userName) {
  activeDeleteUserId = userId;
  document.getElementById('delete-user-name').textContent = userName;
  openModal('modal-delete-confirm');
}

// Modal Toggle Helpers with backdrop-click & safe scroll restoration
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    // Lock background scroll
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }

  // If camera modal closed, stop live media stream
  if (modalId === 'modal-camera-capture') {
    stopLiveCamera();
  }

  // Check if any other modal is still active; if none, ALWAYS restore page scrolling!
  const anyActive = document.querySelector('.modal-overlay.active');
  if (!anyActive) {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}
