/**
 * getEffectiveSubStatus — single source of truth for an owner's effective
 * subscription state. Merges an ACTIVE Google Play OwnerSubscription over the
 * User (Razorpay / trial) record.
 *
 * Used by BOTH routes/subscriptions.js (GET /status) and
 * middleware/subscriptionGuard.js so the merge logic never drifts.
 */
const User = require('../models/User');
const OwnerSubscription = require('../models/OwnerSubscription');

// Google Play owner SKUs → display plan names
const OWNER_PLAN_NAMES = {
  owner_growth_monthly: 'Growth',
  owner_pro_monthly:    'Pro',
};

/**
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<null | {
 *   user: object,             // the User document (Razorpay/trial fields)
 *   status: string,           // effective status (Play override applied)
 *   planName: string,
 *   amount: number,
 *   nextBillingDate: Date|null,
 *   source: 'razorpay'|'google_play',
 *   activeProductId: string|null,
 *   ownerActive: boolean      // true when an active Play sub overrides
 * }>}  null when the user does not exist.
 */
async function getEffectiveSubStatus(userId) {
  const user = await User.findById(userId).select(
    'subscriptionStatus subscriptionEndDate subscriptionStartDate ' +
    'razorpaySubscriptionId razorpayShortUrl paymentMethodAdded ' +
    'currentPeriodStart currentPeriodEnd lastPaymentAt lastPaymentStatus'
  );
  if (!user) return null;

  // Base (Razorpay / trial) view from the User document.
  let status          = user.subscriptionStatus;
  let planName        = 'GymMate Pro';
  let amount          = 699;
  let nextBillingDate = user.currentPeriodEnd;
  let source          = 'razorpay';
  let activeProductId = null;

  // Google Play owner subscription overrides when active + not expired.
  const ownerSub = await OwnerSubscription.findOne({ userId });
  const ownerActive =
    !!ownerSub &&
    ownerSub.status === 'active' &&
    !!ownerSub.expiryTime &&
    new Date(ownerSub.expiryTime).getTime() > Date.now();

  if (ownerActive) {
    status          = 'active';
    planName        = OWNER_PLAN_NAMES[ownerSub.productId] || planName;
    nextBillingDate = ownerSub.expiryTime;
    source          = 'google_play';
    activeProductId = ownerSub.productId;
  }

  return { user, status, planName, amount, nextBillingDate, source, activeProductId, ownerActive };
}

module.exports = { getEffectiveSubStatus, OWNER_PLAN_NAMES };
