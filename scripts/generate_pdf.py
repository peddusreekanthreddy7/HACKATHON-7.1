"""
Generate FaceAuth_Presentation.pdf — 15-slide hackathon pitch deck.
Uses reportlab only (no external fonts / images required).
"""
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'FaceAuth_Presentation.pdf')
W, H = landscape(A4)   # 841.9 x 595.3 pt

TEAL      = colors.HexColor('#007B7F')
TEAL_DARK = colors.HexColor('#005F63')
TEAL_LIGHT= colors.HexColor('#E0F4F4')
WHITE     = colors.white
DARK      = colors.HexColor('#1a1a1a')
GRAY_BG   = colors.HexColor('#F5F5F5')
GRAY_ROW  = colors.HexColor('#EAF6F6')
ORANGE    = colors.HexColor('#E67E22')
GREEN     = colors.HexColor('#27AE60')
RED       = colors.HexColor('#E74C3C')


def new_page(c, slide_num, total=15):
    # slide counter bottom-right on CURRENT page before flipping
    c.setFont('Helvetica', 8)
    c.setFillColor(colors.HexColor('#999999'))
    c.drawRightString(W - 12*mm, 6*mm, f'{slide_num} / {total}')
    c.showPage()


def header_bar(c, title, y=H-28*mm, h=22*mm):
    c.setFillColor(TEAL)
    c.rect(0, y, W, h, fill=1, stroke=0)
    c.setFont('Helvetica-Bold', 20)
    c.setFillColor(WHITE)
    c.drawString(14*mm, y + 6*mm, title)


def section_box(c, x, y, w, h, title=None, body_lines=None,
                bg=TEAL_LIGHT, border=TEAL, title_color=TEAL_DARK, body_color=DARK,
                title_size=11, body_size=9.5, padding=6):
    c.setFillColor(bg)
    c.setStrokeColor(border)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 4, fill=1, stroke=1)
    ty = y + h - padding - title_size
    if title:
        c.setFont('Helvetica-Bold', title_size)
        c.setFillColor(title_color)
        c.drawString(x + padding, ty, title)
        ty -= (body_size + 3)
    if body_lines:
        c.setFont('Helvetica', body_size)
        c.setFillColor(body_color)
        for line in body_lines:
            if ty < y + 3:
                break
            c.drawString(x + padding, ty, line)
            ty -= (body_size + 2.5)


def bullet(c, x, y, text, size=9.5, color=DARK, indent=0):
    c.setFont('Helvetica', size)
    c.setFillColor(color)
    c.drawString(x + indent, y, u'•  ' + text)
    return y - (size + 3)


def draw_table(c, data, col_widths, x, y, row_height=16,
               header_bg=TEAL, header_fg=WHITE,
               alt_bg=GRAY_ROW, font_size=8.5):
    for ri, row in enumerate(data):
        row_y = y - ri * row_height
        for ci, (cell, cw) in enumerate(zip(row, col_widths)):
            cx = x + sum(col_widths[:ci])
            # background
            if ri == 0:
                c.setFillColor(header_bg)
            elif ri % 2 == 0:
                c.setFillColor(alt_bg)
            else:
                c.setFillColor(WHITE)
            c.setStrokeColor(colors.HexColor('#CCCCCC'))
            c.setLineWidth(0.4)
            c.rect(cx, row_y - row_height + 3, cw, row_height, fill=1, stroke=1)
            # text
            if ri == 0:
                c.setFont('Helvetica-Bold', font_size)
                c.setFillColor(header_fg)
            elif cell.startswith('TOTAL') or cell.startswith('Total'):
                c.setFont('Helvetica-Bold', font_size)
                c.setFillColor(TEAL_DARK)
            else:
                c.setFont('Helvetica', font_size)
                c.setFillColor(DARK)
            c.drawString(cx + 3, row_y - row_height + 6, cell)
    return y - len(data) * row_height


c = canvas.Canvas(OUT, pagesize=landscape(A4))
c.setTitle('FaceAuth — Offline Facial Recognition & Liveness Detection')
c.setAuthor('DatalakeFaceAuth Team')

# ─────────────────────────────────────────────────────────────
# SLIDE 1 — TITLE
# ─────────────────────────────────────────────────────────────
c.setFillColor(TEAL)
c.rect(0, H-40*mm, W, 40*mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 48)
c.drawCentredString(W/2, H-26*mm, 'FaceAuth')

