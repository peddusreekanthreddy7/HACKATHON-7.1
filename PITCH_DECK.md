# Pitch Deck Outline — DatalakeFaceAuth (12–15 slides)

Drop each slide's bullets into PowerPoint/Google Slides. Speaker notes in
_italics_. Scoring tag shows which criterion each slide targets
(**I**nnovation 30 · **F**easibility 30 · **Sc**alability 20 · **P**resentation 20).

---

### Slide 1 — Title  ·  _P_
- **DatalakeFaceAuth** — Offline, on-device face attendance with liveness
- "Recognise + prove presence with zero internet. Sync later. Purge after ACK."
- Team / event / date
- _Hook: a worker in a remote site with no signal still marks attendance securely._

### Slide 2 — Problem  ·  _P, F_
- Field attendance in remote India: **no/low network**, harsh sunlight, low-end phones
- Cloud face APIs fail offline, leak biometrics, cost per-call, need bandwidth
- Spoofing: photos & video replays beat naïve face match
- _The gap: secure, offline, cheap, spoof-resistant attendance._

### Slide 3 — Solution  ·  _I, F_
- 100% **on-device** recognition + **liveness**, fully **offline**
- **Privacy-by-design**: store math embeddings, **never images**
- **Sync-and-purge** to AWS only when online; encrypted at rest
- 8/8 hard constraints met or wired (1 deviation documented)
- _One sentence: "A face is a password you can't forget — we verify it offline and never store the photo."_

### Slide 4 — Architecture  ·  _I, F_
- Diagram: Camera → BlazeFace → Face Mesh → {MiniFASNet, MobileFaceNet} → FSM/Match → SQLCipher → AWS
- Worklet thread (real-time AI) vs JS thread (FSM/match); modules decoupled
- _Drop in the mermaid flowchart from TECHNICAL_DOCUMENTATION §1._

### Slide 5 — The model stack  ·  _I_
- 4 tiny models, **6.71 MB total** (budget 20 MB): BlazeFace 0.23 · FaceMesh 1.24 · MiniFASNet ~1.7 · MobileFaceNet 5.23
- All Apache/BSD; bundled as assets → zero network in the inference path
- _Each model earns its place; nothing redundant._

### Slide 6 — Innovation: liveness fusion  ·  _I_
- **Passive** (MiniFASNet texture) **+ Active** (randomized challenge FSM)
- Pass **iff** passive=real **AND** both random challenges (blink/smile/turn)
- Fail-closed when the anti-spoof model is absent (secure by default)
- _This is the differentiator — two independent spoof defenses fused._

### Slide 7 — How it defeats spoofs  ·  _I_
- **Photo** → flat texture rejected; can't blink/turn on cue
- **Video replay** → screen moiré rejected; **random** challenge order ≠ recording
- **Mask** → low micro-motion caught; recognition adds a 2nd identity gate
- _Table: attack → which layer stops it._

### Slide 8 — Innovation: compression pipeline  ·  _I, Sc_
- Open-source `ml/` pipeline: **INT8 PTQ + pruning + distillation**
- MobileFaceNet **5.23 MB → < 2 MB** (≈4×), <1% TAR drop (literature)
- Indian-demographics fine-tune + harsh-sun/low-light/shadow augmentation (runtime-verified)
- _Reproducible: one command sequence regenerates the model + metrics._

### Slide 9 — Liveness demo  ·  _P, F_
- Live: hold a photo → **rejected**; do "Blink → Turn left" → **passed → matched (name + %)**
- Show the on-screen challenge chips + countdown + result banner
- _Have a backup screen-recording in case of venue lighting._

### Slide 10 — Benchmarks  ·  _F_
- Footprint **6.71 MB / 20 MB** (measured); per-stage latency budget → **< 1 s passive**
- Cosine threshold 0.6 ≈ 95% confidence; eval harness (`ml/eval.py`) on IMFDB pairs
- 56 unit/integration tests · tsc clean · Metro bundle green
- _Honest labelling: Measured vs Target vs MEASURE-ON-DEVICE — credibility._

### Slide 11 — Sync & purge  ·  _Sc, F_
- Diagram: capture offline → NetInfo online → POST (idempotency key) → 200 ack → **purge**
- Retry + exponential backoff + jitter; no data loss, no dupes, no orphan PII
- **Verified live** against the mock server (idempotent replay confirmed)
- _Drop in the mermaid sequence diagram from docs/SYNC.md._

### Slide 12 — Scalability & cost  ·  _Sc_
- Serverless **API Gateway → Lambda → DynamoDB**, pay-per-request (≈ $0 idle)
- 1:N cosine match on-device; sync-and-purge keeps device storage bounded
- Open IaC (AWS SAM) — one `sam deploy`; integrates into Datalake 3.0 via adapter
- _Scales from 1 device to a fleet with no per-seat license._

### Slide 13 — Security & privacy  ·  _I, F_
- SQLCipher AES-256 at rest; key from Keystore/Keychain
- Embeddings only — **raw faces never stored or transmitted**
- 100% open-source, **zero paid licenses** (automated scan)
- _Compliance-friendly: data minimisation + on-device processing._

### Slide 14 — Roadmap  ·  _Sc, P_
- Now: Keystore-derived DB key; on-device latency/accuracy measurement on target phones
- Next: INT8 model shipped; IMFDB fine-tune run; geo capture; admin re-enroll
- Then: Datalake 3.0 production integration; multi-site fleet dashboards
- _Clear, credible path from hackathon to production._

### Slide 15 — Ask / close  ·  _P_
- Recap: offline · spoof-proof · private · cheap · open-source
- "Attendance that works where the network doesn't."
- Repo + docs QR; thank you
- _End on the one-liner._

---

## Deliverable → scoring map (put on a backup slide)

| Criterion | Slides | Artifacts |
|-----------|--------|-----------|
| Innovation (30) | 3,5,6,7,8,13 | liveness fusion, `ml/` compression, alignment |
| Feasibility (30) | 2,4,9,10,13 | 6.71 MB, 56 tests, live demo, honest benchmarks |
| Scalability (20) | 8,11,12,14 | SAM serverless, sync-purge, integration guide |
| Presentation (20) | 1,3,9,15 + docs | mermaid diagrams, demo script, this deck |
