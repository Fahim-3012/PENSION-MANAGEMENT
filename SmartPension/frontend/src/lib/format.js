/** Picks the Bangla variant of a field (e.g. titleBn) when available. */
export function localized(obj, field, lang) {
  if (!obj) return "";
  if (lang === "bn") {
    const bn = obj[`${field}Bn`];
    if (bn) return bn;
  }
  return obj[field] ?? "";
}

/** Greeting key based on the current hour. */
export function greetingKey(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "dash.greetingMorning";
  if (h < 17) return "dash.greetingAfternoon";
  return "dash.greetingEvening";
}

/** yyyy-mm-dd string for <input type="date">. */
export function toInputDate(date) {
  const d = new Date(date);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export const RELATIONSHIPS = ["Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister", "Other"];
export const PENSION_TYPES = ["Government", "Autonomous", "Private", "Military", "OldAge"];
export const GENDERS = ["Male", "Female", "Other"];
export const COMPLAINT_CATEGORIES = ["General", "Payment", "Withdrawal", "Bank", "Verification", "Technical"];
