// Generates FaceAuth_Presentation.pptx — clean 15-slide deck, honest measured numbers.
// Run: node scripts/generate_pptx.js
const pptxgen = require("pptxgenjs");
const path = require("path");

const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.3" x 7.5"
p.author = "DatalakeFaceAuth Team";
p.title = "FaceAuth — Offline Facial Recognition & Liveness";

const TEAL = "007B7F", TEALD = "004F52", LIGHT = "E3F3F3", CARD = "F4FAFA";
const DARK = "1A2526", GRAY = "5A6B6B", GREEN = "1E8E4E", WHITE = "FFFFFF";
const HF = "Trebuchet MS", BF = "Calibri";
const W = 13.3, H = 7.5, MX = 0.7;
const shadow = () => ({ type: "outer", color: "000000", blur: 5, offset: 2, angle: 135, opacity: 0.12 });

function title(s, t, sub) {
  s.addText(t, { x: MX, y: 0.42, w: W - 2 * MX, h: 0.7, fontSize: 30, bold: true, color: TEAL, fontFace: HF, margin: 0 });
  if (sub) s.addText(sub, { x: MX, y: 1.12, w: W - 2 * MX, h: 0.4, fontSize: 14, color: GRAY, fontFace: BF, margin: 0 });
}
function card(s, x, y, w, h, fill, line) {
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill || CARD }, line: { color: line || "D6E8E8", width: 1 }, rectRadius: 0.09, shadow: shadow() });
}
function cardTitle(s, x, y, w, t) {
  s.addText(t, { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.45, fontSize: 16, bold: true, color: TEALD, fontFace: HF, margin: 0 });
}
function lines(s, x, y, w, h, arr, sz) {
  s.addText(arr.map((t, i) => ({ text: t, options: { breakLine: true, color: DARK, fontSize: sz || 13 } })),
    { x, y, w, h, fontFace: BF, margin: 0, valign: "top", paraSpaceAfter: 4 });
}
function bullets(s, x, y, w, h, arr, sz) {
  s.addText(arr.map((t) => ({ text: t, options: { bullet: { code: "2022", indent: 14 }, breakLine: true, color: DARK, fontSize: sz || 13 } })),
    { x, y, w, h, fontFace: BF, margin: 0, valign: "top", paraSpaceAfter: 5 });
}
function footer(s, n) {
  s.addText("FaceAuth  ·  NHAI Hackathon 7.0", { x: MX, y: H - 0.42, w: 6, h: 0.3, fontSize: 9, color: "AAB6B6", fontFace: BF, margin: 0 });
  s.addText(`${n} / 15`, { x: W - 1.6, y: H - 0.42, w: 0.9, h: 0.3, fontSize: 9, color: "AAB6B6", align: "right", fontFace: BF, margin: 0 });
}

// ── Slide 1 — Title (dark) ──
let s = p.addSlide(); s.background = { color: TEALD };
s.addText("FaceAuth", { x: 0, y: 2.0, w: W, h: 1.3, fontSize: 64, bold: true, color: WHITE, align: "center", fontFace: HF });
s.addText("Offline Facial Recognition & Liveness Detection for Remote Field Personnel",
  { x: 1, y: 3.35, w: W - 2, h: 0.6, fontSize: 18, color: "BFE6E6", align: "center", fontFace: BF });
s.addText("Secure   ·   Offline   ·   Accurate   ·   Open-Source",
  { x: 1, y: 4.2, w: W - 2, h: 0.4, fontSize: 14, color: WHITE, align: "center", charSpacing: 2, fontFace: BF });
s.addText("NHAI Hackathon 7.0   |   github.com/peddusreekanthreddy7/HACKATHON-7.1",
  { x: 1, y: 6.4, w: W - 2, h: 0.4, fontSize: 12, color: "9FD4D4", align: "center", fontFace: BF });

