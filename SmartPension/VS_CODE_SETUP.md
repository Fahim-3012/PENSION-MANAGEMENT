# VS Code e Smart Pension cholano (step by step)

Ei guide follow korle backend (ASP.NET Core 8), frontend (React + Vite) ar MySQL database VS Code theke cholbe, ar 200 jon demo pensioner nije theke load hobe.

---

## 1. Ekbar install korte hobe

| Software | Kothay pabe | Check command |
|---|---|---|
| .NET 8 SDK | https://dotnet.microsoft.com/download/dotnet/8.0 | `dotnet --version` → `8.x.x` |
| Node.js 20 LTS (ba 22) | https://nodejs.org | `node -v` |
| XAMPP (MySQL er jonno) | https://www.apachefriends.org | XAMPP Control Panel e MySQL **Start** |
| Visual Studio Code | https://code.visualstudio.com | — |
| VS Code extension: **C# Dev Kit** | VS Code → Extensions → "C# Dev Kit" | — |

> Project folder khulle VS Code nije theke C# Dev Kit install korte bolbe (`.vscode/extensions.json`). **Install** chapo.

---

## 2. Project kholo

1. `SmartPension.zip` unzip koro, jemon `D:\Projects\SmartPension`.
2. VS Code → **File → Open Folder** → `SmartPension` folder (jei folder e `backend`, `frontend`, `database` ache) select koro.

---

## 3. MySQL chalu koro

1. XAMPP Control Panel → **MySQL → Start** (port 3306 sobuj hobe).
2. Database nije banate hobe na — API prothombar chalu hole `smart_pension` database ar sob table nije banabe.
3. Connection string thik koro: `backend/SmartPension.Api/appsettings.json`

   ```json
   "DefaultConnection": "Server=localhost;Port=3306;Database=smart_pension;User=root;Password=;"
   ```

   XAMPP e root er password na thakle `Password=;` (fanka) rakho. Password thakle seta likho.

