/**
 * Database Module - Gold Gym Management Portal
 * Uses Node.js native SQLite (node:sqlite DatabaseSync)
 * Supports automated 30-day monthly fee recurring addition
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { hashPassword } = require('./auth');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'portal.db');
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize Tables & Migrations
 */
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL DEFAULT 'user',
      identifier TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      father_name TEXT DEFAULT '',
      address TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      monthly_fee REAL NOT NULL DEFAULT 0.0,
      total_fees REAL NOT NULL DEFAULT 0.0,
      paid_fees REAL NOT NULL DEFAULT 0.0,
      remaining_fees REAL NOT NULL DEFAULT 0.0,
      payment_status TEXT NOT NULL DEFAULT 'Unpaid',
      joining_date TEXT DEFAULT '',
      next_billing_date TEXT DEFAULT '',
      billing_cycles_billed INTEGER DEFAULT 1,
      last_payment_date TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'Cash',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  ensureBillingColumns();
  syncAdminAccount();
}

/**
 * Ensure columns exist if table was created in an older schema
 */
function ensureBillingColumns() {
  try {
    const columns = db.prepare('PRAGMA table_info(fees)').all().map(c => c.name);
    if (!columns.includes('monthly_fee')) {
      db.exec('ALTER TABLE fees ADD COLUMN monthly_fee REAL DEFAULT 0.0;');
    }
    if (!columns.includes('joining_date')) {
      db.exec('ALTER TABLE fees ADD COLUMN joining_date TEXT DEFAULT \'\';');
    }
    if (!columns.includes('next_billing_date')) {
      db.exec('ALTER TABLE fees ADD COLUMN next_billing_date TEXT DEFAULT \'\';');
    }
    if (!columns.includes('billing_cycles_billed')) {
      db.exec('ALTER TABLE fees ADD COLUMN billing_cycles_billed INTEGER DEFAULT 1;');
    }
  } catch (e) {
    // Columns already exist
  }
}

/**
 * Ensure single Gym Admin exists: Mobile 7302424139, Password jatt4321
 */
