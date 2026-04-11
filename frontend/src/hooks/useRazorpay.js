import { useCallback } from 'react';
import { calorieAPI } from '../utils/api';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

// Load the Razorpay script once
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * useRazorpay — hook for calorie tracker subscription payment
 *
 * Usage:
 *   const { openCheckout, loading } = useRazorpay({ onSuccess, onError });
 *   <button onClick={openCheckout}>Subscribe ₹99/month</button>
 */
export function useRazorpay({ onSuccess, onError } = {}) {
  const openCheckout = useCallback(async () => {
    // 1. Load script
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      const msg = 'Failed to load payment gateway. Check your internet connection.';
      onError && onError(msg);
      return;
    }

    // 2. Create order on backend
    let orderData;
    try {
      const { data } = await calorieAPI.createOrder();
      orderData = data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create payment order.';
      onError && onError(msg);
      return;
    }

    const { order_id, amount, currency, key_id } = orderData;

    // 3. Get user info from localStorage
    let user = {};
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch (_) {}

    // 4. Open Razorpay checkout
    const options = {
      key:         key_id,
      amount,
      currency,
      name:        'GymMate',
      description: 'Calorie Tracker Pro — ₹99/month',
      order_id,
      prefill: {
        name:    user.name  || '',
        email:   user.email || '',
        contact: user.phone || '',
      },
      theme: { color: '#FF6B35' },
      handler: async (response) => {
        // 5. Verify payment on backend
        try {
          const { data } = await calorieAPI.verifyPayment({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
          });
          onSuccess && onSuccess(data);
        } catch (err) {
          const msg = err.response?.data?.message || 'Payment verification failed. Contact support.';
          onError && onError(msg);
        }
      },
      modal: {
        ondismiss: () => {
          // User closed the checkout without paying — not an error, no action needed
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (response) => {
      const msg = response.error?.description || 'Payment failed. Please try again.';
      onError && onError(msg);
    });
    rzp.open();
  }, [onSuccess, onError]);

  return { openCheckout };
}
