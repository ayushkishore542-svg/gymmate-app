/**
 * Normalize to E.164 India +91XXXXXXXXXX (10 digits after country code).
 * @param {string} input
 * @returns {string|null}
 */
function normalizeIndianE164(input) {
  if (!input || typeof input !== 'string') return null;
  let s = input.replace(/\s/g, '').trim();
  if (!s) return null;
  if (s.startsWith('+91')) s = s.slice(3);
  else if (s.startsWith('91') && s.length === 12) s = s.slice(2);
  else if (s.startsWith('0')) s = s.replace(/^0+/, '');
  if (!/^\d{10}$/.test(s)) return null;
  return `+91${s}`;
}

module.exports = { normalizeIndianE164 };
