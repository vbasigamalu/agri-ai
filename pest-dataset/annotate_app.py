"""
annotate_app.py
─────────────────────────────────────────────────────────────────────────────
Zero-Dependency Local Web Annotator for Agri-AI Pest Dataset
Step 2 of the Pipeline: Annotation

Features:
- Pure Python standard library (http.server) — no PyQt, no OpenCV needed!
- Runs locally on http://localhost:5500
- Click & drag bounding boxes on pest images
- Saves directly to YOLO format (.txt) next to each image
- Supports full keyboard shortcuts (W: Box, S: Save, D: Next, A: Prev)
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLEANED_DIR = os.path.join(BASE_DIR, "cleaned")

CLASSES = [
    "aphids", "armyworm", "beetle", "bollworm", "grasshopper",
    "mites", "mosquito", "sawfly", "stem_borer"
]

PORT = 5500

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Agri-AI Pest Annotator (YOLO)</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #1e293b;
      --accent: #10b981;
      --accent-hover: #059669;
      --text: #f8fafc;
      --muted: #94a3b8;
      --danger: #ef4444;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
    
    /* Sidebar */
    .sidebar {
      width: 320px; background: var(--panel); border-right: 1px solid var(--border);
      display: flex; flex-direction: column; padding: 18px; gap: 16px;
    }
    .logo { font-size: 1.25rem; font-weight: 700; color: var(--accent); display: flex; align-items: center; gap: 8px; }
    .select-group label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
    select, button {
      width: 100%; padding: 10px 14px; border-radius: 8px; font-size: 0.95rem;
      border: 1px solid var(--border); background: #0f172a; color: var(--text); cursor: pointer;
    }
    button.primary { background: var(--accent); color: #022c22; font-weight: 600; border: none; }
    button.primary:hover { background: var(--accent-hover); }
    button.secondary { background: #334155; border: none; }
    button.secondary:hover { background: #475569; }
    button.danger { background: #7f1d1d; border: none; color: #fecaca; }
    button.danger:hover { background: #991b1b; }
    
    .stats {
      background: #0f172a; padding: 12px; border-radius: 8px; font-size: 0.85rem; border: 1px solid var(--border);
    }
    .stats-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .stats-row:last-child { margin-bottom: 0; }
    .stats-val { font-weight: 600; color: var(--accent); }

    .box-list {
      flex: 1; overflow-y: auto; background: #0f172a; border-radius: 8px; padding: 10px; border: 1px solid var(--border);
    }
    .box-item {
      display: flex; justify-content: space-between; align-items: center; padding: 6px 10px;
      background: #1e293b; margin-bottom: 6px; border-radius: 6px; font-size: 0.82rem;
    }
    .box-item span { color: var(--accent); }
    .box-item button { width: auto; padding: 2px 8px; font-size: 0.75rem; background: var(--danger); border: none; border-radius: 4px; }

    /* Main Area */
    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .topbar {
      height: 56px; background: var(--panel); border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between; padding: 0 20px;
    }
    .img-info { font-size: 0.9rem; color: var(--muted); }
    .img-info b { color: var(--text); }
    .controls { display: flex; gap: 10px; }
    .controls button { width: auto; padding: 8px 16px; font-size: 0.85rem; }

    .canvas-container {
      flex: 1; display: flex; align-items: center; justify-content: center; position: relative;
      background: #090d16; overflow: auto; padding: 20px;
    }
    canvas {
      border: 1px solid var(--border); border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      cursor: crosshair;
    }
    
    .hints {
      font-size: 0.75rem; color: var(--muted); line-height: 1.4; background: #0f172a; padding: 10px; border-radius: 6px;
    }
    .hints kbd {
      background: #334155; color: #fff; padding: 2px 5px; border-radius: 4px; font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="logo">🐛 Agri-AI Pest Annotator</div>
    
    <div class="select-group">
      <label>Pest Class</label>
      <select id="classSelect" onchange="onClassChange()"></select>
    </div>

    <div class="stats">
      <div class="stats-row"><span>Image Progress:</span><span class="stats-val" id="progressVal">0 / 0</span></div>
      <div class="stats-row"><span>Status:</span><span class="stats-val" id="statusVal">Loading...</span></div>
      <div class="stats-row"><span>Boxes on Image:</span><span class="stats-val" id="boxCountVal">0</span></div>
    </div>

    <div class="select-group" style="margin-top: 4px;">
      <label>Bounding Boxes (YOLO)</label>
      <div class="box-list" id="boxList">No boxes drawn yet.</div>
    </div>

    <button class="secondary" onclick="addFullFrameBox()">📐 Add Full-Image Box</button>
    <button class="primary" onclick="saveAnnotations()">💾 Save YOLO Label (S)</button>

    <div class="hints">
      <p><b>Shortcuts:</b></p>
      <p><kbd>Click & Drag</kbd> Draw Box</p>
      <p><kbd>S</kbd> Save Label</p>
      <p><kbd>D</kbd> Next Image &nbsp; <kbd>A</kbd> Prev Image</p>
      <p><kbd>Z</kbd> Undo Last Box</p>
    </div>
  </div>

  <div class="main">
    <div class="topbar">
      <div class="img-info" id="imageTitle">Loading...</div>
      <div class="controls">
        <button class="secondary" onclick="prevImage()">◀ Prev (A)</button>
        <button class="secondary" onclick="nextImage()">Next (D) ▶</button>
        <button class="primary" onclick="saveAnnotations()">Save & Next ▶</button>
      </div>
    </div>
    <div class="canvas-container">
      <canvas id="canvas"></canvas>
    </div>
  </div>

  <script>
    const CLASSES = ["aphids", "armyworm", "beetle", "bollworm", "grasshopper", "mites", "mosquito", "sawfly", "stem_borer"];
    let currentClass = CLASSES[0];
    let images = [];
    let currentIndex = 0;
    let boxes = []; // [{x, y, w, h}] in image pixel space
    let isDrawing = false;
    let startX = 0, startY = 0;
    let img = new Image();

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Populate class selector
    const classSelect = document.getElementById('classSelect');
    CLASSES.forEach((cls, i) => {
      const opt = document.createElement('option');
      opt.value = cls;
      opt.textContent = `${i}: ${cls}`;
      classSelect.appendChild(opt);
    });

    function onClassChange() {
      currentClass = classSelect.value;
      loadClassImages();
    }

    async function loadClassImages() {
      const res = await fetch(`/api/images?class=${currentClass}`);
      images = await res.json();
      currentIndex = 0;
      updateImage();
    }

    async function updateImage() {
      if (images.length === 0) {
        document.getElementById('imageTitle').textContent = `No images in ${currentClass}`;
        return;
      }
      const imgName = images[currentIndex];
      document.getElementById('imageTitle').innerHTML = `Class: <b>${currentClass}</b> &nbsp;|&nbsp; Image: <b>${imgName}</b>`;
      document.getElementById('progressVal').textContent = `${currentIndex + 1} / ${images.length}`;

      // Load existing annotations if any
      const labelRes = await fetch(`/api/label?class=${currentClass}&image=${imgName}`);
      const labelData = await labelRes.json();

      img = new Image();
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Convert YOLO normalized boxes [cls_id, cx, cy, w, h] to pixel [x, y, w, h]
        boxes = (labelData.boxes || []).map(b => {
          const cx = b[1] * canvas.width;
          const cy = b[2] * canvas.height;
          const w = b[3] * canvas.width;
          const h = b[4] * canvas.height;
          return { x: cx - w/2, y: cy - h/2, w: w, h: h };
        });

        document.getElementById('statusVal').textContent = labelData.exists ? 'Annotated ✅' : 'Unlabeled ⏳';
        render();
        updateBoxList();
      };
      img.src = `/images/${currentClass}/${imgName}`;
    }

    function render(previewBox = null) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Draw saved boxes
      boxes.forEach((b, idx) => {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fillRect(b.x, b.y, b.w, b.h);

        ctx.fillStyle = '#10b981';
        ctx.fillRect(b.x, b.y - 20, 80, 20);
        ctx.fillStyle = '#022c22';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${currentClass} #${idx+1}`, b.x + 4, b.y - 5);
      });

      // Draw live drawing box
      if (previewBox) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(previewBox.x, previewBox.y, previewBox.w, previewBox.h);
        ctx.setLineDash([]);
      }
    }

    function updateBoxList() {
      const list = document.getElementById('boxList');
      document.getElementById('boxCountVal').textContent = boxes.length;
      if (boxes.length === 0) {
        list.innerHTML = '<span style="color:var(--muted); font-size:0.8rem;">No boxes drawn yet.</span>';
        return;
      }
      list.innerHTML = '';
      boxes.forEach((b, idx) => {
        const item = document.createElement('div');
        item.className = 'box-item';
        item.innerHTML = `<span>#${idx+1}: ${Math.round(b.w)}×${Math.round(b.h)}px</span>
          <button onclick="removeBox(${idx})">✕</button>`;
        list.appendChild(item);
      });
    }

    function removeBox(idx) {
      boxes.splice(idx, 1);
      render();
      updateBoxList();
    }

    function addFullFrameBox() {
      // In pest trap photos, pest often covers central area
      const margin = 0.05;
      boxes.push({
        x: canvas.width * margin,
        y: canvas.height * margin,
        w: canvas.width * (1 - 2*margin),
        h: canvas.height * (1 - 2*margin)
      });
      render();
      updateBoxList();
    }

    // Canvas drawing handlers
    function getCanvasCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    canvas.addEventListener('mousedown', (e) => {
      const p = getCanvasCoords(e);
      startX = p.x;
      startY = p.y;
      isDrawing = true;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const p = getCanvasCoords(e);
      const w = p.x - startX;
      const h = p.y - startY;
      render({
        x: w < 0 ? p.x : startX,
        y: h < 0 ? p.y : startY,
        w: Math.abs(w),
        h: Math.abs(h)
      });
    });

    canvas.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      const p = getCanvasCoords(e);
      const w = Math.abs(p.x - startX);
      const h = Math.abs(p.y - startY);
      if (w > 10 && h > 10) {
        boxes.push({
          x: Math.min(startX, p.x),
          y: Math.min(startY, p.y),
          w: w,
          h: h
        });
      }
      render();
      updateBoxList();
    });

    async function saveAnnotations(andNext = false) {
      if (images.length === 0) return;
      const imgName = images[currentIndex];
      const classIdx = CLASSES.indexOf(currentClass);

      // Convert pixel boxes to YOLO normalized format: [class_idx, cx, cy, w, h]
      const yoloBoxes = boxes.map(b => {
        const cx = (b.x + b.w / 2) / canvas.width;
        const cy = (b.y + b.h / 2) / canvas.height;
        const nw = b.w / canvas.width;
        const nh = b.h / canvas.height;
        return [classIdx, cx, cy, nw, nh];
      });

      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class: currentClass,
          image: imgName,
          boxes: yoloBoxes
        })
      });

      if (res.ok) {
        document.getElementById('statusVal').textContent = 'Saved ✅';
        if (andNext) nextImage();
      }
    }

    function nextImage() {
      if (currentIndex < images.length - 1) {
        currentIndex++;
        updateImage();
      }
    }

    function prevImage() {
      if (currentIndex > 0) {
        currentIndex--;
        updateImage();
      }
    }

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') nextImage();
      else if (e.key === 'a' || e.key === 'A') prevImage();
      else if (e.key === 's' || e.key === 'S') saveAnnotations();
      else if (e.key === 'z' || e.key === 'Z') {
        if (boxes.length > 0) { boxes.pop(); render(); updateBoxList(); }
      }
    });

    // Initial load
    loadClassImages();
  </script>
</body>
</html>
"""

class AnnotatorHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/" or path == "/index.html":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
            return

        elif path == "/api/images":
            cls = query.get("class", [CLASSES[0]])[0]
            cls_dir = os.path.join(CLEANED_DIR, cls)
            imgs = []
            if os.path.isdir(cls_dir):
                imgs = sorted([
                    f for f in os.listdir(cls_dir)
                    if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
                ])
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(imgs).encode("utf-8"))
            return

        elif path == "/api/label":
            cls = query.get("class", [""])[0]
            img = query.get("image", [""])[0]
            stem = os.path.splitext(img)[0]
            lbl_path = os.path.join(CLEANED_DIR, cls, f"{stem}.txt")
            
            boxes = []
            exists = os.path.exists(lbl_path)
            if exists:
                with open(lbl_path, "r") as f:
                    for line in f:
                        parts = line.strip().split()
                        if len(parts) == 5:
                            boxes.append([int(parts[0])] + [float(p) for p in parts[1:]])
            
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"exists": exists, "boxes": boxes}).encode("utf-8"))
            return

        elif path.startswith("/images/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                _, cls, filename = parts
                img_path = os.path.join(CLEANED_DIR, cls, filename)
                if os.path.exists(img_path):
                    self.send_response(200)
                    self.send_header("Content-type", "image/jpeg")
                    self.end_headers()
                    with open(img_path, "rb") as f:
                        self.wfile.write(f.read())
                    return

        self.send_error(404, "File Not Found")

    def do_POST(self):
        if self.path == "/api/save":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len)
            data = json.loads(body.decode("utf-8"))

            cls = data.get("class")
            img = data.get("image")
            boxes = data.get("boxes", [])

            stem = os.path.splitext(img)[0]
            lbl_path = os.path.join(CLEANED_DIR, cls, f"{stem}.txt")

            # Write YOLO format
            with open(lbl_path, "w") as f:
                for b in boxes:
                    f.write(f"{b[0]} {b[1]:.6f} {b[2]:.6f} {b[3]:.6f} {b[4]:.6f}\n")

            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "saved", "count": len(boxes)}).encode("utf-8"))
            return

        self.send_error(404)

def run():
    print("=" * 65)
    print("🌱 AGRI-AI: LOCAL WEB ANNOTATOR")
    print("=" * 65)
    print(f"🚀 Running at: http://localhost:{PORT}")
    print("✨ Open your browser at http://localhost:5500 to annotate!")
    print("Press Ctrl+C to stop.")
    print("=" * 65)
    server = HTTPServer(("0.0.0.0", PORT), AnnotatorHandler)
    server.serve_forever()

if __name__ == "__main__":
    run()
