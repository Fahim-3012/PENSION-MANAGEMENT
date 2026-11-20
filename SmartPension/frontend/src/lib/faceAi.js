// AI face analysis in the browser with face-api.js (@vladmandic/face-api, TensorFlow.js).
// Three neural networks run on the user's device: a face detector, a 68-point landmark model and a
// face-recognition model that turns a face into 128 numbers (a "descriptor"). The server compares
// descriptors; this file only measures what the camera sees.

const LOCAL_MODELS = "/models";
const CDN_MODELS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7/model";

let loading = null;

/** Loads the library (code-split, ~1 MB) and the three models once. Returns the faceapi module. */
export function loadFaceAi() {
  if (!loading) {
    loading = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      const loadFrom = async (uri) => {
        await faceapi.nets.tinyFaceDetector.loadFromUri(uri);
        await faceapi.nets.faceLandmark68Net.loadFromUri(uri);
        await faceapi.nets.faceRecognitionNet.loadFromUri(uri);
      };
      try {
        await loadFrom(LOCAL_MODELS);
      } catch {
        await loadFrom(CDN_MODELS); // public/models missing (postinstall not run) → use the CDN copy
      }
      return faceapi;
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Eye aspect ratio (Soukupová & Čech): about 0.3 when open, below about 0.2 when closed. */
function eyeRatio(eye) {
  const [p1, p2, p3, p4, p5, p6] = eye;
  return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
}

/**
 * Head yaw as the nose tip's position between the jaw edges: 0.5 = facing the camera,
 * lower or higher = turned to one side.
 */
function yawRatio(landmarks) {
  const jaw = landmarks.getJawOutline();
  const nose = landmarks.getNose();
  const left = jaw[0].x;
  const right = jaw[16].x;
  return (nose[3].x - left) / Math.max(1, right - left);
}

/**
 * Analyses one video frame. Returns { faces, face } where face (only when exactly one face is found) holds
 * the detection box, score, eye ratio, yaw ratio and the 128-number descriptor.
 */
export async function analyzeFrame(faceapi, video) {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const results = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
  if (results.length !== 1) return { faces: results.length, face: null, boxes: results.map((r) => r.detection.box) };
  const r = results[0];
  const ear = (eyeRatio(r.landmarks.getLeftEye()) + eyeRatio(r.landmarks.getRightEye())) / 2;
  return {
    faces: 1,
    boxes: [r.detection.box],
    face: {
      box: r.detection.box,
      score: r.detection.score,
      ear,
      yaw: yawRatio(r.landmarks),
      descriptor: Array.from(r.descriptor),
    },
  };
}

/** Average of several descriptors of the same face: steadier than a single frame. */
export function averageDescriptor(list) {
  const out = new Array(128).fill(0);
  for (const d of list) for (let i = 0; i < 128; i++) out[i] += d[i] / list.length;
  return out.map((v) => Math.round(v * 1e6) / 1e6);
}

export const CHALLENGES = [
  { id: "blink", key: "face.chBlink" },
  { id: "turn", key: "face.chTurn" },
];

/**
 * Tracks a liveness challenge across frames.
 * - blink: the eyes must close (ratio < 0.21) and open again (> 0.26) twice.
 * - turn: the head must turn clearly to one side (yaw 0.5 ± 0.14) and come back to the centre.
 */
export function createChallengeTracker(type) {
  let blinks = 0;
  let eyesClosed = false;
  let turned = false;
  let done = false;
  return {
    update(face) {
      if (done || !face) return done;
      if (type === "blink") {
        if (!eyesClosed && face.ear < 0.21) eyesClosed = true;
        else if (eyesClosed && face.ear > 0.26) { eyesClosed = false; blinks++; }
        if (blinks >= 2) done = true;
      } else {
        if (!turned && Math.abs(face.yaw - 0.5) > 0.14) turned = true;
        else if (turned && Math.abs(face.yaw - 0.5) < 0.07) done = true;
      }
      return done;
    },
    progress() {
      if (done) return 1;
      return type === "blink" ? blinks / 2 : turned ? 0.5 : 0;
    },
    get done() { return done; },
  };
}
