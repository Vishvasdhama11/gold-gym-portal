/**
 * Admin Routes
 * Protected strictly for users with role === 'admin'
 */
const {
  getSystemStats,
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getFeeByUserId,
  getFeePayments,
  updateTotalFees,
  addBillingCycle,
  recordPayment
} = require('../database');
const { saveBase64Image } = require('../utils/uploadHelper');

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleGetStats(req, res) {
  try {
    const stats = getSystemStats();
    sendJson(res, 200, { success: true, stats });
  } catch (err) {
    sendJson(res, 500, { success: false, message: err.message });
  }
}

function handleGetUsers(req, res, urlObj) {
  try {
    const search = urlObj.searchParams.get('search') || '';
    const status = urlObj.searchParams.get('status') || '';
    const users = getAllUsers(search, status);
    sendJson(res, 200, { success: true, users });
  } catch (err) {
    sendJson(res, 500, { success: false, message: err.message });
  }
}

function handleCreateUser(req, res, body) {
  try {
    const { name, mobile, password, father_name, address, photo_url, monthly_fee, initial_payment, total_fees, joining_date } = body || {};

    if (!name || !name.trim()) {
      return sendJson(res, 400, { success: false, message: 'Member Name is required.' });
    }
    if (!mobile || !mobile.trim()) {
      return sendJson(res, 400, { success: false, message: 'Mobile Number is required.' });
    }
    if (!password || !password.trim()) {
      return sendJson(res, 400, { success: false, message: 'Password is required.' });
    }

    let finalPhoto = photo_url;
    if (photo_url && photo_url.startsWith('data:image/')) {
      finalPhoto = saveBase64Image(photo_url);
    }

    const feeMonthly = monthly_fee !== undefined ? Number(monthly_fee) : Number(total_fees) || 0;

    const newUser = createUser({
      name: name.trim(),
      mobile: mobile.trim(),
      password: password.trim(),
      father_name: father_name && father_name.trim() ? father_name.trim() : 'N/A',
      address: address && address.trim() ? address.trim() : 'N/A',
      photo_url: finalPhoto,
      monthly_fee: feeMonthly,
      initial_payment: Number(initial_payment) || 0,
      joining_date: joining_date || ''
    });

    sendJson(res, 201, { success: true, message: 'Member created successfully', user: newUser });
  } catch (err) {
    sendJson(res, 400, { success: false, message: err.message });
  }
}

function handleGetUserDetail(req, res, userId) {
  try {
    const user = getUserById(userId);
    if (!user) {
      return sendJson(res, 404, { success: false, message: 'Member not found' });
    }
    const fee = getFeeByUserId(userId);
    const payments = getFeePayments(userId);

    sendJson(res, 200, {
      success: true,
      user,
      fee,
      payments
    });
  } catch (err) {
    sendJson(res, 500, { success: false, message: err.message });
  }
}

function handleUpdateUser(req, res, userId, body) {
  try {
    const { name, mobile, password, address, photo_url, monthly_fee, joining_date } = body || {};

    let finalPhoto = photo_url;
    if (photo_url && photo_url.startsWith('data:image/')) {
      finalPhoto = saveBase64Image(photo_url);
    }

    const updated = updateUser(userId, {
      name: name !== undefined ? name.trim() : undefined,
      mobile: mobile !== undefined ? mobile.trim() : undefined,
      password: password && password.trim() ? password.trim() : undefined,
      address: address !== undefined ? address.trim() : undefined,
      photo_url: finalPhoto,
      monthly_fee: monthly_fee !== undefined ? Number(monthly_fee) : undefined,
      joining_date: joining_date !== undefined ? joining_date.trim() : undefined
    });

    sendJson(res, 200, { success: true, message: 'Member updated successfully', user: updated });
  } catch (err) {
    sendJson(res, 400, { success: false, message: err.message });
  }
}

function handleDeleteUser(req, res, userId) {
  try {
    const result = deleteUser(userId);
    sendJson(res, 200, { success: true, message: 'Member deleted successfully', result });
  } catch (err) {
    sendJson(res, 400, { success: false, message: err.message });
  }
}

function handleGetFee(req, res, userId) {
  try {
    const fee = getFeeByUserId(userId);
    const payments = getFeePayments(userId);
    sendJson(res, 200, { success: true, fee, payments });
  } catch (err) {
    sendJson(res, 500, { success: false, message: err.message });
  }
}

function handleUpdateTotalFee(req, res, userId, body) {
  try {
    const { total_fees, monthly_fee } = body || {};
    if (total_fees === undefined || isNaN(Number(total_fees))) {
      return sendJson(res, 400, { success: false, message: 'Valid total fees amount is required' });
    }

    const updatedFee = updateTotalFees(userId, Number(total_fees), monthly_fee);
    sendJson(res, 200, { success: true, message: 'Fee allocation updated', fee: updatedFee });
  } catch (err) {
    sendJson(res, 400, { success: false, message: err.message });
  }
}

function handleAdvanceCycle(req, res, userId) {
  try {
    const result = addBillingCycle(userId);
    sendJson(res, 200, {
      success: true,
      message: `30-Day renewal cycle applied! (+₹${result.addedAmount} added to total fees)`,
      fee: result.fee
    });
  } catch (err) {
    sendJson(res, 400, { success: false, message: err.message });
  }
}

function handleRecordPayment(req, res, userId, body) {
  try {
    const { amount, payment_date, payment_method, notes } = body || {};
    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      return sendJson(res, 400, { success: false, message: 'Please enter a valid positive payment amount.' });
    }

    const result = recordPayment(userId, amt, payment_date, payment_method, notes);
    sendJson(res, 200, {
      success: true,
      message: 'Payment recorded successfully',
      fee: result.fee,
      payments: result.payments
    });
  } catch (err) {
    sendJson(res, 400, { success: false, message: err.message });
  }
}

const fs = require('node:fs');
const path = require('node:path');

function handleDownloadDb(req, res) {
  try {
    const dbPath = path.join(__dirname, '../../data/portal.db');
    if (!fs.existsSync(dbPath)) {
      return sendJson(res, 404, { success: false, message: 'Database file not found' });
    }
    const stat = fs.statSync(dbPath);
    res.writeHead(200, {
      'Content-Type': 'application/x-sqlite3',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="goldgym_backup.db"'
    });
    fs.createReadStream(dbPath).pipe(res);
  } catch (err) {
    sendJson(res, 500, { success: false, message: err.message });
  }
}

module.exports = {
  handleGetStats,
  handleGetUsers,
  handleCreateUser,
  handleGetUserDetail,
  handleUpdateUser,
  handleDeleteUser,
  handleGetFee,
  handleUpdateTotalFee,
  handleAdvanceCycle,
  handleRecordPayment,
  handleDownloadDb
};