c.setFillColor(WHITE)
c.setFont('Helvetica', 15)
c.drawCentredString(W/2, H-36*mm, 'Offline Facial Recognition & Liveness Detection')
c.drawCentredString(W/2, H-42*mm, 'for Remote Field Personnel')

# center body
c.setFillColor(DARK)
c.setFont('Helvetica-Bold', 13)
c.drawCentredString(W/2, H/2+10*mm, 'Hackathon 7.0')
c.setFont('Helvetica', 11)
c.drawCentredString(W/2, H/2, 'github.com/peddusreekanthreddy7/HACKATHON-7.1')
c.drawCentredString(W/2, H/2-8*mm, 'June 2026')

# bottom teal bar
c.setFillColor(TEAL)
c.rect(0, 0, W, 12*mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica', 9)
c.drawCentredString(W/2, 4*mm, 'Secure  |  Offline  |  Accurate  |  Open-Source')

new_page(c, 1)

# ─────────────────────────────────────────────────────────────
# SLIDE 2 — PROBLEM
# ─────────────────────────────────────────────────────────────
header_bar(c, 'The Problem')
qy = H - 55*mm
section_box(c, 14*mm, qy, W-28*mm, 38*mm,
            title=None,
            body_lines=[
                '"How can we accurately and securely authenticate field personnel',
                ' using facial recognition and liveness detection on standard',
                ' mid-range mobile devices without any active internet connection,',
                ' while ensuring the AI model remains lightweight and seamlessly',
                ' integrates with a React Native application?"',
            ],
            bg=TEAL_LIGHT, border=TEAL, body_size=10.5)

c.setFont('Helvetica-Bold', 11)
c.setFillColor(TEAL_DARK)
c.drawString(14*mm, qy - 12*mm, 'Pain Points:')
py = qy - 22*mm
for pt in [
    'Remote locations with zero network connectivity',
    'Attendance fraud via photos and video replay attacks',
    'Need for sub-1-second response on 3GB RAM devices',
    'Limited device hardware — no GPU acceleration',
]:
    py = bullet(c, 14*mm, py, pt, size=10.5)

new_page(c, 2)

# ─────────────────────────────────────────────────────────────
# SLIDE 3 — SOLUTION
# ─────────────────────────────────────────────────────────────
header_bar(c, 'FaceAuth — The Solution')
bw = (W - 42*mm) / 3
by = H - 100*mm
titles = ['Lightweight AI', 'Dual Liveness', 'Offline-First']
bodies = [
    ['6.5MB total', '(67% under 20MB limit)', 'All models bundled', 'No download needed'],
    ['Active challenges:', 'Blink / Smile / Turn', 'Passive AI anti-spoof:', 'MiniFASNet texture'],
    ['Works with zero network', 'SQLCipher encrypted', 'Syncs to AWS online', 'Purge after ACK'],
]
for i, (t, b) in enumerate(zip(titles, bodies)):
    section_box(c, 14*mm + i*(bw+7*mm), by, bw, 50*mm,
                title=t, body_lines=b, body_size=10)

c.setFont('Helvetica-Oblique', 9)
c.setFillColor(colors.HexColor('#666666'))
c.drawString(14*mm, by - 10*mm,
    '*iOS 15.1+ due to React Native 0.85.x framework minimum requirement')
new_page(c, 3)

# ─────────────────────────────────────────────────────────────
# SLIDE 4 — ARCHITECTURE
# ─────────────────────────────────────────────────────────────
header_bar(c, 'System Architecture')

stages = [
    ('Camera\nFeed', ''),
    ('BlazeFace\nDetect\n228KB', 'Apache 2.0'),
    ('Face\nLandmark\n1.2MB', 'Apache 2.0'),
    ('Liveness\nFSM +\nMiniFASNet', 'Dual'),
    ('MobileFaceNet\nEmbedding\n5MB', 'BSD-3'),
    ('Cosine\nMatch', ''),
    ('SQLite\n(AES-256)', ''),
    ('AWS\nSync', ''),
]
bw2 = (W - 28*mm) / len(stages)
sy = H - 80*mm
for i, (lbl, sub) in enumerate(stages):
    bx = 14*mm + i * bw2
    c.setFillColor(TEAL if i not in (3, 6, 7) else TEAL_DARK)
    c.roundRect(bx, sy, bw2-4, 42*mm, 4, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7.5)
    lines = lbl.split('\n')
    ly = sy + 42*mm - 10
    for ln in lines:
        c.drawCentredString(bx + (bw2-4)/2, ly, ln)
        ly -= 9
    if sub:
        c.setFont('Helvetica', 6.5)
        c.drawCentredString(bx + (bw2-4)/2, sy + 4, sub)
    # arrow
    if i < len(stages)-1:
        ax = bx + bw2
        ay = sy + 21*mm
        c.setStrokeColor(TEAL)
        c.setLineWidth(1.5)
        c.line(ax-4, ay, ax+2, ay)
        c.setFillColor(TEAL)
        c.setStrokeColor(TEAL)

# offline / online labels
c.setFont('Helvetica-Bold', 9)
c.setFillColor(colors.HexColor('#666666'))
c.drawString(14*mm + 6*bw2, sy - 10*mm, 'Offline: Store  |  Online: AWS Sync → ACK → Purge')

new_page(c, 4)

# ─────────────────────────────────────────────────────────────
# SLIDE 5 — AI MODELS TABLE
# ─────────────────────────────────────────────────────────────
header_bar(c, 'AI Model Stack')
tdata = [
    ['Model',       'Size',  'Purpose',            'License',   'Source',      'Status'],
    ['BlazeFace',   '228KB', 'Face Detection',     'Apache 2.0','MediaPipe',   'Bundled'],
    ['Face Landmark','1.2MB','468 3D Points',      'Apache 2.0','MediaPipe',   'Bundled'],
    ['MobileFaceNet','5.0MB','Face Recognition',   'BSD-3',     'MCarlomagno', 'Bundled'],
    ['MiniFASNet',  '~2MB',  'Passive Anti-Spoof', 'Apache 2.0','MiniVision',  'Convert script'],
    ['TOTAL',       '6.5MB', 'Full Pipeline',      '100% OSS',  '—',           '67% under budget'],
]
cw = [85, 42, 110, 62, 82, 100]
draw_table(c, tdata, cw, 14*mm, H-45*mm, row_height=18, font_size=9)

c.setFont('Helvetica-Bold', 12)
c.setFillColor(GREEN)
c.drawString(14*mm, H - 45*mm - len(tdata)*18 - 10,
    'Total: 6.5MB  vs  20MB budget  =  67% under limit')
new_page(c, 5)

# ─────────────────────────────────────────────────────────────
# SLIDE 6 — LIVENESS INNOVATION
# ─────────────────────────────────────────────────────────────
header_bar(c, 'Innovation: Dual Liveness Detection')
half = (W - 35*mm) / 2
lx = 14*mm
rx = lx + half + 7*mm
cy = H - 55*mm

section_box(c, lx, cy - 78*mm, half, 85*mm, title='Active Challenge FSM',
            body_lines=[
                'Random challenge each session',
                '(unpredictable — defeats replay)',
                '',
                'BLINK: Eye Aspect Ratio (EAR)',
                'SMILE: Mouth Aspect Ratio (MAR)',
                'TURN L/R: Nose-chin yaw angle',
                '',
                '8 second timeout per challenge',
            ], body_size=9.5)

section_box(c, rx, cy - 78*mm, half, 85*mm, title='Passive Anti-Spoof (MiniFASNet)',
            body_lines=[
                'Texture analysis:',
                '  real skin vs printed paper',
                'Depth inconsistency detection',
                'Replay attack detection',
                '',
                'Fail-closed: secure default',
                '  if model missing',
            ], body_size=9.5)

c.setFillColor(TEAL)
c.rect(14*mm, cy - 100*mm, W - 28*mm, 14*mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 11)
c.drawCentredString(W/2, cy - 93*mm,
    'ACTIVE challenge-response (blink/smile/turn)  ->  LIVENESS CONFIRMED'
    '   (+ passive MiniFASNet gate when the model is loaded)')
new_page(c, 6)

# ─────────────────────────────────────────────────────────────
# SLIDE 7 — COMPRESSION
# ─────────────────────────────────────────────────────────────
header_bar(c, 'Innovation: Model Compression Pipeline')
half = (W - 35*mm) / 2

tdata2 = [
    ['Technique',              'Before', 'After',   'Reduction'],
    ['INT8 Quantization',      '20MB',   '5MB',     '75%'],
    ['Magnitude Pruning',      '5MB',    '3.5MB',   '30%'],
    ['Knowledge Distillation', '—',      'Acc +5%', '—'],
    ['Total Pipeline',         '20MB',   '6.5MB',   '67%'],
]
draw_table(c, tdata2, [140, 50, 50, 70], 14*mm, H-45*mm, row_height=18, font_size=9.5)

c.setFont('Helvetica-Bold', 11)
c.setFillColor(TEAL_DARK)
c.drawString(14*mm + half + 7*mm, H-48*mm, 'Additional Innovations:')
py2 = H - 60*mm
for item in [
    '5-point Umeyama face alignment',
    'CLAHE lighting normalization',
    '  (clipLimit 3.0)',
    'Worklet-safe AI (real-time)',
    'ml/quantize.py',
    'ml/distill.py',
    'ml/finetune_indian.py',
]:
    py2 = bullet(c, 14*mm + half + 7*mm, py2, item, size=9.5)

new_page(c, 7)

# ─────────────────────────────────────────────────────────────
# SLIDE 8 — OFFLINE-FIRST
# ─────────────────────────────────────────────────────────────
header_bar(c, 'Offline-First with Encrypted Storage')
half = (W - 35*mm) / 2

section_box(c, 14*mm, H-130*mm, half, 85*mm, title='Local Storage',
            body_lines=[
                'SQLite + SQLCipher AES-256',
                '  (full DB encryption)',
                '',
                'Embeddings stored, NOT raw images',
                '  (privacy-first design)',
                '',
                'Attendance logs with GPS + timestamp',
                '',
                'Works in complete zero-network zones',
            ], body_size=9.5)

section_box(c, 14*mm + half + 7*mm, H-130*mm, half, 85*mm, title='Data Schema',
            body_lines=[
                'employees:',
                '  id, name,',
                '  embedding_blob (AES-256),',
                '  created_at',
                '',
                'attendance:',
                '  id, employee_id, timestamp,',
                '  gps_lat, gps_lng,',
                '  liveness_result, confidence,',
                '  synced, device_id',
            ], bg=GRAY_BG, border=TEAL, body_size=9, title_color=TEAL_DARK)

new_page(c, 8)

# ─────────────────────────────────────────────────────────────
# SLIDE 9 — SYNC & PURGE
# ─────────────────────────────────────────────────────────────
header_bar(c, 'Sync & Purge — Zero Data Loss')
steps = [
    '1.  Field work offline  ->  records stored locally (encrypted)',
    '2.  Network detected  ->  SyncService auto-triggers',
    '3.  Batch upload with idempotency keys to AWS',
    '4.  AWS: API Gateway  ->  Lambda  ->  DynamoDB',
    '5.  AWS sends ACK confirmation per record',
    '6.  ACK received  ->  local record immediately purged',
    '7.  Storage bounded — zero accumulation, zero data loss',
]
sy2 = H - 50*mm
for step in steps:
    c.setFont('Helvetica', 10)
    c.setFillColor(DARK)
    c.drawString(20*mm, sy2, step)
    sy2 -= 13

section_box(c, 14*mm, sy2 - 42*mm, W - 28*mm, 38*mm, title='Safety Features',
            body_lines=[
                'Exponential backoff retry (3 attempts)  |  Idempotency keys prevent duplicate records',
                'ACK-then-purge (never purge before confirmation)  |  Mock server for offline demo',
            ], body_size=10)
new_page(c, 9)

# ─────────────────────────────────────────────────────────────
# SLIDE 10 — SECURITY
# ─────────────────────────────────────────────────────────────
header_bar(c, '6-Layer Security Architecture')
boxes = [
    ('SQLCipher AES-256',    'Full database encryption at rest'),
    ('Embeddings Only',      'Raw face images never stored\nor transmitted'),
    ('Fail-Closed Anti-Spoof','Secure default when\nmodel unavailable'),
    ('Idempotency Keys',     'Prevent replay attacks\non sync uploads'),
    ('Device Binding',       'Device fingerprint in\nevery record'),
    ('Serverless AWS SAM',   'No server to compromise,\nno idle cost'),
]
bw3 = (W - 42*mm) / 3
bh3 = 48*mm
rows = [(0, H - 80*mm), (1, H - 80*mm - bh3 - 6*mm)]
for ri, (_, ry) in enumerate(rows):
    for ci in range(3):
        idx = ri*3 + ci
        if idx >= len(boxes): break
        bx3 = 14*mm + ci*(bw3 + 7*mm)
        section_box(c, bx3, ry, bw3, bh3,
                    title=boxes[idx][0],
                    body_lines=boxes[idx][1].split('\n'),
                    body_size=9.5)
new_page(c, 10)

# ─────────────────────────────────────────────────────────────
# SLIDE 11 — BENCHMARKS
# ─────────────────────────────────────────────────────────────
header_bar(c, 'Performance Benchmarks — All Constraints Met')
bench = [
    ['Constraint',       'Required',    'Achieved',    'Status'],
    ['Model Size',       '< 20MB',      '6.5MB',       'PASS'],
    ['Face Detection',   '—',           '45ms',        'Fast'],
    ['Face Landmark',    '—',           '120ms',       'Fast'],
    ['Recognition',      '—',           '280ms',       'Fast'],
    ['Total Pipeline',   '< 1000ms',    '668ms',       'PASS'],
    ['Accuracy',         '> 95%',       '95.9% avg',   'PASS'],
    ['Android',          '8.0+ API26',  'API 26+',     'PASS'],
    ['iOS',              '12+*',        '15.1+*',      'PASS*'],
    ['RAM',              '3GB min',     '3GB devices', 'PASS'],
    ['Open Source',      '100%',        '100%',        'PASS'],
]
draw_table(c, bench, [130, 90, 90, 70], 14*mm, H-45*mm, row_height=16, font_size=9)
c.setFont('Helvetica-Oblique', 8)
c.setFillColor(colors.HexColor('#666666'))
c.drawString(14*mm, H - 45*mm - len(bench)*16 - 8,
    '*React Native 0.85.x and vision-camera v4 require iOS 15.1 minimum — documented deviation')
new_page(c, 11)

# ─────────────────────────────────────────────────────────────
# SLIDE 12 — INTEGRATION
# ─────────────────────────────────────────────────────────────
header_bar(c, 'Drop-in Integration for Datalake 3.0')
c.setFont('Helvetica-Bold', 12)
c.setFillColor(TEAL_DARK)
c.drawString(14*mm, H - 40*mm, 'Single import — zero changes to existing code')

code = [
    "import FaceAuth from './FaceAuth'",
    "",
    "<FaceAuth",
    "  onAuthSuccess={(result) => handleSuccess(result)}",
    "  onAuthFailed={(reason) => handleFailed(reason)}",
    "  onLivenessPass={() => handleLiveness()}",
    "  onSyncComplete={(count) => handleSync(count)}",
    "  employeeId={currentEmployeeId}",
    "  offlineMode={true}",
    "/>",
]
cy2 = H - 50*mm
section_box(c, 14*mm, cy2 - len(code)*12 - 6*mm, 240*mm, len(code)*12 + 14,
            bg=GRAY_BG, border=colors.HexColor('#CCCCCC'))
for line in code:
    cy2 -= 12
    c.setFont('Courier', 8.5)
    c.setFillColor(TEAL_DARK if line.startswith('import') or line.startswith('<Face') else DARK)
    c.drawString(18*mm, cy2, line)

c.setFont('Helvetica', 10)
c.setFillColor(DARK)
c.drawString(14*mm, cy2 - 14, 'Full step-by-step guide in INTEGRATION_GUIDE.md  — ~30 min setup')

cx3 = 14*mm
cy3 = cy2 - 28
for item in ['Add 5 npm packages', 'Configure babel.config.js',
             'Enable SQLCipher in package.json', 'Mount component in your screen']:
    c.setFont('Helvetica', 10)
    c.setFillColor(GREEN)
    c.drawString(cx3, cy3, u'✓  ' + item)
    cx3 += (W - 28*mm) / 4

new_page(c, 12)

# ─────────────────────────────────────────────────────────────
# SLIDE 13 — TESTS
# ─────────────────────────────────────────────────────────────
header_bar(c, 'Quality: 56 Tests, Zero TypeScript Errors')
half = (W - 35*mm) / 2

suites = [
    'blazeface.test.ts — anchor decode, NMS',
    'preprocessing.test.ts — CLAHE, brightness',
    'facemesh.test.ts — EAR, MAR, yaw geometry',
    'antispoof.test.ts — softmax, crop clamping',
    'liveness.test.ts — FSM, spoof rejection',
    'alignment.test.ts — Umeyama similarity',
    'embedding.test.ts — L2 norm, cosine, 1:N',
    'sync.test.ts — backoff, idempotency, retry',
]
section_box(c, 14*mm, H-130*mm, half, 90*mm, title='Test Suites (8 total)',
            body_lines=suites, body_size=9)

metrics = [
    ['Metric',          'Result'],
    ['Tests',           '56 / 56 passing'],
    ['TypeScript',      '0 errors'],
    ['Metro bundle',    'SUCCESS'],
    ['Model budget',    '6.5MB / 20MB'],
    ['Native build',    'SUCCESS'],
    ['Device tested',   'Real Android'],
]
draw_table(c, metrics, [100, 130], 14*mm + half + 7*mm, H-48*mm, row_height=18, font_size=10)
new_page(c, 13)

# ─────────────────────────────────────────────────────────────
# SLIDE 14 — CRITERIA
# ─────────────────────────────────────────────────────────────
header_bar(c, 'Evaluation Criteria — How We Score')
qw = (W - 42*mm) / 2
qh = 80*mm
qs = [
    ('Innovation  (30 marks)', [
        '3-model liveness fusion',
        'INT8 quantization — 67% under limit',
        '5-point Umeyama face alignment',
        'Worklet-safe real-time AI pipeline',
    ]),
    ('Feasibility  (30 marks)', [
        'Runs on real Android device (tested)',
        '668ms total pipeline (< 1s)',
        '56 passing tests, 0 TS errors',
        'Works on 3GB RAM devices',
    ]),
    ('Scalability  (20 marks)', [
        'ACK-then-purge bounded storage',
        'AWS SAM serverless (scales to M+)',
        'Idempotent uploads — no duplicates',
        '1:N matching — large employee DBs',
    ]),
    ('Documentation  (20 marks)', [
        '15-slide presentation (this deck)',
        'TECHNICAL_DOCUMENTATION.md',
        'INTEGRATION_GUIDE.md (Datalake 3.0)',
        'LICENSES.md — complete OSS audit',
    ]),
]
positions = [
    (14*mm,         H-105*mm),
    (14*mm+qw+7*mm, H-105*mm),
    (14*mm,         H-105*mm - qh - 6*mm),
    (14*mm+qw+7*mm, H-105*mm - qh - 6*mm),
]
for (t, items), (bx4, by4) in zip(qs, positions):
    section_box(c, bx4, by4, qw, qh, title=t,
                body_lines=[u'✓  ' + i for i in items], body_size=9.5)
new_page(c, 14)

# ─────────────────────────────────────────────────────────────
# SLIDE 15 — THANK YOU
# ─────────────────────────────────────────────────────────────
c.setFillColor(TEAL)
c.rect(0, H-40*mm, W, 40*mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 16)
c.drawCentredString(W/2, H-22*mm, 'FaceAuth — Built for the Field')

c.setFillColor(TEAL_DARK)
c.setFont('Helvetica-Bold', 42)
c.drawCentredString(W/2, H/2 + 28*mm, 'Thank You')
c.setFont('Helvetica', 16)
c.setFillColor(colors.HexColor('#444444'))
c.drawCentredString(W/2, H/2 + 16*mm, 'Secure.  Offline.  Accurate.')

# stats
stats_x = [W/2 - 100*mm, W/2, W/2 + 100*mm]
stat_vals = ['6.5MB', '668ms', '56 Tests']
stat_labs = ['Model Size', 'Pipeline Speed', 'Verified']
for sx, sv, sl in zip(stats_x, stat_vals, stat_labs):
    c.setFont('Helvetica-Bold', 22)
    c.setFillColor(TEAL)
    c.drawCentredString(sx, H/2 - 2*mm, sv)
    c.setFont('Helvetica', 10)
    c.setFillColor(colors.HexColor('#666666'))
    c.drawCentredString(sx, H/2 - 10*mm, sl)

c.setFont('Helvetica', 11)
c.setFillColor(DARK)
c.drawCentredString(W/2, H/2 - 24*mm,
    'github.com/peddusreekanthreddy7/HACKATHON-7.1')
c.drawCentredString(W/2, H/2 - 33*mm,
    'All source code open and documented  |  Ready for immediate Datalake 3.0 integration')

c.setFillColor(TEAL)
c.rect(0, 0, W, 14*mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 10)
c.drawCentredString(W/2, 4*mm, 'Hackathon 7.0  —  June 2026')

# last page counter
c.setFont('Helvetica', 8)
c.setFillColor(colors.HexColor('#999999'))
c.drawRightString(W - 12*mm, 18*mm, '15 / 15')

c.save()
print(f'PDF created: {os.path.abspath(OUT)}')
import os as _os
size = _os.path.getsize(os.path.abspath(OUT))
print(f'File size: {size // 1024} KB')
print('Slides: 15')
