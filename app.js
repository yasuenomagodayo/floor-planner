/****************************************************
 * スマホ最適化・縮尺ズレゼロ・家具操作安定版 app.js
 * （既存機能は一切削除していません）
 ****************************************************/

// ===============================
// 基本変数
// ===============================
const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

let floorImage = null;
let furniture = [];
let pxPerMm = null;

let selectedItem = null;
let draggingItem = null;
let rotationMode = false;
let rotationTarget = null;

let offsetX = 0;
let offsetY = 0;
let longPressTimer = null;
const LONG_PRESS_MS = 500;

let scaleMode = false;
let scaleStart = null;
let scaleEnd = null;

let currentColor = "#888888";
document.getElementById("colorPicker").addEventListener("change", e => {
  currentColor = e.target.value;
});

// ===============================
// スマホ・PC共通の座標取得（ズレゼロ）
// ===============================
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// ===============================
// スクロール制御（家具操作中は完全停止）
// ===============================
function disableScroll() {
  document.body.style.overflow = "hidden";
}

function enableScroll() {
  document.body.style.overflow = "auto";
}

// ===============================
// STEP切り替え
// ===============================
function showStep(n) {
  document.getElementById("step1").style.display = n === 1 ? "block" : "none";
  document.getElementById("step2").style.display = n === 2 ? "block" : "none";
  document.getElementById("step3").style.display = n === 3 ? "block" : "none";

  canvas.style.touchAction = "auto";
}

document.getElementById("goStep2").addEventListener("click", () => showStep(2));
document.getElementById("backToStep1").addEventListener("click", () => showStep(1));
document.getElementById("backToStep2").addEventListener("click", () => showStep(2));

document.getElementById("goStep3").addEventListener("click", () => {
  scaleStart = null;
  scaleEnd = null;
  showStep(3);
  draw();
});

// ===============================
// 間取り図アップロード
// ===============================
document.getElementById("floorImageInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    floorImage = img;
    canvas.width = img.width;
    canvas.height = img.height;

    draw();
    document.getElementById("goStep2").disabled = false;
  };
  img.src = URL.createObjectURL(file);
});

// ===============================
// プロジェクト読み込み
// ===============================
function loadProject(project) {
  pxPerMm = project.scale || null;
  furniture = project.furniture || [];

  if (project.floorImage) {
    const img = new Image();
    img.onload = () => {
      floorImage = img;
      canvas.width = img.width;
      canvas.height = img.height;

      draw();
      document.getElementById("goStep2").disabled = false;
      showStep(3);
    };
    img.src = project.floorImage;
  } else {
    showStep(3);
    draw();
    document.getElementById("goStep2").disabled = false;
  }
}

document.getElementById("loadProjectInputStep1").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadProject(JSON.parse(reader.result));
  reader.readAsText(file);
});

document.getElementById("loadProjectInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadProject(JSON.parse(reader.result));
  reader.readAsText(file);
});

// ===============================
// 縮尺設定
// ===============================
document.getElementById("setScaleBtn").addEventListener("click", () => {
  scaleMode = true;
  scaleStart = null;
  scaleEnd = null;
  document.getElementById("scaleInfo").textContent =
    "縮尺設定モード：始点をタップしてください";
});

// ===============================
// ピンチズーム（STEP2専用）
// ===============================
let isPinching = false;
let pinchStartDistance = 0;
let currentScale = 1;

function pinchDistance(e) {
  const t1 = e.touches[0];
  const t2 = e.touches[1];
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

canvas.addEventListener("touchmove", e => {
  if (document.getElementById("step2").style.display === "block") {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = pinchDistance(e);

      if (!isPinching) {
        isPinching = true;
        pinchStartDistance = dist;
      } else {
        const scaleFactor = dist / pinchStartDistance;
        currentScale *= scaleFactor;

        canvas.style.transform = `scale(${currentScale})`;
        pinchStartDistance = dist;
      }
    }
  }
});

canvas.addEventListener("touchend", () => {
  isPinching = false;
});

// ===============================
// pointer events
// ===============================
canvas.addEventListener("pointerdown", startPointer);
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointerleave", endPointer);

canvas.addEventListener("contextmenu", e => e.preventDefault());

