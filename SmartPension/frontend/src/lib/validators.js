// Client-side validation mirrors the server rules (server validation is still authoritative).
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phone: /^(\+?880)?01[3-9]\d{8}$/,
  nid: /^(\d{10}|\d{13}|\d{17})$/,
  account: /^\d{8,20}$/,
  routing: /^\d{9}$/,
};

export function validatePassword(pw) {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  if (!/\d/.test(pw)) return "Password must contain a number.";
  if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter.";
  return null;
}

/**
 * Runs a rule map: { field: [ [predicate(value, all), message], ... ] } and returns { field: message }.
 */
export function validate(values, rules) {
  const errors = {};
  for (const [field, checks] of Object.entries(rules)) {
    for (const [ok, message] of checks) {
      if (!ok(values[field], values)) { errors[field] = message; break; }
    }
  }
  return errors;
}

export const required = (msg = "This field is required.") => [(v) => v !== undefined && v !== null && String(v).trim() !== "", msg];
export const matches = (re, msg) => [(v) => !v || re.test(String(v).trim()), msg];
export const minLen = (n, msg) => [(v) => !v || String(v).trim().length >= n, msg];
