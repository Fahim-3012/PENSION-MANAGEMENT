import axios from "axios";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5080/api").replace(/\/$/, "");
const TOKEN_KEY = "spms_token";

export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) { unauthorizedHandler = fn; }

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

/** Extracts a human-readable message from an Axios error (API returns { message } or ValidationProblemDetails). */
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (error.code === "ECONNABORTED") return "The server took too long to respond. Please try again.";
  if (!error.response) return "Cannot reach the server. Please check your connection or that the API is running.";
  const { status, data } = error.response;
  if (status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (typeof data === "string" && data.trim()) return data;
  if (data?.message) return data.message;
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    if (first) return first;
  }
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested item was not found.";
  return data?.title || fallback;
}

/** Maps ASP.NET Core validation errors ({ Email: ["..."] }) to { email: "..." }. */
export function getFieldErrors(error) {
  const errors = error?.response?.data?.errors;
  if (!errors) return {};
  const result = {};
  for (const [key, messages] of Object.entries(errors)) {
    const clean = key.replace(/^\$\./, "").split(".").pop();
    if (!clean) continue;
    const name = clean.charAt(0).toLowerCase() + clean.slice(1);
    result[name] = Array.isArray(messages) ? messages[0] : String(messages);
  }
  return result;
}

/** Downloads a binary response (PDF/CSV) using the authenticated client. */
export async function downloadFile(url, params, fallbackName) {
  try {
    const res = await api.get(url, { params, responseType: "blob" });
    const disposition = res.headers["content-disposition"] || "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const name = match ? decodeURIComponent(match[1]) : fallbackName;
    const href = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  } catch (error) {
    // Error bodies arrive as Blob when responseType is blob – parse them so messages stay readable.
    const blob = error?.response?.data;
    if (blob instanceof Blob) {
      try { error.response.data = JSON.parse(await blob.text()); } catch { /* keep original */ }
    }
    throw error;
  }
}

/** Fetches an authenticated image and returns an object URL (caller must revoke). */
export async function fetchImageUrl(url) {
  const res = await api.get(url, { responseType: "blob" });
  return URL.createObjectURL(res.data);
}

export default api;
