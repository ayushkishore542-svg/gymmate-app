const express    = require('express');
const mongoose   = require('mongoose');
const router     = express.Router();
const User       = require('../models/User');
const Payment    = require('../models/Payment');
const Attendance = require('../models/Attendance');
const authMiddleware = require('../middleware/auth');

// ── Helper: array of objects → CSV string ───────────────────────────────────
function toCsv(rows, columns) {
  const header = columns.map(c => c.label).join(',');
  const body = rows.map(row =>
    columns.map(c => {
      let val = typeof c.getter === 'function' ? c.getter(row) : (row[c.key] ?? '');
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  ).join('\n');
  return header + '\n' + body;
}

// GET /api/exports/members — CSV of all members for this owner
router.get('/members', authMiddleware, async (req, res) => {
  try {
    const ownerId = req.user._id;
    const members = await User.find({ gymOwnerId: ownerId, role: 'member' })
      .select('name loginId email phone membershipStatus membershipStartDate membershipEndDate membershipFee address createdAt')
      .sort({ name: 1 })
      .lean();

    const columns = [
      { label: 'Name',        key: 'name' },
      { label: 'Login ID',    key: 'loginId' },
      { label: 'Email',       key: 'email' },
      { label: 'Phone',       key: 'phone' },
      { label: 'Status',      key: 'membershipStatus' },
      { label: 'Start Date',  getter: r => r.membershipStartDate ? new Date(r.membershipStartDate).toLocaleDateString('en-IN') : '' },
      { label: 'End Date',    getter: r => r.membershipEndDate ? new Date(r.membershipEndDate).toLocaleDateString('en-IN') : '' },
      { label: 'Fee (₹)',     key: 'membershipFee' },
      { label: 'Address',     key: 'address' },
      { label: 'Joined',      getter: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '' },
    ];

    const csv = toCsv(members, columns);
    res.json({ csv, filename: 'members_export.csv', count: members.length });
  } catch (err) {
    console.error('[Export members]', err);
    res.status(500).json({ message: 'Export failed' });
  }
});

// GET /api/exports/payments — CSV of member payments for this owner
router.get('/payments', authMiddleware, async (req, res) => {
  try {
    const ownerId = req.user._id;
    const payments = await Payment.find({ gymOwnerId: ownerId })
      .populate('userId', 'name loginId phone')
      .sort({ createdAt: -1 })
      .lean();

    const columns = [
      { label: 'Member',       getter: r => r.userId?.name || 'Unknown' },
      { label: 'Login ID',     getter: r => r.userId?.loginId || '' },
      { label: 'Amount (₹)',   key: 'amount' },
      { label: 'Method',       key: 'paymentMethod' },
      { label: 'Status',       key: 'paymentStatus' },
      { label: 'Type',         key: 'paymentType' },
      { label: 'Period Start', getter: r => r.periodStart ? new Date(r.periodStart).toLocaleDateString('en-IN') : '' },
      { label: 'Period End',   getter: r => r.periodEnd ? new Date(r.periodEnd).toLocaleDateString('en-IN') : '' },
      { label: 'Date',         getter: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '' },
      { label: 'Notes',        key: 'notes' },
    ];

    const csv = toCsv(payments, columns);
    res.json({ csv, filename: 'payments_export.csv', count: payments.length });
  } catch (err) {
    console.error('[Export payments]', err);
    res.status(500).json({ message: 'Export failed' });
  }
});

// GET /api/exports/attendance — CSV of attendance for this owner
router.get('/attendance', authMiddleware, async (req, res) => {
  try {
    const ownerId = req.user._id;
    const records = await Attendance.find({ gymOwnerId: ownerId })
      .populate('memberId', 'name loginId phone')
      .sort({ checkInTime: -1 })
      .limit(5000)
      .lean();

    const columns = [
      { label: 'Member',       getter: r => r.memberId?.name || 'Unknown' },
      { label: 'Login ID',     getter: r => r.memberId?.loginId || '' },
      { label: 'Date',         key: 'date' },
      { label: 'Check In',     getter: r => r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-IN') : '' },
      { label: 'Check Out',    getter: r => r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-IN') : '' },
      { label: 'Duration (min)', key: 'duration' },
    ];

    const csv = toCsv(records, columns);
    res.json({ csv, filename: 'attendance_export.csv', count: records.length });
  } catch (err) {
    console.error('[Export attendance]', err);
    res.status(500).json({ message: 'Export failed' });
  }
});

module.exports = router;
