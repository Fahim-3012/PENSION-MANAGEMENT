# Smart Pension Management System

A full-stack pension platform for pensioners and administrators.

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, JavaScript, React Router, Axios, Recharts, Motion for React, Lucide icons |
| Backend | ASP.NET Core 8 Web API (C#) |
| Database | MySQL 8 via Entity Framework Core 8 (Pomelo provider) |
| Auth | ASP.NET Core Identity + JWT bearer tokens, role-based authorization |
| PDF | QuestPDF (Community licence) |

Design: Deep Forest Green `#103C35`, Emerald `#168568`, Gold `#D9AA55`, background `#F3F7F5`, cards `#FFFFFF`, text `#25332F`. Fonts: Inter + Noto Sans Bengali.

---

See **VS_CODE_SETUP.md** to run it locally in VS Code, **DEPLOY.md** to put it online for free (TiDB Cloud + Render + Vercel), and **CLOUDFLARE.md** for a Cloudflare quick tunnel or Cloudflare Pages.

## 1. Requirements

- .NET SDK 8.0+
- Node.js 18+ (20 or 22 recommended)
- MySQL 8.0+

## 2. Run the backend

```bash
cd backend/SmartPension.Api

# 1) Set your MySQL connection string (or edit appsettings.json)
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Port=3306;Database=smart_pension;User=root;Password=YOUR_PASSWORD;"

# 2) (Recommended) set your own JWT key and first super-admin
dotnet user-secrets set "Jwt:Key" "a-long-random-secret-of-at-least-32-characters"
dotnet user-secrets set "Seed:AdminEmail" "admin@yourdomain.com"
dotnet user-secrets set "Seed:AdminPassword" "YourStrongPassword1"

# 3) Run
dotnet restore
dotnet run
```

- API: `http://localhost:5080`  ·  Swagger (Development): `http://localhost:5080/swagger`  ·  Health: `/api/health`
- If you ran an older version, drop the `smart_pension` database once (or add a migration) so the new `PensionRecords` table is created.
- On first start the database is created automatically, roles (`Pensioner`, `Admin`, `SuperAdmin`) and default settings are seeded, and the super admin is created **only** from `Seed:AdminEmail` / `Seed:AdminPassword`.
- `appsettings.Development.json` contains a **development-only** JWT key and admin login (`admin@smartpension.local` / `Admin@12345`). Change both before any real deployment.

### Using EF Core migrations (optional, recommended for production)

The app uses `EnsureCreated()` when no migrations exist. To switch to migrations:

```bash
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate
dotnet ef database update
```

After a migration exists, startup calls `Migrate()` automatically. (If the database was already created by `EnsureCreated`, drop it once before applying the first migration.)

## 3. Run the frontend

```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:5080/api
npm install
npm run dev                   # http://localhost:5173
npm run build                 # production build in dist/
```

If you change the frontend port or domain, add it to `Cors:Origins` in the backend settings.

### AI face models

`npm install` runs `scripts/copy-face-models.mjs`, which copies the three face-api.js models (~6.5 MB) to `frontend/public/models`. If that folder is missing, the app downloads the same models from the jsDelivr CDN (needs internet). The first load takes a few seconds; afterwards the browser caches them.

## 4. Pensioner registry (no admin approval)

Accounts are **not** approved by an admin. Instead the office keeps an official list of pensioners (the *registry*):

1. Admin → **Pensioner registry** → *Download template* → fill it in Excel → *File → Save As → CSV UTF-8*.
2. *Choose CSV file* → **Check file** (validates every row, saves nothing, lists problems by line) → **Import**.
   - New Pension IDs are added; existing ones are updated. Records that already have an account keep their name, NID and date of birth; a new monthly amount is applied to the account too (audited and notified).
3. A pensioner signs up at `/register` by entering **Pension ID + NID + date of birth**. If all three match an active record without an account, they see their record, add email/phone/password (and optionally a bank account), and the account is **active immediately**. Name, NID, pension type, organisation and monthly amount come from the registry, not from what the user types.
4. Deactivating a record stops new sign-ups with it; it does not change an existing account (use *Suspend* on the pensioner for that).

Required CSV columns: `PensionId, FullName, NidNumber, DateOfBirth, Gender, PensionType, FormerOrganization, Designation, RetirementDate, MonthlyPensionAmount`. Optional: `FullNameBn, EmployeeId, LastBasicSalary, Phone`. `PensionType` is one of `Government, Autonomous, Private, Military, OldAge`; dates as `YYYY-MM-DD` (also `DD/MM/YYYY`); up to 20,000 rows / 5 MB per file.

`database/DEMO_pensioner_registry_200.csv` contains **200 fictional demo people** (Pension IDs `DEMO-100001` … `DEMO-100200`) for testing only. In Development it is imported automatically on first start (`Seed:RegistryCsv` in `appsettings.Development.json`, only while the registry is empty). Remove that line and import your real list for real use.

## 5. Typical walkthrough

1. Admin imports the registry CSV (above).
2. Open `/register`, enter e.g. `DEMO-100002`, its NID and date of birth from the demo file → finish sign-up → you land on an active dashboard.
3. Admin → **Bank verification** → Verify the bank account.
4. Pensioner → **Life verification** → camera photo → Admin → **Life verification** → Approve.
5. Admin → **Payments** → choose month → *Generate payments* → *Process all pending*.
6. Pensioner → **Withdrawals** → New withdrawal → review → confirm.
7. Admin → **Withdrawal requests** → Start review → Approve (balance debited) → Mark as transferred.
8. Every step appears on the pensioner's timeline and notifications, and in **Audit logs**.

## 6. What is real vs. not connected

Everything shown in the UI comes from the database through the API. No fake data is displayed.

| Feature | Status |
|---|---|
| Payment gateway | **Not configured.** "Processing" a monthly payment credits the internal pension account after real checks (account active, life verification valid). Withdrawal bank transfers are confirmed manually by an admin who can enter the bank's reference. Clearly labelled in the admin UI. |
| Face recognition / liveness | **AI demo, runs in the browser.** face-api.js (TensorFlow.js) detects the face, checks liveness with a random blink or head-turn challenge from 68 facial landmarks, and turns the face into a 128-number descriptor. The **server** compares it with the enrolled descriptor (Euclidean distance ≤ `FaceMatchThreshold`, default 0.50) and approves or rejects. The first check enrols the face. Limits: liveness runs on the client and the reference face is self-enrolled, so this is a demo, not production-grade identity proof. A manual photo review remains as a fallback. |
| NID verification | **Not connected** to the national NID database. NID format is validated; admins review manually. |
| AI assistant | **Rule-based**, bilingual (Bangla/English), answers from the user's live account data. No external AI/LLM service is connected. To add one later, implement it inside `Services/AssistantService.cs` and keep the API key on the server only. |
| SMS / email delivery | Not configured. Notifications are in-app (bell + notifications page). |

## 7. Project structure

```
backend/SmartPension.Api
  Controllers/            Auth, Pensioner (dashboard/profile/bank/nominees/payments), Withdrawals,
                          LifeVerification, Statements, Complaints, Assistant, Notifications
  Controllers/Admin/      Dashboard & analytics, Pensioners, Bank accounts, Withdrawals, Payments,
                          Life verifications, Nominees, Complaints, Reports, Audit logs, Settings, Admin users
  Data/                   AppDbContext (Identity + domain tables), DbInitializer (seed)
  DTOs/                   Request/response contracts with validation attributes
  Middleware/             Error handling (JSON errors), security headers
  Models/                 Entities and enums
  Services/               PensionService (rules), Audit, Notifications, Settings, FileStorage, PDF, Token, Assistant

frontend/src
  api/                    Axios client (JWT, error parsing, downloads) + service modules
  components/ui/          Button, Card, StatCard, Badge, Form fields, Modal/Confirm/Reason dialogs,
                          DataTable, Pagination, Tabs, Stepper, Timeline, Dropdown, Skeleton, Empty/Error states, Alert
  components/layout/      AppShell, collapsible Sidebar, Topbar (search, notifications, language, display, profile)
  components/charts/      Recharts wrappers (validated colour-blind-safe palette)
  components/assistant/   Chat panel (floating + full page)
  context/                Auth, Preferences (language, font size, reduced motion), Toasts, Notifications
  i18n/                   en.js, bn.js
  pages/auth|pensioner|admin|shared
```

## 8. Database tables

Identity tables (`AspNetUsers`, `AspNetRoles`, …) plus: `Pensioners`, `BankAccounts`, `Nominees`, `Payments`, `Withdrawals`, `Transactions` (ledger), `LifeVerifications`, `Notifications`, `AuditLogs`, `Complaints`, `SystemSettings`, `PensionRecords` (the registry).

## 9. Security notes

- Server-side role policies on every endpoint (`PensionerOnly`, `AdminOnly`, `SuperAdminOnly`); pensioner endpoints only ever read the signed-in user's own records.
- DataAnnotations validation on all request DTOs plus business-rule checks in controllers/services.
- Account numbers and NIDs are masked in pensioner responses; admins see full values for verification.
- Login rate-limited (10/min per IP) and Identity lockout after 5 failed attempts.
- Uploads: 5 MB limit, JPG/PNG/WEBP only, magic-byte check, random filenames, stored outside the web root and served only through authorized endpoints.
- Balance changes use an optimistic-concurrency token; every balance movement is recorded in the `Transactions` ledger.
- All admin actions (and key pensioner actions) are written to `AuditLogs` with user, IP and details.
- CSV export neutralises spreadsheet formula injection.
- No secrets in the frontend; JWT key must be ≥ 32 chars and is read from configuration.
