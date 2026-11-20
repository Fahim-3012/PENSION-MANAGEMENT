# Cloudflare diye free live link

Duita upay ache:

| | Upay A: Quick Tunnel | Upay B: Cloudflare Pages |
|---|---|---|
| Ki hoy | Tomar laptop e chola app ta internet e share hoy | Frontend Cloudflare e host hoy |
| Account | **Lage na** | Cloudflare + Render + TiDB |
| Link | `https://random-nam.trycloudflare.com` (prottek bar notun) | `https://smart-pension.pages.dev` (sthayi) |
| Laptop on rakhte hobe? | **Hya** | Na |
| Kar jonno bhalo | Presentation er din demo | 24 ghonta chola link |

> Cloudflare e .NET backend chalano jay na (Workers shudhu JavaScript/WASM chalay). Tai Upay B te backend Render e thake.

---

## Upay A — Quick Tunnel (sobcheye sohoj, kono account lage na)

Laptop e backend ar MySQL cholbe, ar Cloudflare ekta HTTPS link baniye dibe. Je keu link khule tomar app dekhte parbe, phone theke o.

### Ekbar install

Windows PowerShell (Admin na holeo hobe):

```powershell
winget install --id Cloudflare.cloudflared
```

VS Code bondho kore abar kholo. Check: `cloudflared --version`.

(winget na thakle: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ theke Windows `.msi` namao.)

### Prottek bar share korte

1. XAMPP → **MySQL Start**.
2. VS Code → **Terminal → Run Task… → "Share online (backend + build + Cloudflare tunnel)"**.

   Tin ta terminal khulbe:
   - **backend: run** → `Now listening on: http://localhost:5080`
   - **frontend: share build** → `Local: http://localhost:4173/`
   - **Cloudflare quick tunnel** → ekta box er moddhe link:

     ```
     |  https://xxxx-yyyy-zzzz.trycloudflare.com  |
     ```

3. Oi link ta copy kore jake khushi pathao. Login, sign-up, AI face verification sob kaj korbe (HTTPS, tai phone e camera o chole).

### Manually chalate chaile (3 ta terminal)

```bash
# 1
cd backend/SmartPension.Api
dotnet run

# 2
cd frontend
npm run share

# 3
cloudflared tunnel --url http://localhost:4173
```

### Kivabe kaj kore

`npm run share` app ta build kore port 4173 e chalay, ar `/api` request gulo laptop er backend (5080) e pathiye dey. Tai shudhu ekta port share korlei puro app chole, kono CORS setting lage na.

### Mone rakho

- Terminal bondho korle ba laptop ghumie gele link bondho hoye jay.
- Prottek bar notun random link hoy.
- Cloudflare eta test/demo er jonno bole; boro traffic er jonno na.
- Link je pabe se-i app dekhte parbe. Demo shesh hole tunnel terminal e **Ctrl + C** chapo.

---

## Upay B — Cloudflare Pages (sthayi link)

Frontend Vercel er bodole Cloudflare Pages e rakho. Backend ar database `DEPLOY.md` er moto-i: **Render + TiDB**.

1. `DEPLOY.md` er **Step 0–2** koro (GitHub, TiDB, Render).
2. https://dash.cloudflare.com e free account kholo.
3. **Workers & Pages → Create → Pages → Connect to Git** → `smart-pension` repo.
4. Build settings:
   - **Framework preset:** None (ba Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory (advanced):** `frontend`
5. **Environment variables:**
   - `VITE_API_URL` = `https://smart-pension-api.onrender.com/api`
   - `NODE_VERSION` = `20`
6. **Save and Deploy** → link pabe: `https://smart-pension.pages.dev` (project er nam onujayi).
7. Render → `Cors__Origins__0` = `https://smart-pension.pages.dev` → Save.

`frontend/public/_redirects` file already ache, tai page refresh e 404 hobe na.

---

## Upay C — VS Code er Port Forwarding (Dev Tunnels)

VS Code e GitHub/Microsoft account diye sign in thakle Cloudflare chara-o share kora jay.

1. XAMPP → MySQL Start.
2. Terminal 1: `cd backend/SmartPension.Api` → `dotnet run`
3. Terminal 2: `cd frontend` → `npm run dev:share`
   (`.env.tunnel` er `VITE_API_URL=/api` use kore, tai API request ek-i port diye jay)
4. Niche **Ports** tab → **Forward a Port** → `5173`.
5. 5173 er upor right-click → **Port Visibility → Public**.
6. **Forwarded Address** (`https://....devtunnels.ms`) copy kore pathao.

Prothombar link khulle Microsoft er warning page ashe → **Continue** chapo. 5080 port forward korte hobe na. Demo shesh hole Visibility **Private** koro.

---

## Kon ta nebo?

- **Presentation er din, laptop samne thakbe:** Upay A. 2 minute e link, kono account na.
- **Supervisor ke link pathabe je jokhon khushi dekhbe:** Upay B (ba Vercel, `DEPLOY.md`).