// ── Slide 2 — Problem ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "The Problem");
card(s, MX, 1.5, W - 2 * MX, 1.7, LIGHT, TEAL);
s.addText('"Authenticate field personnel by face + liveness on standard mid-range phones — with NO internet — while keeping the AI model lightweight and React-Native-integrable."',
  { x: MX + 0.3, y: 1.7, w: W - 2 * MX - 0.6, h: 1.3, fontSize: 17, italic: true, color: TEALD, fontFace: BF, valign: "middle", margin: 0 });
s.addText("Pain points", { x: MX, y: 3.5, w: 6, h: 0.4, fontSize: 16, bold: true, color: TEALD, fontFace: HF, margin: 0 });
bullets(s, MX, 4.0, W - 2 * MX, 2.6, [
  "Remote sites with zero network connectivity",
  "Attendance fraud via photos & video-replay attacks",
  "Need sub-1-second response on 3 GB-RAM devices",
  "No GPU acceleration available on field hardware",
], 16);
footer(s, 2);

// ── Slide 3 — Solution ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "The Solution — 3 Pillars");
const cols = [
  ["Lightweight Edge AI", ["6.5 MB total model stack", "67% under the 20 MB cap", "All models bundled — no", "download, runs on-device"]],
  ["Active Liveness", ["Random challenge each scan", "Blink / Smile / Turn head", "Defeats photo & screen", "replay spoofing"]],
  ["Offline-First", ["Works with zero network", "SQLCipher-encrypted store", "Sync to AWS when online,", "purge after server ACK"]],
];
let cw = (W - 2 * MX - 2 * 0.4) / 3;
cols.forEach((c, i) => {
  let x = MX + i * (cw + 0.4);
  card(s, x, 1.7, cw, 4.4, CARD);
  s.addShape(p.shapes.RECTANGLE, { x: x, y: 1.7, w: cw, h: 0.7, fill: { color: TEAL } });
  s.addText(c[0], { x: x, y: 1.78, w: cw, h: 0.55, fontSize: 16, bold: true, color: WHITE, align: "center", fontFace: HF, margin: 0 });
  lines(s, x + 0.3, 2.7, cw - 0.6, 3.2, c[1], 14);
});
footer(s, 3);

// ── Slide 4 — Architecture ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "System Architecture", "Camera → on-device AI pipeline → encrypted store → AWS sync");
const stages = ["Camera\nfeed", "BlazeFace\ndetect", "Face Mesh\n468 pts", "Liveness\nFSM", "MobileFaceNet\nembed 192-D", "Cosine\nmatch 1:N", "SQLCipher\nstore", "AWS\nsync+purge"];
let n = stages.length, gap = 0.2, bw = (W - 2 * MX - (n - 1) * gap) / n;
stages.forEach((st, i) => {
  let x = MX + i * (bw + gap);
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: 2.7, w: bw, h: 1.5, fill: { color: i === 3 ? TEALD : TEAL }, rectRadius: 0.06, shadow: shadow() });
  s.addText(st, { x, y: 2.7, w: bw, h: 1.5, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: BF, margin: 2 });
  if (i < n - 1) s.addText("›", { x: x + bw, y: 2.7, w: gap, h: 1.5, fontSize: 18, bold: true, color: TEAL, align: "center", valign: "middle", margin: 0 });
});
s.addText("Offline: detect → liveness → embed → match → store locally (encrypted).    Online: batch-sync to AWS → ACK → purge local row.",
  { x: MX, y: 4.7, w: W - 2 * MX, h: 0.5, fontSize: 13, color: GRAY, italic: true, fontFace: BF, margin: 0 });
footer(s, 4);

