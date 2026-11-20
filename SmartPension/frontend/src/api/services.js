import api, { downloadFile, fetchImageUrl } from "./client";

const data = (p) => p.then((r) => r.data);
/** Removes empty values so query strings stay clean. */
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined));

// ---------- Auth ----------
export const authApi = {
  login: (body) => data(api.post("/auth/login", body, { skipAuthRedirect: true })),
  verifyRecord: (body) => data(api.post("/auth/verify-record", body, { skipAuthRedirect: true })),
  register: (body) => data(api.post("/auth/register", body, { skipAuthRedirect: true })),
  me: () => data(api.get("/auth/me")),
  changePassword: (body) => data(api.post("/auth/change-password", body)),
  setLanguage: (language) => data(api.put("/auth/preferences", { language })),
};

// ---------- Pensioner ----------
export const pensionerApi = {
  dashboard: () => data(api.get("/pensioner/dashboard")),
  yearlyChart: () => data(api.get("/pensioner/chart", { params: { range: "yearly" } })),
  profile: () => data(api.get("/pensioner/profile")),
  updateProfile: (body) => data(api.put("/pensioner/profile", body)),
};

export const bankApi = {
  list: () => data(api.get("/bank-accounts")),
  create: (body) => data(api.post("/bank-accounts", body)),
  setPrimary: (id) => data(api.put(`/bank-accounts/${id}/primary`)),
  remove: (id) => data(api.delete(`/bank-accounts/${id}`)),
};

export const nomineeApi = {
  list: () => data(api.get("/nominees")),
  create: (body) => data(api.post("/nominees", body)),
  update: (id, body) => data(api.put(`/nominees/${id}`, body)),
  remove: (id) => data(api.delete(`/nominees/${id}`)),
};

export const paymentApi = {
  list: (params) => data(api.get("/payments", { params: clean(params) })),
  years: () => data(api.get("/payments/years")),
  transactions: (params) => data(api.get("/transactions", { params: clean(params) })),
};

export const withdrawalApi = {
  eligibility: () => data(api.get("/withdrawals/eligibility")),
  list: (params) => data(api.get("/withdrawals", { params: clean(params) })),
  get: (id) => data(api.get(`/withdrawals/${id}`)),
  create: (body) => data(api.post("/withdrawals", body)),
  cancel: (id) => data(api.post(`/withdrawals/${id}/cancel`)),
};

