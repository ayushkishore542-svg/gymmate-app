const Razorpay = require('razorpay');
const crypto  = require('crypto');

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay subscription with a 15-day trial.
 * The subscription charges begin after start_at (trial end date).
 *
 * @param {string} userId   - MongoDB owner _id (stored in notes)
 * @param {string} email    - Owner email for customer notification
 * @param {string} phone    - Owner phone
 * @returns {{ subscriptionId, shortUrl }}
 */
async function createSubscription(userId, email, phone) {
  const trialDays   = parseInt(process.env.RAZORPAY_TRIAL_DAYS || '15', 10);
  const trialEndTs  = Math.floor((Date.now() + trialDays * 24 * 60 * 60 * 1000) / 1000);

  const subscription = await razorpay.subscriptions.create({
    plan_id:         process.env.RAZORPAY_PLAN_ID,
    total_count:     120,           // 10 years of monthly billing
    quantity:        1,
    start_at:        trialEndTs,    // first charge after trial
    customer_notify: 1,             // Razorpay sends SMS/email reminders
    notes: {
      userId,
      email: email || '',
    },
    notify_info: {
      notify_phone: phone || '',
      notify_email: email || '',
    },
  });

  return {
    subscriptionId: subscription.id,
    shortUrl:       subscription.short_url,
  };
}

/**
 * Cancel a Razorpay subscription.
 * cancelAtCycleEnd = true → user keeps access till current period end.
 */
async function cancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
  return razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

/**
 * Fetch fresh subscription details from Razorpay.
 */
async function fetchSubscription(subscriptionId) {
  return razorpay.subscriptions.fetch(subscriptionId);
}

/**
 * Verify the webhook signature sent by Razorpay.
 * Razorpay signs the raw request body with HMAC-SHA256.
 *
 * @param {string|Buffer} rawBody  - raw request body (before JSON.parse)
 * @param {string}        signature - value of x-razorpay-signature header
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const sig = String(signature || '');
  const expBuf = Buffer.from(expected, 'utf8');
  const sigBuf = Buffer.from(sig, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Verify Razorpay payment signature from client checkout (order_id + "|" + payment_id).
 */
function verifyPaymentCaptureSignature(orderId, paymentId, razorpaySignature) {
  if (!orderId || !paymentId || !razorpaySignature || !process.env.RAZORPAY_KEY_SECRET) {
    return false;
  }
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'utf8');
  const sigBuf = Buffer.from(String(razorpaySignature), 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

module.exports = {
  createSubscription,
  cancelSubscription,
  fetchSubscription,
  verifyWebhookSignature,
  verifyPaymentCaptureSignature,
};