> Ager kono version cholie thakle phpMyAdmin (http://localhost/phpmyadmin) theke `smart_pension` database ta **Drop** kore dao, jate notun table toiri hoy.

---

## 4. Ek click e sob chalao

VS Code e **Ctrl + Shift + B** chapo → **"Run Smart Pension (backend + frontend)"** select koro.

Duita terminal khulbe:

| Terminal | Ki dekhbe | Mane |
|---|---|---|
| backend: run | `Registry seeded from DEMO_pensioner_registry_200.csv: 200 records` ar `Now listening on: http://localhost:5080` | API + database ready, 200 demo pensioner loaded |
| frontend: dev | `Local: http://localhost:5173/` | Website ready |

> `npm install` AI face model gulo o `frontend/public/models` e copy kore dey.
> **Prothombar** frontend chalanor age ekbar `npm install` lagbe: **Terminal → Run Task… → frontend: install** (ba terminal e `cd frontend` → `npm install`). Eta 1–3 minute lagte pare.

### Manually chalate chaile (duita terminal)

```bash
# Terminal 1 – backend
cd backend/SmartPension.Api
dotnet run

# Terminal 2 – frontend
cd frontend
npm install      # shudhu prothombar
npm run dev
```

### Debug korte chaile

**Run and Debug** (Ctrl + Shift + D) → **"Backend: debug API"** → F5. C# code e breakpoint dile oikhane theme jabe.

---

## 5. Check koro sob cholche kina

1. Browser e http://localhost:5080/api/health → `{"status":"ok",...}`
2. http://localhost:5080/swagger → sob API er list
3. http://localhost:5173 → login page

---

## 6. Login ar test

### Admin

| Email | Password |
|---|---|
| `admin@smartpension.local` | `Admin@12345` |

Admin → **Pensioner registry** e 200 ta record dekhbe ("No account yet").

### Pensioner sign-up (demo record diye)

`/register` page e ei je kono ekta diye sign-up koro (pura list: `database/DEMO_pensioner_registry_200.csv`):

| Pension ID | Nam | NID | Jonmo tarikh | Type | Masik pension |
|---|---|---|---|---|---|
| DEMO-100002 | Khairul Mollah | 19598716897684697 | 1959-06-15 | Government | 11,000 |
| DEMO-100004 | Jahanara Sultana | 5571784726 | 1962-09-25 | Military | 27,500 |
| DEMO-100012 | Habibur Mollah | 19651102859406925 | 1965-06-07 | Private | 7,050 |
| DEMO-100061 | Shahana Yasmin | 3433516585 | 1950-12-23 | Government | 11,000 |
| DEMO-100186 | Ataur Amin | 3136765118580 | 1942-09-25 | OldAge | 600 |

1. Pension ID + NID + jonmo tarikh → **Find my record** → record dekhabe.
2. Email (jemon `khairul@test.com`), mobile (`01712345678`), password (`Test1234`) dao.
3. Thikana + bank (optional) → Review → **Submit** → account sathe sathe active.

### Pura flow test

1. Admin → **Bank verification** → Verify
2. Pensioner → **Life verification** → **AI face verification** card:
   - **Start camera** → camera Allow → mukher chare dike sobuj box ashbe
   - **Enrol my face** → screen e je challenge ashe (dui bar chokh er palok fela ba matha ghorano) sheta koro → "Face enrolled and verified"
   - Abar **Try again → Verify me** → AI tomar enrolled face er sathe milabe, "Face distance 0.3xx (limit 0.50)" dekhabe → approved
   - Onno karo mukh diye try korle "Face did not match" hobe
   - Admin → Life verification e protita chesta "AI match / AI failed" ar distance soho dekhabe
3. Admin → **Payments** → mash select → **Generate payments** → **Process all pending**
4. Pensioner dashboard e balance dekhabe → **Withdrawals → New withdrawal**
5. Admin → **Withdrawal requests** → Review → Approve → Mark as transferred

---

## 6.5 Internet e share kora

Laptop theke onnoder link dite chaile `CLOUDFLARE.md` dekho: Cloudflare quick tunnel (`npm run share` + `cloudflared`) ba VS Code Ports tab (`npm run dev:share` → 5173 forward → Public).

## 7. Somossa hole

| Error | Karon | Solution |
|---|---|---|
| Website e "Cannot reach the server" | Backend chole na | backend terminal er red error dekho; http://localhost:5080/api/health check koro |
| `Unable to connect to any of the specified MySQL hosts` | MySQL off / port bhul | XAMPP e MySQL Start; port 3306 |
| `Access denied for user 'root'` | Password bhul | `appsettings.json` e `Password=` thik koro |
| `Unknown column` / `Table doesn't exist` | Purono database | phpMyAdmin theke `smart_pension` drop kore API abar chalao |
| `dotnet` command pawa jay na | .NET SDK nei / VS Code restart lagbe | .NET 8 SDK install → VS Code bondho kore abar kholo |
| `npm` pawa jay na | Node.js nei | Node.js install → VS Code restart |
| Port 5173 busy | Vite onno port e chole (5174) | Terminal e je URL dekhay oita kholo — development e CORS sob localhost port allow kore |
| Camera khule na | Browser permission | Address bar er camera icon → Allow; `localhost` e kaj kore |
| "AI models could not be loaded" | `public/models` nei ar internet o nei | `cd frontend` → `npm install` abar chalao (model copy hoy), ba internet on rakho |
| Box ashe kintu challenge pass hoy na | Alo kom / mukh choto | Alo te bosho, camera theke 40–60 cm dure, sojasoji takao |
| Registry e 0 record | Seed hoy na jodi registry agei bhora thake | Admin → Pensioner registry → Import diye CSV upload koro |

---

## 8. Ashol data dite chaile

1. `backend/SmartPension.Api/appsettings.Development.json` theke `"RegistryCsv": ...` line ta muche dao (comma thik rekho).
2. Database drop kore API abar chalao (ba demo record gulo deactivate koro).
3. Admin → **Pensioner registry** → **Download template** → Excel e data bharo → **CSV UTF-8** save → **Check file** → **Import**.

Column er rule gulo "Pensioner Registry Dataset Guide" spreadsheet e ache.