function syncAdminAccount() {
  const adminMobile = '7302424139';
  const adminPasswordHash = hashPassword('jatt4321');

  const existingAdmin = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');

  if (existingAdmin) {
    db.prepare(`
      UPDATE users 
      SET identifier = ?, mobile = ?, name = ?, password = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      adminMobile,
      adminMobile,
      'Gym Owner / Admin',
      adminPasswordHash,
      '/uploads/default-admin.svg',
      existingAdmin.id
    );
  } else {
    db.prepare(`
      INSERT INTO users (role, identifier, name, mobile, password, father_name, address, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'admin',
      adminMobile,
      'Gym Owner / Admin',
      adminMobile,
      adminPasswordHash,
      'Management',
      'Gold Gym Main Branch',
      '/uploads/default-admin.svg'
    );
  }
}

/**
 * Calculate payment status based on total and paid fees
 */
function calculateStatus(total, paid) {
  const tot = Number(total) || 0;
  const pd = Number(paid) || 0;
  const remaining = Math.max(0, tot - pd);
  if (tot <= 0) return { remaining: 0, status: 'Paid' };
  if (remaining === 0) return { remaining: 0, status: 'Paid' };
  if (pd > 0 && remaining > 0) return { remaining, status: 'Partial' };
  return { remaining, status: 'Unpaid' };
}

/**
 * AUTOMATIC 30-DAY MONTHLY FEE RECURRING ADDITION
 * Checks every registered user with a monthly_fee > 0.
 * If 30 days (or multiples of 30 days) have elapsed since their joining date,
 * their monthly fee is automatically added to total_fees and remaining_fees is updated.
 */
function checkAndApplyMonthlyBilling() {
  try {
    const feesRecords = db.prepare(`
      SELECT f.*, u.name 
      FROM fees f
      JOIN users u ON f.user_id = u.id
      WHERE u.role = 'user' AND f.monthly_fee > 0
    `).all();

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const CYCLE_MS = 30 * DAY_MS;

    for (const fee of feesRecords) {
      if (!fee.joining_date) continue;

      const joinTime = new Date(fee.joining_date).getTime();
      if (isNaN(joinTime) || joinTime > now) continue;

      const elapsedMs = now - joinTime;
      const elapsed30DayCycles = Math.floor(elapsedMs / CYCLE_MS);
      const expectedTotalCycles = 1 + elapsed30DayCycles;
      const currentBilledCycles = Number(fee.billing_cycles_billed) || 1;

      if (expectedTotalCycles > currentBilledCycles) {
        const cyclesToAdd = expectedTotalCycles - currentBilledCycles;
        const amountToAdd = cyclesToAdd * Number(fee.monthly_fee);
        const newTotal = Number(fee.total_fees) + amountToAdd;
        const paid = Number(fee.paid_fees);
        const { remaining, status } = calculateStatus(newTotal, paid);

        const nextBillTime = joinTime + (expectedTotalCycles * CYCLE_MS);
        const nextBillDateStr = new Date(nextBillTime).toISOString().split('T')[0];

        db.prepare(`
          UPDATE fees 
          SET total_fees = ?, remaining_fees = ?, payment_status = ?, billing_cycles_billed = ?, next_billing_date = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(newTotal, remaining, status, expectedTotalCycles, nextBillDateStr, fee.user_id);

        console.log(`[Auto-Billing 30-Day Cycle] Member ${fee.name} (ID: ${fee.user_id}) reached cycle ${expectedTotalCycles}: +₹${amountToAdd} added to Total Fees.`);
      }
    }
  } catch (err) {
    console.error('[Auto-Billing Check Error]', err.message);
  }
}

// Periodically run auto-billing check every hour
setInterval(checkAndApplyMonthlyBilling, 60 * 60 * 1000);

// ================= USER OPERATIONS =================

function getUserById(id) {
  const numId = parseInt(id, 10);
  const user = db.prepare(`
    SELECT id, role, identifier, name, mobile, father_name, address, photo_url, created_at, updated_at
    FROM users WHERE id = ?
  `).get(numId);
  return user || null;
}

function getUserWithAuthById(id) {
  const numId = parseInt(id, 10);
  const user = db.prepare(`
    SELECT id, role, identifier, name, mobile, password, father_name, address, photo_url
    FROM users WHERE id = ?
  `).get(numId);
  return user || null;
}

function getUserByIdentifier(identifier) {
  const cleanId = String(identifier).trim();
  const user = db.prepare(`
    SELECT id, role, identifier, name, mobile, password, father_name, address, photo_url
    FROM users 
    WHERE identifier = ? OR mobile = ? OR (role = 'admin' AND ? = 'admin')
  `).get(cleanId, cleanId, cleanId);
  return user || null;
}

function getAllUsers(search = '', statusFilter = '') {
  // Always trigger auto-billing check so counts and fees are 100% up-to-date
  checkAndApplyMonthlyBilling();

  let query = `
    SELECT 
      u.id, u.role, u.identifier, u.name, u.mobile, u.father_name, u.address, u.photo_url, u.created_at,
      f.total_fees, f.paid_fees, f.remaining_fees, f.payment_status, f.last_payment_date,
      f.monthly_fee, f.joining_date, f.next_billing_date, f.billing_cycles_billed
    FROM users u
    LEFT JOIN fees f ON u.id = f.user_id
    WHERE u.role = 'user'
  `;
  const params = [];

  if (search && search.trim() !== '') {
    query += ` AND (u.name LIKE ? OR u.mobile LIKE ?)`;
    const s = `%${search.trim()}%`;
    params.push(s, s);
  }

  if (statusFilter && statusFilter.trim() !== '' && statusFilter !== 'All') {
    query += ` AND f.payment_status = ?`;
    params.push(statusFilter.trim());
  }

  query += ` ORDER BY u.id DESC`;

  return db.prepare(query).all(...params);
}

function createUser({ name, mobile, password, father_name = '', address = '', photo_url = '', monthly_fee = 0, initial_payment = 0, joining_date = '' }) {
  const cleanName = String(name || '').trim();
  const cleanMobile = String(mobile || '').trim();
  const cleanPassword = String(password || '').trim();
  const cleanFather = String(father_name || '').trim() || 'N/A';
  const cleanAddress = String(address || '').trim() || 'N/A';

  if (!cleanName) throw new Error('Member name is required');
  if (!cleanMobile) throw new Error('Mobile number is required');
  if (!cleanPassword) throw new Error('Password is required');

  const existing = db.prepare('SELECT id FROM users WHERE mobile = ? OR identifier = ?').get(cleanMobile, cleanMobile);
  if (existing) {
    throw new Error(`A member with mobile number ${cleanMobile} already exists`);
  }

  const hashedPassword = hashPassword(cleanPassword);
  const photo = photo_url && photo_url.trim() ? photo_url.trim() : '/uploads/default-avatar.svg';

  const userInsert = db.prepare(`
    INSERT INTO users (role, identifier, name, mobile, password, father_name, address, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('user', cleanMobile, cleanName, cleanMobile, hashedPassword, cleanFather, cleanAddress, photo);

  const userId = userInsert.lastInsertRowid;

  // Monthly fee logic:
  // e.g. monthly_fee = 700. Initial total_fees = 700. Initial payment = 700.
  const monthly = Math.max(0, Number(monthly_fee) || 0);
  const initial = Math.max(0, Number(initial_payment) || 0);
  const total = monthly > 0 ? monthly : initial;
  const paid = Math.min(total, initial);
  const { remaining, status } = calculateStatus(total, paid);

  const today = new Date().toISOString().split('T')[0];
  const joinDate = joining_date && joining_date.trim() ? joining_date.trim() : today;
  
  // Next billing date is exactly 30 days from joining date
  const nextBillDate = new Date(new Date(joinDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO fees (
      user_id, monthly_fee, total_fees, paid_fees, remaining_fees, payment_status,
      joining_date, next_billing_date, billing_cycles_billed, last_payment_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(userId, monthly, total, paid, remaining, status, joinDate, nextBillDate, paid > 0 ? today : '');

  if (paid > 0) {
    db.prepare(`
      INSERT INTO fee_payments (user_id, amount, payment_date, payment_method, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, paid, today, 'Cash', 'Admission / 1st Month Payment');
  }

  return getUserById(userId);
}

function updateUser(id, { name, mobile, password, father_name, address, photo_url, monthly_fee }) {
  const numId = parseInt(id, 10);
  const current = getUserById(numId);
  if (!current) {
    throw new Error('Member not found');
  }

  if (mobile && mobile.trim() !== current.mobile) {
    const cleanMobile = mobile.trim();
    const existing = db.prepare('SELECT id FROM users WHERE (mobile = ? OR identifier = ?) AND id != ?').get(cleanMobile, cleanMobile, numId);
    if (existing) {
      throw new Error('Another member is already registered with this mobile number');
    }
  }

  const updatedName = name !== undefined ? name.trim() : current.name;
  const updatedMobile = mobile !== undefined ? mobile.trim() : current.mobile;
  const updatedFather = father_name !== undefined ? father_name.trim() : current.father_name;
  const updatedAddress = address !== undefined ? address.trim() : current.address;
  const updatedPhoto = photo_url !== undefined && photo_url.trim() ? photo_url : current.photo_url;

  if (password && password.trim().length > 0) {
    const hashedPassword = hashPassword(password.trim());
    db.prepare(`
      UPDATE users 
      SET name = ?, mobile = ?, identifier = ?, password = ?, father_name = ?, address = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedName, updatedMobile, updatedMobile, hashedPassword, updatedFather, updatedAddress, updatedPhoto, numId);
  } else {
    db.prepare(`
      UPDATE users 
      SET name = ?, mobile = ?, identifier = ?, father_name = ?, address = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedName, updatedMobile, updatedMobile, updatedFather, updatedAddress, updatedPhoto, numId);
  }

  // Update monthly fee if provided
  if (monthly_fee !== undefined && !isNaN(Number(monthly_fee))) {
    db.prepare(`
      UPDATE fees SET monthly_fee = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
    `).run(Number(monthly_fee), numId);
  }

  return getUserById(numId);
}

function deleteUser(id) {
  const numId = parseInt(id, 10);
  const user = getUserById(numId);
  if (!user) {
    throw new Error('Member not found');
  }
  if (user.role === 'admin') {
    throw new Error('System Admin cannot be deleted');
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(numId);
  return { success: true, deletedId: numId };
}

// ================= FEE OPERATIONS =================

function getFeeByUserId(userId) {
  const numId = parseInt(userId, 10);
  checkAndApplyMonthlyBilling();

  let fee = db.prepare('SELECT * FROM fees WHERE user_id = ?').get(numId);
  if (!fee) {
    db.prepare(`
      INSERT INTO fees (user_id, total_fees, paid_fees, remaining_fees, payment_status)
      VALUES (?, 0, 0, 0, 'Paid')
    `).run(numId);
    fee = db.prepare('SELECT * FROM fees WHERE user_id = ?').get(numId);
  }
  return fee;
}

function getFeePayments(userId) {
  const numId = parseInt(userId, 10);
  return db.prepare(`
    SELECT id, amount, payment_date, payment_method, notes, created_at
    FROM fee_payments 
    WHERE user_id = ? 
    ORDER BY id DESC
  `).all(numId);
}

function updateTotalFees(userId, newTotalFees, newMonthlyFee) {
  const numId = parseInt(userId, 10);
  const user = getUserById(numId);
  if (!user) throw new Error('Member not found');

  const currentFee = getFeeByUserId(numId);
  const total = Math.max(0, Number(newTotalFees) || 0);
  const paid = currentFee ? Number(currentFee.paid_fees) : 0;
  const { remaining, status } = calculateStatus(total, paid);
  const monthly = newMonthlyFee !== undefined && !isNaN(Number(newMonthlyFee)) ? Number(newMonthlyFee) : currentFee.monthly_fee;

  db.prepare(`
    UPDATE fees 
    SET total_fees = ?, monthly_fee = ?, remaining_fees = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(total, monthly, remaining, status, numId);

  return getFeeByUserId(numId);
}

/**
 * Manually add one 30-day renewal cycle (for instant admin testing or manual billing advance)
 */
function addBillingCycle(userId) {
  const numId = parseInt(userId, 10);
  const user = getUserById(numId);
  if (!user) throw new Error('Member not found');

  const currentFee = getFeeByUserId(numId);
  const monthly = Number(currentFee.monthly_fee) || 0;
  if (monthly <= 0) {
    throw new Error('Please set a Monthly Fee amount greater than ₹0 first.');
  }

  const newTotal = Number(currentFee.total_fees) + monthly;
  const newCycles = (Number(currentFee.billing_cycles_billed) || 1) + 1;
  const { remaining, status } = calculateStatus(newTotal, Number(currentFee.paid_fees));

  // Advance next billing date by 30 days
  const baseTime = currentFee.next_billing_date ? new Date(currentFee.next_billing_date).getTime() : Date.now();
  const nextDateStr = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  db.prepare(`
    UPDATE fees 
    SET total_fees = ?, remaining_fees = ?, payment_status = ?, billing_cycles_billed = ?, next_billing_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(newTotal, remaining, status, newCycles, nextDateStr, numId);

  return {
    fee: getFeeByUserId(numId),
    addedAmount: monthly,
    newTotal
  };
}

function recordPayment(userId, amount, paymentDate, paymentMethod = 'Cash', notes = '') {
  const numId = parseInt(userId, 10);
  const user = getUserById(numId);
  if (!user) throw new Error('Member not found');

  const payAmount = Number(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    throw new Error('Payment amount must be a positive number');
  }

  const currentFee = getFeeByUserId(numId);
  const newPaid = Number(currentFee.paid_fees) + payAmount;
  const total = Number(currentFee.total_fees);
  const { remaining, status } = calculateStatus(total, newPaid);
  const pDate = paymentDate || new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO fee_payments (user_id, amount, payment_date, payment_method, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(numId, payAmount, pDate, paymentMethod || 'Cash', notes || '');

  db.prepare(`
    UPDATE fees 
    SET paid_fees = ?, remaining_fees = ?, payment_status = ?, last_payment_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(newPaid, remaining, status, pDate, numId);

  return {
    fee: getFeeByUserId(numId),
    payments: getFeePayments(numId)
  };
}

function getSystemStats() {
  checkAndApplyMonthlyBilling();

  const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get().count;
  const feeStats = db.prepare(`
    SELECT 
      COALESCE(SUM(total_fees), 0) as total_allocated,
      COALESCE(SUM(paid_fees), 0) as total_collected,
      COALESCE(SUM(remaining_fees), 0) as total_pending
    FROM fees
  `).get();

  const statusBreakdown = db.prepare(`
    SELECT 
      SUM(CASE WHEN payment_status = 'Paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN payment_status = 'Partial' THEN 1 ELSE 0 END) as partial_count,
      SUM(CASE WHEN payment_status = 'Unpaid' THEN 1 ELSE 0 END) as unpaid_count
    FROM fees
  `).get();

  return {
    totalUsers: userCount,
    totalAllocated: feeStats.total_allocated,
    totalCollected: feeStats.total_collected,
    totalPending: feeStats.total_pending,
    statusBreakdown: {
      paid: statusBreakdown.paid_count || 0,
      partial: statusBreakdown.partial_count || 0,
      unpaid: statusBreakdown.unpaid_count || 0
    }
  };
}

// Run init
initDatabase();

module.exports = {
  db,
  initDatabase,
  getUserById,
  getUserWithAuthById,
  getUserByIdentifier,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getFeeByUserId,
  getFeePayments,
  updateTotalFees,
  addBillingCycle,
  recordPayment,
  getSystemStats,
  checkAndApplyMonthlyBilling
};
