import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, ImageUp, RotateCcw, ScanFace, Send } from "lucide-react";
import { lifeApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useI18n } from "../../context/PreferencesContext";
import { useToast } from "../../context/ToastContext";
import { Alert, Button, Card, DataTable, ErrorState, PageHeader, Skeleton, StatusBadge } from "../../components/ui";
import FaceAiVerify from "../../components/pension/FaceAiVerify";
import { MethodBadge } from "../../components/pension/PensionWidgets";

const MAX_BYTES = 5 * 1024 * 1024;

function CameraCapture({ disabled, onSubmitted }) {
  const { t } = useI18n();
  const toast = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [state, setState] = useState("idle"); // idle | starting | live | captured | error
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [submitting, setSubmitting] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  useEffect(() => () => { stop(); }, []);
  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url); }, [photo]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setState("error"); return; }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      streamRef.current = stream;
      setPhoto(null);
      setState("live");
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } });
    } catch {
      setState("error");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // un-mirror so the saved image matches what the user saw
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setPhoto({ blob, url: URL.createObjectURL(blob) });
      setState("captured");
      stop();
    }, "image/jpeg", 0.9);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("JPG, PNG or WEBP only."); return; }
    if (file.size > MAX_BYTES) { toast.error(t("life.fileTooBig")); return; }
    stop();
    setPhoto({ blob: file, url: URL.createObjectURL(file) });
    setState("captured");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await lifeApi.submit(photo.blob);
      toast.success(t("life.submitted"));
      setPhoto(null);
      setState("idle");
      onSubmitted();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stack">
      <div className="camera-frame">
        {state === "live" && <video ref={videoRef} playsInline muted aria-label="Camera preview" />}
        {state === "captured" && photo && <img src={photo.url} alt="Captured photo preview" />}
        {(state === "live") && <div className="camera-guide" aria-hidden><div className="camera-guide__oval" /></div>}
        {(state === "idle" || state === "starting" || state === "error") && (
          <div className="camera-placeholder">
            <div className="stack-sm" style={{ alignItems: "center" }}>
              {state === "error" ? <CameraOff size={40} /> : <ScanFace size={48} />}
              <span>{state === "error" ? t("life.cameraError") : t("life.cameraOff")}</span>
            </div>
          </div>
        )}
      </div>

      <div className="row">
        {(state === "idle" || state === "error" || state === "starting") && (
          <Button icon={Camera} onClick={start} loading={state === "starting"} disabled={disabled} size="lg">{t("life.startCamera")}</Button>
        )}
        {state === "live" && <Button icon={Camera} onClick={capture} size="lg" variant="secondary">{t("life.capture")}</Button>}
        {state === "captured" && (
          <>
            <Button variant="outline" icon={RotateCcw} onClick={start} disabled={submitting}>{t("life.retake")}</Button>
            <Button variant="secondary" icon={Send} onClick={submit} loading={submitting} size="lg">{t("life.submit")}</Button>
          </>
        )}
        <Button variant="ghost" icon={ImageUp} onClick={() => fileRef.current?.click()} disabled={disabled || submitting}>{t("life.upload")}</Button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
      </div>
    </div>
  );
}

function PhotoButton({ id }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (url) return <img src={url} alt="Submitted verification" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />;
  return (
    <Button variant="ghost" size="sm" loading={loading} onClick={async () => {
      setLoading(true);
      try { setUrl(await lifeApi.photoUrl(id)); } catch { /* ignore */ } finally { setLoading(false); }
    }}>{t("common.view")}</Button>
  );
}

export default function LifeVerificationPage() {
  const { t, formatDate, formatDateTime } = useI18n();
  const { data, loading, error, reload } = useApi(() => lifeApi.status(), []);
  const [manual, setManual] = useState(false);
  const pending = data?.state === "Pending";

  const columns = [
    { key: "submittedAt", header: t("common.date"), render: (r) => formatDateTime(r.submittedAt) },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} /> },
    { key: "method", header: t("face.methodCol"), render: (r) => <MethodBadge method={r.method} /> },
    { key: "matchDistance", header: t("face.distanceCol"), align: "right", render: (r) => (r.matchDistance != null ? r.matchDistance.toFixed(3) : "—") },
    { key: "validUntil", header: t("dash.validUntil", { date: "" }).trim(), render: (r) => formatDate(r.validUntil) },
    { key: "reason", header: t("common.reason"), render: (r) => r.rejectionReason || "—" },
    { key: "photo", header: "", render: (r) => <PhotoButton id={r.id} /> },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title={t("life.title")} subtitle={t("life.sub")} />
      <Alert tone="demo" title={t("face.demoTitle")}>{t("face.demoNote")}</Alert>

      {error ? <Card><ErrorState error={error} onRetry={reload} /></Card> : (
        <div className="grid grid-main">
          <div className="stack-lg">
            <Card title={t("face.title")}>
              {loading && !data ? <Skeleton height={320} /> : (
                <FaceAiVerify enrolled={data.faceEnrolled} threshold={data.faceMatchThreshold} onDone={reload} />
              )}
            </Card>
            <Card
              title={t("face.manualTitle")}
              subtitle={t("life.notice")}
              actions={!manual && <Button variant="outline" size="sm" onClick={() => setManual(true)}>{t("face.manualOpen")}</Button>}
            >
              {!manual ? <p className="text-sm text-muted">{t("face.manualHint")}</p>
                : pending ? <Alert tone="warning" icon={CheckCircle2}>{t("life.pendingMsg")}</Alert>
                : <CameraCapture disabled={loading} onSubmitted={reload} />}
            </Card>
          </div>
          <div className="stack-lg">
            <Card title={t("life.current")}>
              {loading && !data ? <Skeleton height={60} /> : (
                <div className="stack-sm">
                  <StatusBadge status={data.state === "Verified" ? "Verified" : data.state} />
                  {data.validUntil && <div className="text-muted">{t("dash.validUntil", { date: formatDate(data.validUntil) })}</div>}
                  <div className="text-sm">{data.faceEnrolled ? t("face.enrolledOn", { date: formatDate(data.faceEnrolledAt) }) : t("face.notEnrolled")}</div>
                  {data.latest?.status === "Rejected" && data.latest.rejectionReason && <Alert tone="danger">{data.latest.rejectionReason}</Alert>}
                </div>
              )}
            </Card>
            <Card title={t("life.tips")}>
              <ol style={{ margin: 0, paddingLeft: 20 }} className="stack-sm">
                {["life.tip1", "life.tip2", "life.tip3", "life.tip4"].map((k) => <li key={k}>{t(k)}</li>)}
              </ol>
            </Card>
          </div>
        </div>
      )}

      <Card title={t("life.history")} flush>
        <DataTable columns={columns} rows={data?.history} loading={loading} emptyTitle={t("life.noHistory")} emptyIcon={ScanFace} />
      </Card>
    </div>
  );
}