// ── Slide 5 — Model stack table ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "AI Model Stack — 100% Open-Source");
const th = { fill: { color: TEAL }, color: WHITE, bold: true, fontSize: 14, fontFace: HF };
const td = (t, b) => ({ text: t, options: { fontSize: 13, color: DARK, bold: !!b, fontFace: BF } });
s.addTable([
  [{ text: "Model", options: th }, { text: "Size", options: th }, { text: "Purpose", options: th }, { text: "License", options: th }],
  [td("BlazeFace"), td("0.23 MB"), td("Face detection"), td("Apache-2.0")],
  [td("Face Mesh"), td("1.24 MB"), td("468 landmarks (EAR/yaw)"), td("Apache-2.0")],
  [td("MobileFaceNet"), td("5.23 MB"), td("192-D face embedding"), td("BSD-3")],
  [td("MiniFASNet"), td("placeholder"), td("Passive anti-spoof (optional)"), td("Apache-2.0")],
  [td("TOTAL", 1), td("6.5 MB", 1), td("Full on-device pipeline", 1), td("All permissive", 1)],
], { x: MX, y: 1.7, w: W - 2 * MX, colW: [2.4, 1.8, 5.3, 2.4], rowH: 0.5, border: { type: "solid", color: "D6E8E8", pt: 1 }, fill: { color: CARD }, valign: "middle", align: "left" });
s.addText("6.5 MB  vs  20 MB budget  =  67% under the cap", { x: MX, y: 5.6, w: W - 2 * MX, h: 0.5, fontSize: 18, bold: true, color: GREEN, fontFace: HF, margin: 0 });
footer(s, 5);

// ── Slide 6 — Liveness ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Liveness Detection — Anti-Spoofing");
let hw = (W - 2 * MX - 0.4) / 2;
card(s, MX, 1.7, hw, 3.3, CARD, TEAL);
cardTitle(s, MX, 1.7, hw, "Active challenge–response  ✓ working");
bullets(s, MX + 0.25, 2.4, hw - 0.5, 2.5, [
  "Randomised challenge every session",
  "Blink — Eye-Aspect-Ratio",
  "Smile — Mouth-Aspect-Ratio",
  "Turn head — nose↔chin yaw (glasses-robust)",
  "8 s timeout per challenge",
], 13);
card(s, MX + hw + 0.4, 1.7, hw, 3.3, CARD);
cardTitle(s, MX + hw + 0.4, 1.7, hw, "Passive texture gate (MiniFASNet)");
bullets(s, MX + hw + 0.65, 2.4, hw - 0.5, 2.5, [
  "Real-skin vs printed/screen texture",
  "Ships as a pluggable placeholder",
  "Graceful degradation: if absent, runs",
  "active-only — authentication NOT blocked",
], 13);
s.addText("A static photo or phone screen cannot blink, smile, or turn — so active challenges block attendance fraud on their own.",
  { x: MX, y: 5.3, w: W - 2 * MX, h: 0.6, fontSize: 14, italic: true, color: TEALD, fontFace: BF, margin: 0 });
footer(s, 6);

// ── Slide 7 — Footprint ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Model Footprint & Compression");
card(s, MX, 1.8, 4.2, 3.6, TEALD);
s.addText("6.5 MB", { x: MX, y: 2.4, w: 4.2, h: 1.1, fontSize: 60, bold: true, color: WHITE, align: "center", fontFace: HF, margin: 0 });
s.addText("of 20 MB budget", { x: MX, y: 3.6, w: 4.2, h: 0.5, fontSize: 16, color: "BFE6E6", align: "center", fontFace: BF, margin: 0 });
s.addText("67% under the cap", { x: MX, y: 4.2, w: 4.2, h: 0.6, fontSize: 20, bold: true, color: WHITE, align: "center", fontFace: HF, margin: 0 });
const t2 = { fill: { color: TEAL }, color: WHITE, bold: true, fontSize: 13, fontFace: HF };
s.addTable([
  [{ text: "Model", options: t2 }, { text: "Shipped", options: t2 }, { text: "INT8 path", options: t2 }],
  [td("MobileFaceNet"), td("5.23 MB FP32"), td("< 2 MB")],
  [td("3 other models"), td("1.5 MB"), td("—")],
  [td("Total stack", 1), td("6.5 MB", 1), td("documented", 1)],
], { x: MX + 4.6, y: 1.8, w: W - 2 * MX - 4.6, colW: [3.0, 2.6, 2.4], rowH: 0.55, border: { type: "solid", color: "D6E8E8", pt: 1 }, fill: { color: CARD }, valign: "middle" });
s.addText("Ships FP32 (already 67% under budget). INT8 quantisation pipeline (ml/quantize.py) projects < 2 MB — documented & reproducible in COMPRESSION_REPORT.md.",
  { x: MX + 4.6, y: 4.4, w: W - 2 * MX - 4.6, h: 1.0, fontSize: 12, italic: true, color: GRAY, fontFace: BF, margin: 0 });