// ===============================
// pointer start
// ===============================
function startPointer(e) {
  const pos = getPos(e);

  // STEP2：ピンチ中は縮尺無効
  if (scaleMode && e.touches && e.touches.length > 1) {
    return;
  }

  // STEP2：縮尺設定
  if (scaleMode) {
    if (!scaleStart) {
      scaleStart = pos;
      document.getElementById("scaleInfo").textContent =
        "終点をタップしてください";
    } else {
      scaleEnd = pos;

      // mm入力ダイアログ表示
      document.getElementById("scaleInputDialog").style.display = "block";
    }
    draw();
    return;
  }

  // STEP3：家具操作
  selectedItem = null;
  draggingItem = null;
  rotationMode = false;
  rotationTarget = null;

  for (const item of furniture) {
    if (hitItem(item, pos.x, pos.y)) {
      selectedItem = item;

      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      const dist = Math.hypot(pos.x - cx, pos.y - cy);
      const edgeMargin = Math.min(item.width, item.height) * 0.2;

      // 移動
      if (dist < Math.min(item.width, item.height) / 2 - edgeMargin) {
        draggingItem = item;
        offsetX = pos.x - item.x;
        offsetY = pos.y - item.y;

        canvas.style.touchAction = "none";
        disableScroll();
        e.preventDefault();
      }
      // 回転
      else {
        rotationTarget = item;

        longPressTimer = setTimeout(() => {
          rotationMode = true;
          draggingItem = null;

          rotationTarget._cx = rotationTarget.x + rotationTarget.width / 2;
          rotationTarget._cy = rotationTarget.y + rotationTarget.height / 2;

          canvas.style.touchAction = "none";
          disableScroll();
        }, LONG_PRESS_MS);
      }
      break;
    }
  }

  updateDeleteButtonState();
  draw();
}

// ===============================
// pointer move
// ===============================
function movePointer(e) {
  const pos = getPos(e);

  // 回転
  if (rotationMode && rotationTarget) {
    const cx = rotationTarget._cx;
    const cy = rotationTarget._cy;

    const angle = Math.atan2(pos.y - cy, pos.x - cx);
    rotationTarget.rotation = angle;

    draw();
    return;
  }

  // 移動
  if (draggingItem) {
    draggingItem.x = pos.x - offsetX;
    draggingItem.y = pos.y - offsetY;
    draw();
  }
}

