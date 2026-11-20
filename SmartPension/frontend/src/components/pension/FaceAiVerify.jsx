import { useCallback, useEffect, useRef, useState } from "react";
import { BrainCircuit, Camera, CheckCircle2, Loader2, RotateCcw, ScanFace, XCircle } from "lucide-react";
import { lifeApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useI18n } from "../../context/PreferencesContext";
import { Alert, Button } from "../ui";
import { analyzeFrame, averageDescriptor, CHALLENGES, createChallengeTracker, loadFaceAi } from "../../lib/faceAi";

const CHALLENGE_MS = 20000;
const FRAMES_TO_AVERAGE = 3;

/**
 * AI life verification: face detection + liveness challenge + face descriptor in the browser (face-api.js);
 * the server compares the descriptor with the enrolled face and approves or rejects.
 */
export default function FaceAiVerify({ enrolled, threshold, onDone }) {
  const { t } = useI18n();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceapiRef = useRef(null);
  const loopRef = useRef(false);
  const phaseRef = useRef("idle");
  const trackerRef = useRef(null);
  const samplesRef = useRef([]);
  const deadlineRef = useRef(0);

  const [phase, setPhaseState] = useState("idle"); // idle | loading | live | challenge | capturing | submitting | result | error
  const [hint, setHint] = useState("face.noFace");
  const [challenge, setChallenge] = useState(null);
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState(4 / 3);

  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p); };

  const stopCamera = useCallback(() => {
    loopRef.current = false;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const draw = (boxes, ok) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(3, canvas.width / 200);
    ctx.strokeStyle = ok ? "#168568" : "#D9AA55";
    for (const b of boxes) {
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.width, b.height, 16) : ctx.rect(b.x, b.y, b.width, b.height);
      ctx.stroke();
    }
  };

  const capturePhoto = () => new Promise((resolve) => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
  });

  const submit = async (descriptor, challengeId) => {
    setPhase("submitting");
    try {
      const photo = await capturePhoto();
      stopCamera();
      const res = await lifeApi.submitFace(photo, { descriptor, challenge: challengeId, livenessPassed: true });
      setResult(res);
      setPhase("result");
      onDone?.(res);
    } catch (e) {
      stopCamera();
      setError(getErrorMessage(e));
      setPhase("error");
    }
  };

  const loop = async () => {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    while (loopRef.current && video && faceapi) {
      if (video.readyState >= 2) {
        let frame;
        try { frame = await analyzeFrame(faceapi, video); } catch { frame = { faces: 0, face: null, boxes: [] }; }
        if (!loopRef.current) break;
        const face = frame.face;
        const big = face && face.box.width >= video.videoWidth * 0.22;
        const ok = !!face && big;
        draw(frame.boxes, ok);
        setHint(frame.faces === 0 ? "face.noFace" : frame.faces > 1 ? "face.multiple" : !big ? "face.closer" : "face.ready");

        const p = phaseRef.current;
        if (p === "challenge") {
          const left = deadlineRef.current - Date.now();
          setSecondsLeft(Math.max(0, Math.ceil(left / 1000)));
          if (left <= 0) {
            stopCamera();
            setError(t("face.timeout"));
            setPhase("error");
            break;
          }
          if (ok && trackerRef.current.update(face)) {
            samplesRef.current = [];
            setPhase("capturing");
          }
          setProgress(trackerRef.current.progress());
        } else if (p === "capturing" && Date.now() > deadlineRef.current + 8000) {
          stopCamera();
          setError(t("face.timeout"));
          setPhase("error");
          break;
        } else if (p === "capturing" && ok && Math.abs(face.yaw - 0.5) < 0.1 && face.ear > 0.22) {
          // Facing the camera with open eyes: collect a few descriptors and average them.
          samplesRef.current.push(face.descriptor);
          if (samplesRef.current.length >= FRAMES_TO_AVERAGE) {
            loopRef.current = false;
            await submit(averageDescriptor(samplesRef.current), trackerRef.current.type);
            break;
          }
        }
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  };

  const start = async () => {
    setError("");
    setResult(null);
    setPhase("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("life.cameraError"));
      const [faceapi, stream] = await Promise.all([
        loadFaceAi(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
      ]);
      faceapiRef.current = faceapi;
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (video.videoWidth) setAspect(video.videoWidth / video.videoHeight);
      setPhase("live");
      loopRef.current = true;
      loop();
    } catch (e) {
      stopCamera();
      setError(e?.name === "NotAllowedError" ? t("life.cameraError") : e?.message || t("face.loadError"));
      setPhase("error");
    }
  };

  const beginChallenge = () => {
    const ch = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    const tracker = createChallengeTracker(ch.id);
    tracker.type = ch.id;
    trackerRef.current = tracker;
    setChallenge(ch);
    setProgress(0);
    deadlineRef.current = Date.now() + CHALLENGE_MS;
    setSecondsLeft(CHALLENGE_MS / 1000);
    setPhase("challenge");
  };

  const reset = () => { stopCamera(); setPhase("idle"); setResult(null); setError(""); };

  const cameraOn = ["live", "challenge", "capturing", "submitting"].includes(phase);
  const ok = result && (result.outcome === "Verified" || result.outcome === "Enrolled");

  return (
    <div className="stack">
      <Alert tone="info" icon={BrainCircuit} title={enrolled ? t("face.verifyTitle") : t("face.enrollTitle")}>
        {enrolled ? t("face.verifyIntro", { limit: threshold?.toFixed(2) ?? "0.50" }) : t("face.enrollIntro")}
      </Alert>

      <div className="camera-frame" style={{ aspectRatio: aspect }}>
        <video ref={videoRef} playsInline muted aria-label={t("face.preview")} style={{ display: cameraOn ? "block" : "none" }} />
        <canvas ref={canvasRef} className="camera-overlay" aria-hidden style={{ display: cameraOn ? "block" : "none" }} />
        {!cameraOn && (
          <div className="camera-placeholder">
            <div className="stack-sm" style={{ alignItems: "center" }}>
              {phase === "loading" ? <Loader2 size={40} className="spin" /> : <ScanFace size={48} />}
              <span>{phase === "loading" ? t("face.loading") : t("life.cameraOff")}</span>
            </div>
          </div>
        )}
        {cameraOn && (
          <div className="camera-status" role="status" aria-live="polite">
            {phase === "live" && t(hint)}
            {phase === "challenge" && `${t(challenge.key)} · ${secondsLeft}s`}
            {phase === "capturing" && t("face.lookStraight")}
            {phase === "submitting" && t("face.checking")}
          </div>
        )}
      </div>

      {phase === "challenge" && (
        <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress * 100}%`, background: "var(--c-accent)" }} />
        </div>
      )}

      {phase === "result" && result && (
        <Alert tone={ok ? "success" : "danger"} icon={ok ? CheckCircle2 : XCircle} title={t(`face.out.${result.outcome}`)}>
          <div>{result.message}</div>
          {result.distance != null && (
            <div className="mt-2 mono">
              {t("face.distance", { d: result.distance.toFixed(3), limit: result.threshold.toFixed(2) })}
            </div>
          )}
        </Alert>
      )}
      {phase === "error" && error && <Alert tone="danger">{error}</Alert>}

      <div className="row">
        {(phase === "idle" || phase === "error" || phase === "result") && (
          <Button size="lg" icon={phase === "idle" ? Camera : RotateCcw} onClick={start}>
            {phase === "idle" ? t("face.start") : t("face.again")}
          </Button>
        )}
        {phase === "loading" && <Button size="lg" loading>{t("face.loading")}</Button>}
        {phase === "live" && (
          <Button size="lg" variant="secondary" icon={ScanFace} onClick={beginChallenge} disabled={hint !== "face.ready"}>
            {enrolled ? t("face.verifyBtn") : t("face.enrollBtn")}
          </Button>
        )}
        {cameraOn && phase !== "submitting" && <Button variant="ghost" onClick={reset}>{t("common.cancel")}</Button>}
      </div>
      <p className="text-xs text-muted">{t("face.privacy")}</p>
    </div>
  );
}
