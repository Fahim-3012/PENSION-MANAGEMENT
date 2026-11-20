# Free te live kora (TiDB + Render + Vercel)

Ei guide follow korle project ta internet e live hobe, kono taka lagbe na:

| Ongsho | Service | Free URL |
|---|---|---|
| Database (MySQL-compatible) | **TiDB Cloud Starter** | — |
| Backend API (.NET 8, Docker) | **Render** free web service | `https://<name>.onrender.com` |
| Frontend (React) | **Vercel** Hobby | `https://<name>.vercel.app` |

> Free plan er seema: Render er free backend 15 minute kono request na pele ghumie jay, ar abar jagte 30–60 second lage. Ar Render er disk sthayi na, tai restart ba redeploy hole life-verification er chobi muche jay (database er data thake). Demo er jonno eta thik ache.

---

## Step 0 — Code GitHub e tolo

1. https://github.com e account kholo → **New repository** → nam `smart-pension` → **Private** → Create.
2. Project folder e (VS Code terminal):

   ```bash
   cd SmartPension
   git init
   git add .
   git commit -m "Smart Pension capstone"
   git branch -M main
   git remote add origin https://github.com/<tomar-username>/smart-pension.git
   git push -u origin main
   ```

   (Ba **GitHub Desktop** diye: File → Add local repository → Publish.)

`.gitignore` already `node_modules`, `bin`, `obj` bad diye dey.

---

## Step 1 — Database: TiDB Cloud Starter

1. https://tidbcloud.com e sign up koro (Google/GitHub diye, card lagbe na).
2. **Create Cluster** → **Starter** → region **AWS Singapore (ap-southeast-1)** (Bangladesh er kache) → Create.
3. Cluster open → **Connect** button →
   - Connect With: **General**
   - **Generate Password** chapo → password copy kore rakho (pore ar dekhabe na)
4. Oikhane dekhabe: **Host** (jemon `gateway01.ap-southeast-1.prod.aws.tidbcloud.com`), **Port** `4000`, **User** (jemon `4xYz123abc.root`).
5. Tomar connection string (ek line e):

   ```
   Server=HOST;Port=4000;Database=smart_pension;User=USER;Password=PASSWORD;SslMode=VerifyFull;
   ```

Database ba table nije banate hobe na — API prothombar chalu hole nije banabe.

---

## Step 2 — Backend: Render

1. https://render.com e GitHub diye sign up koro.
2. **New + → Web Service** → `smart-pension` repo select koro.
3. Settings:
   - **Name:** `smart-pension-api`
   - **Language / Runtime:** **Docker**
   - **Branch:** `main`
   - **Root Directory:** fanka rakho
   - **Dockerfile Path:** `./Dockerfile`
   - **Instance Type:** **Free**
4. **Environment Variables** (Add Environment Variable):

   | Key | Value |
   |---|---|
   | `ASPNETCORE_ENVIRONMENT` | `Production` |
   | `PORT` | `8080` |
   | `ConnectionStrings__DefaultConnection` | Step 1 er connection string |
   | `Jwt__Key` | kompokkhe 40 okkhorer random lekha (niche dekho) |
   | `Seed__AdminEmail` | tomar admin email |
   | `Seed__AdminPassword` | shoktishali password (jemon `Capstone@2026x`) |
   | `Seed__RegistryCsv` | `database/DEMO_pensioner_registry_200.csv` |
   | `Cors__Origins__0` | apatoto `http://localhost:5173` (Step 4 e bodlabe) |

   Random JWT key banate (Windows PowerShell):
   ```powershell
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
   ```

5. **Deploy Web Service** chapo. Prothom build 5–10 minute lagte pare.
6. Log e `Registry seeded ... 200 records` ar `Now listening on: http://[::]:8080` dekhle ready.
7. Browser e kholo: `https://smart-pension-api.onrender.com/api/health` → `{"status":"ok",...}`

---

## Step 3 — Frontend: Vercel

1. https://vercel.com e GitHub diye sign up (Hobby plan).
2. **Add New… → Project** → `smart-pension` → **Import**.
3. Settings:
   - **Root Directory:** `frontend` (Edit chape select koro)
   - **Framework Preset:** Vite (nije dhorbe)
   - Build Command `npm run build`, Output Directory `dist` (default)
4. **Environment Variables:**

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://smart-pension-api.onrender.com/api` |

5. **Deploy**. Shesh hole URL pabe, jemon `https://smart-pension.vercel.app`.

`npm install` er somoy AI face model gulo nije `public/models` e copy hoy, tai live site e face verification kaj korbe (HTTPS e camera chole).

---

## Step 4 — CORS thik koro (joruri)

1. Render → `smart-pension-api` → **Environment** → `Cors__Origins__0` er value bodle Vercel URL dao, jemon `https://smart-pension.vercel.app` (shesh e `/` chara).
2. **Save Changes** → Render nije abar deploy korbe.

Eta na korle website e "Cannot reach the server" dekhabe.

---

## Step 5 — Test

1. `https://smart-pension.vercel.app` → admin email/password diye login → **Pensioner registry** e 200 record.
2. `/register` e `DEMO-100002`, NID `19598716897684697`, DOB `1959-06-15` diye sign-up.
3. Life verification → AI face check (phone e o kaj kore).

---

## Demo er din

- Presentation er **2–3 minute age** `https://smart-pension-api.onrender.com/api/health` kholo, jate backend jege thake.
- Ager diner life-verification chobi restart e muche jete pare; demo er din notun kore enroll koro.
- Code e kichu bodlale: `git add . && git commit -m "update" && git push` → Render ar Vercel nije update hoy.

---

## Somossa hole

| Somossa | Karon | Solution |
|---|---|---|
| Website e "Cannot reach the server" | Backend ghumacche / CORS bhul | 1 minute opekkha koro; `Cors__Origins__0` = Vercel URL thik ache kina dekho |
| Render log e `Unable to connect` / `Access denied` | Connection string bhul | Host, User (`xxx.root`), Password, `Port=4000`, `SslMode=VerifyFull` check koro |
| Render log e `Jwt:Key must be configured` | `Jwt__Key` nei ba 32 okkhorer kom | 40+ okkhorer key dao |
| Page refresh e 404 | SPA rewrite nei | `frontend/vercel.json` repo te ache kina dekho |
| Login hoy na, kintu health ok | `VITE_API_URL` bhul | Vercel → Settings → Environment Variables → thik kore **Redeploy** |
| Face model load hoy na | Build e model copy hoyni | Vercel build log e `[face-models] copied … model file(s)` ache kina dekho; na thakle app nije CDN theke ane |
| Free hours shesh | Render 750 ghonta/mash | Porer mash e abar chalu hoy; ba onno account |