// ===============================
// pointer end
// ===============================
function endPointer() {
  draggingItem = null;
  rotationMode = false;
  rotationTarget = null;

  canvas.style.touchAction = "auto";
  enableScroll();

  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

// ===============================
// 当たり判定
// ===============================
function hitItem(item, x, y) {
  return (
    x >= item.x &&
    x <= item.x + item.width &&
    y >= item.y &&
    y <= item.y + item.height
  );
}

// ===============================
// 家具追加（mm → px）
// ===============================
function addFurnitureFromMm(label, wMm, hMm, type, color) {
  if (!pxPerMm) {
    alert("先に縮尺を設定してください");
    return;
  }

  furniture.push({
    x: 50,
    y: 50,
    width: wMm * pxPerMm,
    height: hMm * pxPerMm,
    color,
    label: `${label}（${wMm}×${hMm}mm）`,
    type,
    rotation: 0
  });

  draw();
}

// ===============================
// 家具追加ボタン（click＋pointerup両対応）
// ===============================
function safeButton(id, handler) {
  const el = document.getElementById(id);
  el.addEventListener("click", handler);
  el.addEventListener("pointerup", handler);
}

// ベッド
safeButton("addBedBtn", () => {
  const v = document.getElementById("bedSizeSelect").value;
  const sizes = {
    single: { w: 970, h: 1950, label: "ベッド（シングル）" },
    semi: { w: 1200, h: 1950, label: "ベッド（セミダブル）" },
    double: { w: 1400, h: 1950, label: "ベッド（ダブル）" }
  };
  const s = sizes[v];
  addFurnitureFromMm(s.label, s.w, s.h, "bed", currentColor);
});

// ソファ
safeButton("addSofaBtn", () => {
  const v = document.getElementById("sofaSeatSelect").value;
  const sizes = {
    1: { w: 800, h: 800, label: "ソファ（1人掛け）" },
    2: { w: 1400, h: 800, label: "ソファ（2人掛け）" },
    3: { w: 1800, h: 800, label: "ソファ（3人掛け）" }
  };
  const s = sizes[v];
  addFurnitureFromMm(s.label, s.w, s.h, "sofa", currentColor);
});

// プリセット家具
const presets = {
  desk: { w: 1200, h: 600, label: "机" },
  studyDesk: { w: 1000, h: 600, label: "勉強机" },
  chair: { w: 400, h: 400, label: "椅子" },
  fridgeSmall: { w: 480, h: 600, label: "冷蔵庫（小）" },
  fridgeLarge: { w: 600, h: 700, label: "冷蔵庫（大）" },
  washer: { w: 600, h: 600, label: "洗濯機" }
};

document.querySelectorAll(".presetBtn").forEach(btn => {
  safeButton(btn.id, () => {
    const p = presets[btn.dataset.type];
    addFurnitureFromMm(p.label, p.w, p.h, btn.dataset.type, currentColor);
  });
});

// 自作家具
safeButton("addCustomFurnitureBtn", () => {
  const name = document.getElementById("customName").value || "家具";
  const wMm = parseFloat(document.getElementById("customWidthMm").value);
  const hMm = parseFloat(document.getElementById("customHeightMm").value);
  const color = document.getElementById("customColor").value;

  if (!wMm || !hMm || wMm <= 0 || hMm <= 0) {
    alert("幅と奥行(mm)を正しく入力してください");
    return;
  }

  addFurnitureFromMm(name, wMm, hMm, "custom", color);
});

// ===============================
// 家具削除
// ===============================
safeButton("deleteSelectedBtn", () => {
  if (!selectedItem) return;
  furniture = furniture.filter(f => f !== selectedItem);
  selectedItem = null;
  updateDeleteButtonState();
  draw();
});

function updateDeleteButtonState() {
  document.getElementById("deleteSelectedBtn").disabled = !selectedItem;
}

// ===============================
// 描画
// ===============================
function drawFurnitureIcon(item) {
  const w = item.width;
  const h = item.height;

  ctx.save();
  ctx.translate(item.x + w / 2, item.y + h / 2);
  ctx.rotate(item.rotation || 0);
  ctx.translate(-w / 2, -h / 2);

  ctx.fillStyle = item.color;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.strokeRect(0, 0, w, h);

  ctx.fillStyle = "white";
  ctx.font = "12px sans-serif";
  ctx.fillText(item.label, 6, 18);

  if (item === selectedItem) {
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  }

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (floorImage) ctx.drawImage(floorImage, 0, 0);

  if (scaleStart && document.getElementById("step2").style.display === "block") {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(scaleStart.x, scaleStart.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (scaleEnd && document.getElementById("step2").style.display === "block") {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(scaleEnd.x, scaleEnd.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.moveTo(scaleStart.x, scaleStart.y);
    ctx.lineTo(scaleEnd.x, scaleEnd.y);
    ctx.stroke();
  }

  furniture.forEach(item => drawFurnitureIcon(item));
}

// ===============================
// PNG保存
// ===============================
safeButton("saveImageBtn", () => {
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "floorplan.png";
  a.click();
});

// ===============================
// プロジェクト保存
// ===============================
safeButton("saveProjectBtn", () => {
  if (!floorImage) {
    alert("間取り図をアップロードしてください");
    return;
  }

  const project = {
    scale: pxPerMm,
    furniture,
    floorImage: canvas.toDataURL("image/png")
  };

  const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "floorplan_project.json";
  a.click();
});

// ===============================
// 縮尺入力ダイアログ処理（完全版）
// ===============================
document.getElementById("scaleInputOk").onclick = () => {
  const mm = parseFloat(document.getElementById("scaleInputMm").value);
  document.getElementById("scaleInputDialog").style.display = "none";

  if (mm > 0) {
    const dx = scaleEnd.x - scaleStart.x;
    const dy = scaleEnd.y - scaleStart.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);

    pxPerMm = distPx / mm;

    document.getElementById("scaleInfo").textContent =
      `縮尺設定完了：1mm ≒ ${pxPerMm.toFixed(4)} px`;

    // ★ STEP3へ進めるボタンを有効化
    document.getElementById("goStep3").disabled = false;

  } else {
    alert("正しいmmを入力してください");
  }

  scaleMode = false;
  draw();
};

document.getElementById("scaleInputCancel").onclick = () => {
  document.getElementById("scaleInputDialog").style.display = "none";
  scaleMode = false;
};

// ===============================
// 初期表示
// ===============================
showStep(1);
draw();