footer(s, 7);

// ── Slide 8 — Offline storage ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Offline-First, Privacy-by-Design Storage");
card(s, MX, 1.7, hw, 3.6, CARD, TEAL); cardTitle(s, MX, 1.7, hw, "Encrypted local store");
bullets(s, MX + 0.25, 2.4, hw - 0.5, 2.7, [
  "SQLite + SQLCipher — full AES-256 at rest",
  "Stores math EMBEDDINGS, never face images",
  "Attendance: id, time, GPS, liveness, score",
  "Fully functional in zero-network zones",
], 14);
card(s, MX + hw + 0.4, 1.7, hw, 3.6, CARD); cardTitle(s, MX + hw + 0.4, 1.7, hw, "Why it matters");
bullets(s, MX + hw + 0.65, 2.4, hw - 0.5, 2.7, [
  "No raw biometric image ever leaves device",
  "Embedding can't be reversed to a photo",
  "Encryption key is device-bound",
  "Privacy + offline = field-ready & compliant",
], 14);
footer(s, 8);

// ── Slide 9 — Sync & purge ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Sync & Purge — Zero Data Loss");
const steps = [
  "Offline → records stored locally, encrypted",
  "Network detected → sync auto-triggers",
  "Batch upload with idempotency keys",
  "AWS: API Gateway → Lambda → DynamoDB",
  "Server returns ACK per record",
  "ACK received → local row purged immediately",
];
steps.forEach((t, i) => {
  let y = 1.7 + i * 0.72;
  s.addShape(p.shapes.OVAL, { x: MX, y, w: 0.5, h: 0.5, fill: { color: TEAL } });
  s.addText(String(i + 1), { x: MX, y, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
  s.addText(t, { x: MX + 0.75, y, w: W - 2 * MX - 0.75, h: 0.5, fontSize: 15, color: DARK, valign: "middle", fontFace: BF, margin: 0 });
});
s.addText("Retry: exponential backoff + jitter  ·  idempotency prevents duplicates  ·  never purge before ACK  ·  storage stays bounded",
  { x: MX, y: 6.1, w: W - 2 * MX, h: 0.5, fontSize: 12, italic: true, color: GRAY, fontFace: BF, margin: 0 });
footer(s, 9);

// ── Slide 10 — Security ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Security Architecture");
const sec = [
  ["AES-256 at rest", "Full SQLCipher DB encryption"],
  ["Embeddings only", "Raw face images never stored/sent"],
  ["Graceful-degrade liveness", "Active-only fallback, never blocks auth"],
  ["Idempotency keys", "Prevent replayed sync uploads"],
  ["Device binding", "Device id in every record"],
  ["Serverless AWS SAM", "No server to breach, no idle cost"],
];
let gw = (W - 2 * MX - 2 * 0.4) / 3, gh = 1.9;
sec.forEach((c, i) => {
  let x = MX + (i % 3) * (gw + 0.4), y = 1.7 + Math.floor(i / 3) * (gh + 0.4);
  card(s, x, y, gw, gh, CARD);
  s.addText(c[0], { x: x + 0.25, y: y + 0.25, w: gw - 0.5, h: 0.5, fontSize: 15, bold: true, color: TEALD, fontFace: HF, margin: 0 });
  s.addText(c[1], { x: x + 0.25, y: y + 0.85, w: gw - 0.5, h: 0.9, fontSize: 13, color: DARK, fontFace: BF, margin: 0, valign: "top" });
});
footer(s, 10);

// ── Slide 11 — Benchmarks (the killer slide) ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Performance — Every Number Measured", "On a real device: vivo I2403, Android 16");
const tb = { fill: { color: TEAL }, color: WHITE, bold: true, fontSize: 13, fontFace: HF };
const ok = (t) => ({ text: t, options: { fontSize: 13, color: GREEN, bold: true, fontFace: BF } });
s.addTable([
  [{ text: "Constraint", options: tb }, { text: "Required", options: tb }, { text: "Measured", options: tb }, { text: "", options: tb }],
  [td("Model footprint"), td("< 20 MB"), td("6.5 MB", 1), ok("PASS")],
  [td("Recognition end-to-end"), td("< 1000 ms"), td("173–190 ms", 1), ok("PASS")],
  [td("Accuracy (LFW benchmark)"), td("> 95%"), td("96.9%", 1), ok("PASS")],
  [td("Peak RAM"), td("3 GB device"), td("518 MB → fits", 1), ok("PASS")],
  [td("Android / iOS build"), td("8.0+ / build"), td("device / CI-green", 1), ok("PASS")],
  [td("Open-source"), td("100%"), td("100% permissive", 1), ok("PASS")],
], { x: MX, y: 1.8, w: W - 2 * MX, colW: [4.0, 2.6, 3.5, 1.8], rowH: 0.5, border: { type: "solid", color: "D6E8E8", pt: 1 }, fill: { color: CARD }, valign: "middle" });
s.addText("Latency breakdown: detect 93–116 ms · landmarks 19–22 ms · align 5–6 ms · embed 47–56 ms · match 1–2 ms.   Indian-demographic 90.6% & lighting 83–95% measured separately (see PERFORMANCE_BENCHMARKS.md).",
  { x: MX, y: 5.7, w: W - 2 * MX, h: 0.8, fontSize: 11, italic: true, color: GRAY, fontFace: BF, margin: 0 });
footer(s, 11);

// ── Slide 12 — Integration ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Drop-in Integration for Datalake 3.0", "One React Native component — no changes to existing code");
card(s, MX, 1.8, 7.0, 3.6, "0E2E2F");
const code = ["import FaceAuth from './FaceAuth'", "", "<FaceAuth", "  employeeId={currentEmployeeId}", "  offlineMode={true}", "  onAuthSuccess={(r) => handle(r)}", "  onSyncComplete={(n) => log(n)}", "/>"];
s.addText(code.map((l) => ({ text: l || " ", options: { breakLine: true, color: l.includes("FaceAuth") || l.includes("import") ? "5EEAD4" : "E0F4F4", fontSize: 14 } })),
  { x: MX + 0.3, y: 2.0, w: 6.4, h: 3.2, fontFace: "Consolas", margin: 0, valign: "top" });
s.addText("Setup ≈ 30 min", { x: MX + 7.4, y: 1.9, w: 4.5, h: 0.5, fontSize: 16, bold: true, color: TEALD, fontFace: HF, margin: 0 });
bullets(s, MX + 7.4, 2.5, W - 2 * MX - 7.4, 3.0, [
  "Add 5 npm packages",
  "Configure babel.config.js",
  "Enable SQLCipher flag",
  "Mount the component",
  "Full steps in INTEGRATION_GUIDE.md",
], 14);
footer(s, 12);

// ── Slide 13 — Quality ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Engineering Quality");
const stats13 = [["56", "tests passing"], ["0", "TypeScript errors"], ["8", "test suites"]];
stats13.forEach((st, i) => {
  let x = MX + i * ((W - 2 * MX) / 3);
  s.addText(st[0], { x, y: 1.7, w: (W - 2 * MX) / 3 - 0.3, h: 1.0, fontSize: 52, bold: true, color: TEAL, align: "center", fontFace: HF, margin: 0 });
  s.addText(st[1], { x, y: 2.7, w: (W - 2 * MX) / 3 - 0.3, h: 0.5, fontSize: 15, color: GRAY, align: "center", fontFace: BF, margin: 0 });
});
card(s, MX, 3.6, W - 2 * MX, 2.6, CARD);
s.addText("Covered: BlazeFace decode · CLAHE preprocessing · EAR/MAR/yaw geometry · anti-spoof softmax · liveness FSM · Umeyama alignment · embedding cosine 1:N match · sync backoff/idempotency/retry.",
  { x: MX + 0.3, y: 3.85, w: W - 2 * MX - 0.6, h: 1.0, fontSize: 14, color: DARK, fontFace: BF, margin: 0, valign: "top" });
s.addText("Plus: tsc clean · Metro bundles · native Android build · iOS compiles in CI · verified on a real phone.",
  { x: MX + 0.3, y: 4.9, w: W - 2 * MX - 0.6, h: 1.0, fontSize: 14, bold: true, color: TEALD, fontFace: BF, margin: 0, valign: "top" });
footer(s, 13);

// ── Slide 14 — Criteria mapping ──
s = p.addSlide(); s.background = { color: WHITE }; title(s, "Mapped to the Evaluation Criteria");
const crit = [
  ["Innovation  (30)", ["4-model edge pipeline, 6.5 MB", "5-pt alignment → 96.9% LFW", "Active liveness working on device"]],
  ["Feasibility  (30)", ["173–190 ms on real phone (< 1 s)", "518 MB RAM → fits 3 GB", "iOS CI-green · 56 tests · tsc 0"]],
  ["Scalability  (20)", ["ACK-then-purge, idempotent sync", "AWS SAM serverless", "Lighting & demographics measured"]],
  ["Presentation  (20)", ["Clean documented source", "Integration + technical guides", "This deck + reproducible benchmarks"]],
];
let cgw = (W - 2 * MX - 0.4) / 2, cgh = 2.3;
crit.forEach((c, i) => {
  let x = MX + (i % 2) * (cgw + 0.4), y = 1.6 + Math.floor(i / 2) * (cgh + 0.35);
  card(s, x, y, cgw, cgh, CARD);
  s.addShape(p.shapes.RECTANGLE, { x, y, w: cgw, h: 0.6, fill: { color: TEAL } });
  s.addText(c[0], { x: x + 0.2, y: y + 0.08, w: cgw - 0.4, h: 0.45, fontSize: 16, bold: true, color: WHITE, fontFace: HF, margin: 0 });
  bullets(s, x + 0.25, y + 0.75, cgw - 0.5, cgh - 0.85, c[1], 12.5);
});
footer(s, 14);

// ── Slide 15 — Thank you (dark) ──
s = p.addSlide(); s.background = { color: TEALD };
s.addText("Thank You", { x: 0, y: 1.5, w: W, h: 1.2, fontSize: 54, bold: true, color: WHITE, align: "center", fontFace: HF });
s.addText("Secure.   Offline.   Accurate.", { x: 0, y: 2.8, w: W, h: 0.5, fontSize: 18, color: "BFE6E6", align: "center", fontFace: BF });
const fin = [["6.5 MB", "model stack"], ["190 ms", "recognition"], ["96.9%", "LFW accuracy"]];
fin.forEach((st, i) => {
  let x = 1.5 + i * 3.5;
  s.addText(st[0], { x, y: 3.9, w: 3.0, h: 0.9, fontSize: 40, bold: true, color: "5EEAD4", align: "center", fontFace: HF, margin: 0 });
  s.addText(st[1], { x, y: 4.8, w: 3.0, h: 0.4, fontSize: 13, color: "BFE6E6", align: "center", fontFace: BF, margin: 0 });
});
s.addText("github.com/peddusreekanthreddy7/HACKATHON-7.1   ·   Download APK + full source",
  { x: 0, y: 6.5, w: W, h: 0.4, fontSize: 12, color: "9FD4D4", align: "center", fontFace: BF });

const out = path.join(__dirname, "..", "FaceAuth_Presentation.pptx");
p.writeFile({ fileName: out }).then(() => console.log("PPTX created: " + out));
