const COMMON_PASSWORDS = new Set(
  [
    'password', 'password1', '12345678', 'qwerty123', 'welcome1', 'admin123',
    'letmein', 'monkey123', 'dragon123', 'master1', 'sunshine1', 'princess1',
    'football1', 'iloveyou1', 'abc12345', 'password123', 'admin1234',
  ].map((s) => s.toLowerCase())
);

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: 'Password must contain at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: 'Password must contain at least one special character' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: 'This password is too common' };
  }
  return { ok: true };
}

// Blocklist-only check. Used by owner-created member accounts (relaxed policy:
// no length/complexity beyond min-6, but worst-case passwords still rejected).
// Does NOT modify validatePasswordStrength — strict paths keep using that.
function isCommonPassword(password) {
  return typeof password === 'string' && COMMON_PASSWORDS.has(password.toLowerCase());
}

module.exports = { validatePasswordStrength, COMMON_PASSWORDS, isCommonPassword };
