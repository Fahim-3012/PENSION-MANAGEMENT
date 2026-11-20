import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api is forwarded to the local ASP.NET Core API. With VITE_API_URL=/api (see .env.tunnel) the whole
// app is served from ONE port, so a single Cloudflare quick tunnel can share it on the internet.
const apiProxy = { "/api": { target: "http://localhost:5080", changeOrigin: true } };
const allowedHosts = ["localhost", ".trycloudflare.com", ".devtunnels.ms"];

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: apiProxy, allowedHosts },
  preview: { port: 4173, proxy: apiProxy, allowedHosts },
});