export const lifeApi = {
  status: () => data(api.get("/life-verification")),
  submit: (blob) => {
    const form = new FormData();
    form.append("photo", blob, "life-verification.jpg");
    return data(api.post("/life-verification", form, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  photoUrl: (id) => fetchImageUrl(`/life-verification/${id}/photo`),
  /** AI check: live photo + face-api.js descriptor; the server compares it with the enrolled face. */
  submitFace: (blob, { descriptor, challenge, livenessPassed }) => {
    const form = new FormData();
    form.append("photo", blob, "face.jpg");
    form.append("descriptor", JSON.stringify(descriptor));
    form.append("challenge", challenge);
    form.append("livenessPassed", livenessPassed ? "true" : "false");
    return data(api.post("/life-verification/face", form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 }));
  },
};

export const statementApi = {
  get: (params) => data(api.get("/statements", { params: clean(params) })),
  downloadPdf: (params) => downloadFile("/statements/pdf", clean(params), "pension-statement.pdf"),
};

export const complaintApi = {
  list: () => data(api.get("/complaints")),
  create: (body) => data(api.post("/complaints", body)),
};

export const assistantApi = {
  chat: (message, language) => data(api.post("/assistant/chat", { message, language })),
};

export const notificationApi = {
  list: (params) => data(api.get("/notifications", { params: clean(params) })),
  unreadCount: () => data(api.get("/notifications/unread-count")),
  markRead: (id) => data(api.post(`/notifications/${id}/read`)),
  markAllRead: () => data(api.post("/notifications/read-all")),
  remove: (id) => data(api.delete(`/notifications/${id}`)),
};

// ---------- Admin ----------
export const adminApi = {
  dashboard: () => data(api.get("/admin/dashboard")),
  analytics: (range) => data(api.get("/admin/analytics", { params: { range } })),

  pensioners: (params) => data(api.get("/admin/pensioners", { params: clean(params) })),
  pensioner: (id) => data(api.get(`/admin/pensioners/${id}`)),
  suspendPensioner: (id, reason) => data(api.post(`/admin/pensioners/${id}/suspend`, { reason })),
  reactivatePensioner: (id) => data(api.post(`/admin/pensioners/${id}/reactivate`)),
  resetFace: (id) => data(api.post(`/admin/pensioners/${id}/reset-face`)),
  updatePensionAmount: (id, body) => data(api.put(`/admin/pensioners/${id}/pension-amount`, body)),

  registryStats: () => data(api.get("/admin/registry/stats")),
  registry: (params) => data(api.get("/admin/registry", { params: clean(params) })),
  registryTemplate: () => downloadFile("/admin/registry/template", {}, "pensioner-registry-template.csv"),
  importRegistry: (file, dryRun) => {
    const form = new FormData();
    form.append("file", file);
    return data(api.post("/admin/registry/import", form, { params: { dryRun }, headers: { "Content-Type": "multipart/form-data" } }));
  },
  createRecord: (body) => data(api.post("/admin/registry", body)),
  updateRecord: (id, body) => data(api.put(`/admin/registry/${id}`, body)),
  toggleRecord: (id) => data(api.post(`/admin/registry/${id}/toggle-active`)),

  bankAccounts: (params) => data(api.get("/admin/bank-accounts", { params: clean(params) })),
  verifyBank: (id) => data(api.post(`/admin/bank-accounts/${id}/verify`)),
  rejectBank: (id, reason) => data(api.post(`/admin/bank-accounts/${id}/reject`, { reason })),

  withdrawals: (params) => data(api.get("/admin/withdrawals", { params: clean(params) })),
  reviewWithdrawal: (id) => data(api.post(`/admin/withdrawals/${id}/review`)),
  approveWithdrawal: (id) => data(api.post(`/admin/withdrawals/${id}/approve`)),
  rejectWithdrawal: (id, reason) => data(api.post(`/admin/withdrawals/${id}/reject`, { reason })),
  markWithdrawalPaid: (id, reference) => data(api.post(`/admin/withdrawals/${id}/mark-paid`, { reference })),

  payments: (params) => data(api.get("/admin/payments", { params: clean(params) })),
  generatePayments: (year, month) => data(api.post("/admin/payments/generate", { year, month })),
  processPayment: (id) => data(api.post(`/admin/payments/${id}/process`)),
  processBatch: (year, month) => data(api.post("/admin/payments/process-batch", { year, month })),
  failPayment: (id, reason) => data(api.post(`/admin/payments/${id}/fail`, { reason })),
  retryPayment: (id) => data(api.post(`/admin/payments/${id}/retry`)),

  lifeVerifications: (params) => data(api.get("/admin/life-verifications", { params: clean(params) })),
  lifePhotoUrl: (id) => fetchImageUrl(`/admin/life-verifications/${id}/photo`),
  approveLife: (id) => data(api.post(`/admin/life-verifications/${id}/approve`)),
  rejectLife: (id, reason) => data(api.post(`/admin/life-verifications/${id}/reject`, { reason })),

  nominees: (params) => data(api.get("/admin/nominees", { params: clean(params) })),

  complaints: (params) => data(api.get("/admin/complaints", { params: clean(params) })),
  respondComplaint: (id, body) => data(api.post(`/admin/complaints/${id}/respond`, body)),

  reportSummary: (params) => data(api.get("/admin/reports/summary", { params: clean(params) })),
  reportPdf: (params) => downloadFile("/admin/reports/pdf", clean(params), "smart-pension-report.pdf"),
  reportCsv: (params) => downloadFile("/admin/reports/csv", clean(params), "payments.csv"),

  auditLogs: (params) => data(api.get("/admin/audit-logs", { params: clean(params) })),
  auditActions: () => data(api.get("/admin/audit-logs/actions")),

  settings: () => data(api.get("/admin/settings")),
  updateSettings: (values) => data(api.put("/admin/settings", { values })),

  users: () => data(api.get("/admin/users")),
  createUser: (body) => data(api.post("/admin/users", body)),
  toggleUser: (id) => data(api.post(`/admin/users/${id}/toggle-active`)),
};
