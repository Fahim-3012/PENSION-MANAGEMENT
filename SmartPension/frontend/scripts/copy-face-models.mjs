// Copies the face-api.js model weights from node_modules into public/models so the app
// can load them from its own server (http://localhost:5173/models). Runs after `npm install`.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@vladmandic", "face-api", "model");
const target = join(root, "public", "models");
const wanted = ["tiny_face_detector_model", "face_landmark_68_model", "face_recognition_model"];

if (!existsSync(source)) {
  console.warn("[face-models] @vladmandic/face-api is not installed yet; the app will load models from the CDN instead.");
  process.exit(0);
}
mkdirSync(target, { recursive: true });
let copied = 0;
for (const file of readdirSync(source)) {
  if (wanted.some((w) => file.startsWith(w))) {
    copyFileSync(join(source, file), join(target, file));
    copied++;
  }
}
console.log(`[face-models] copied ${copied} model file(s) to public/models`);
