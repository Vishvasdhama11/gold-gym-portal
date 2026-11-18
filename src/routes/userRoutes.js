/**
 * User Routes
 * Protected strictly for logged in users viewing their own information.
 * Any attempt to access other user records or perform modifications is rejected.
 */
const { getUserById, getFeeByUserId, getFeePayments } = require('../database');

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleGetMyProfile(req, res) {
  try {
    // Strictly read req.user.id populated from the verified auth token
    const userId = req.user.id;
    const user = getUserById(userId);

    if (!user) {
      return sendJson(res, 404, { success: false, message: 'User profile not found' });
    }

    sendJson(res, 200, {
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        joining_date: user.joining_date,
        address: user.address,
        photo_url: user.photo_url,
        created_at: user.created_at
      }
    });
  } catch (err) {
    sendJson(res, 500, { success: false, message: err.message });
  }
}

function handleGetMyFees(req, res) {
  try {
    // Strictly read req.user.id
    const userId = req.user.id;
    const fee = getFeeByUserId(userId);
    const payments = getFeePayments(userId);

    sendJson(res, 200, {
      success: true,
      fee: {
        total_fees: fee.total_fees,
        paid_fees: fee.paid_fees,
        remaining_fees: fee.remaining_fees,
        payment_status: fee.payment_status,
        monthly_fee: fee.monthly_fee,
        joining_date: fee.joining_date,
        next_billing_date: fee.next_billing_date,
        billing_cycles_billed: fee.billing_cycles_billed,
        last_payment_date: fee.last_payment_date
      },
      payments
    });
  } catch (err) {
    sendJson(res, 500, { success: false, message: err.message });
  }
}

module.exports = {
  handleGetMyProfile,
  handleGetMyFees
};
