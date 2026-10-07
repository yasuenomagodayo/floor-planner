// キャンバス
const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

// 間取り図
let floorImage = null;

// 家具データ
let furniture = [];

// 縮尺（1mmあたり何pxか）
let pxPerMm = null;

// 選択中家具
let selectedItem = null;

// ドラッグ・回転用
let draggingItem = null;
let offsetX = 0;
let offsetY = 0;

let rotationMode = false;
let rotationTarget = null;
let longPressTimer = null;
const LONG_PRESS_MS = 500;

// 縮尺設定用
let scaleMode = false;
let scaleStart = null;
let scaleEnd = null;

// STEP UI
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

// スマホ座標ズレ補正
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

// STEP切り替え
function showStep(n) {
  step1.style.display = n === 1 ? "block" : "none";
  step2.style.display = n === 2 ? "block" : "none";
  step3.style.display = n === 3 ? "block" : "none";

  // スクロール制御
  if (n === 1 || n === 2) {
    canvas.style.touchAction = "auto"; // スクロール可能
  } else {
    canvas.style.touchAction = "auto"; // STEP3でも通常はスクロール可能
  }
}

// STEP1 → STEP2
document.getElementById("goStep2").addEventListener("pointerdown", () => {
  showStep(2);
});

// STEP2 → STEP1
document.getElementById("backToStep1").addEventListener("pointerdown", () => {
  showStep(1);
});

// STEP2 → STEP3
document.getElementById("goStep3").addEventListener("pointerdown", () => {
  scaleStart = null;
  scaleEnd = null;
  showStep(3);
  draw();
});

// STEP3 → STEP2
document.getElementById("backToStep2").addEventListener("pointerdown", () => {
  showStep(2);
});

// 間取り図アップロード
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

// STEP1 プロジェクト読み込み
document.getElementById("loadProjectInputStep1").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    loadProject(JSON.parse(reader.result));
  };
  reader.readAsText(file);
});

// STEP3 プロジェクト読み込み
document.getElementById("loadProjectInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    loadProject(JSON.parse(reader.result));
  };
  reader.readAsText(file);
});

// プロジェクト読み込み処理
function loadProject(project) {
  pxPerMm = project.scale || null;
  furniture = project.furniture || [];

  if (project.floorImage) {
    const img = new Image();
    img.onload = () => {
      floorImage = img;
      canvas.width = img.width;
      canvas.height = img.height;
      showStep(3);
      draw();
    };
    img.src = project.floorImage;
  } else {
    showStep(3);
    draw();
  }
}

// 縮尺設定
document.getElementById("setScaleBtn").addEventListener("click", () => {
  scaleMode = true;
  scaleStart = null;
  scaleEnd = null;
  document.getElementById("scaleInfo").textContent =
    "縮尺設定モード：線の始点をタップしてください。";
});

// pointer events
canvas.addEventListener("pointerdown", startPointer);
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointerleave", endPointer);

// 右クリック回転
canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
});

// pointer start
function startPointer(e) {
  const pos = getPos(e);

  // STEP2：縮尺設定
  if (scaleMode) {
    if (!scaleStart) {
      scaleStart = pos;
      document.getElementById("scaleInfo").textContent =
        "終点をタップしてください。";
    } else {
      scaleEnd = pos;

      const dx = scaleEnd.x - scaleStart.x;
      const dy = scaleEnd.y - scaleStart.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      const mmStr = window.prompt("この線の長さ(mm)を入力してください");
      const mm = parseFloat(mmStr);

      if (mm > 0) {
        pxPerMm = distPx / mm;
        document.getElementById("scaleInfo").textContent =
          `縮尺設定完了：1mm ≒ ${pxPerMm.toFixed(4)} px`;
        document.getElementById("goStep3").disabled = false;
      } else {
        alert("正しいmmを入力してください");
      }

      scaleMode = false;
    }
    draw();
    return;
  }

  // STEP3：家具操作
  selectedItem = null;
  draggingItem = null;
  rotationMode = false;
  rotationTarget = null;

  // 家具選択判定
  for (const item of furniture) {
    if (hitItem(item, pos.x, pos.y)) {
      selectedItem = item;

      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      const dist = distance(pos.x, pos.y, cx, cy);
      const edgeMargin = Math.min(item.width, item.height) * 0.2;

      if (dist < Math.min(item.width, item.height) / 2 - edgeMargin) {
        draggingItem = item;
        offsetX = pos.x - item.x;
        offsetY = pos.y - item.y;

        canvas.style.touchAction = "none"; // 家具操作中はスクロール禁止
      } else {
        rotationTarget = item;
        longPressTimer = setTimeout(() => {
          rotationMode = true;
          draggingItem = null;
          canvas.style.touchAction = "none";
        }, LONG_PRESS_MS);
      }
      break;
    }
  }

  updateDeleteButtonState();
  draw();
}

// pointer move
function movePointer(e) {
  const pos = getPos(e);

  if (rotationMode && rotationTarget) {
    const cx = rotationTarget.x + rotationTarget.width / 2;
    const cy = rotationTarget.y + rotationTarget.height / 2;
    rotationTarget.rotation = Math.atan2(pos.y - cy, pos.x - cx);
    draw();
    return;
  }

  if (draggingItem) {
    draggingItem.x = pos.x - offsetX;
    draggingItem.y = pos.y - offsetY;
    draw();
  }
}

// pointer end
function endPointer() {
  draggingItem = null;
  rotationMode = false;
  rotationTarget = null;

  canvas.style.touchAction = "auto"; // 家具操作終了 → スクロール復活

  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

// 距離計算
function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// 家具当たり判定（回転は簡易無視）
function hitItem(item, x, y) {
  return (
    x >= item.x &&
    x <= item.x + item.width &&
    y >= item.y &&
    y <= item.y + item.height
  );
}

// 家具追加（mm → px）
function addFurnitureFromMm(label, wMm, hMm, color, type) {
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
    label,
    type,
    rotation: 0
  });

  draw();
}

// プリセット家具
const presets = {
  desk: { w: 1200, h: 600, label: "机", type: "desk" },
  studyDesk: { w: 1000, h: 600, label: "勉強机", type: "desk" },
  chair: { w: 400, h: 400, label: "椅子", type: "chair" },
  fridgeSmall: { w: 480, h: 600, label: "冷蔵庫小", type: "fridge" },
  fridgeLarge: { w: 600, h: 700, label: "冷蔵庫大", type: "fridge" },
  washer: { w: 600, h: 600, label: "洗濯機", type: "washer" }
};

document.querySelectorAll(".presetBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const p = presets[btn.dataset.type];
    addFurnitureFromMm(
      `${p.label}（${p.w}×${p.h}mm）`,
      p.w,
      p.h,
      currentColor,
      p.type
    );
  });
});

// ベッド
document.getElementById("addBedBtn").addEventListener("click", () => {
  const v = document.getElementById("bedSizeSelect").value;
  const sizes = {
    single: { w: 970, h: 1950, label: "ベッド（シングル）" },
    semi: { w: 1200, h: 1950, label: "ベッド（セミダブル）" },
    double: { w: 1400, h: 1950, label: "ベッド（ダブル）" }
  };
  const s = sizes[v];
  addFurnitureFromMm(s.label, s.w, s.h, currentColor, "bed");
});

// ソファ
document.getElementById("addSofaBtn").addEventListener("click", () => {
  const v = document.getElementById("sofaSeatSelect").value;
  const sizes = {
    1: { w: 800, h: 800, label: "ソファ（1人掛け）" },
    2: { w: 1400, h: 800, label: "ソファ（2人掛け）" },
    3: { w: 1800, h: 800, label: "ソファ（3人掛け）" }
  };
  const s = sizes[v];
  addFurnitureFromMm(s.label, s.w, s.h, currentColor, "sofa");
});

// 自作家具
document.getElementById("addCustomFurnitureBtn").addEventListener("click", () => {
  const name = document.getElementById("customName").value || "家具";
  const wMm = parseFloat(document.getElementById("customWidthMm").value);
  const hMm = parseFloat(document.getElementById("customHeightMm").value);
  const color = document.getElementById("customColor").value;

  if (!wMm || !hMm || wMm <= 0 || hMm <= 0) {
    alert("幅と奥行(mm)を正しく入力してください");
    return;
  }

  addFurnitureFromMm(`${name}（${wMm}×${hMm}mm）`, wMm, hMm, color, "custom");
});

// 家具削除
const deleteBtn = document.getElementById("deleteSelectedBtn");
deleteBtn.addEventListener("click", () => {
  if (!selectedItem) return;
  furniture = furniture.filter(f => f !== selectedItem);
  selectedItem = null;
  updateDeleteButtonState();
  draw();
});

function updateDeleteButtonState() {
  deleteBtn.disabled = !selectedItem;
}

// 家具描画
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
  ctx.lineWidth = 2;

  switch (item.type) {
    case "bed":
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(8, 8, w - 16, h * 0.15);
      ctx.strokeRect(8, 8, w - 16, h * 0.15);
      break;

    case "sofa":
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(4, 4, w - 8, h * 0.35);
      ctx.strokeRect(4, 4, w - 8, h * 0.35);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(4, h * 0.35 + 6, w - 8, h - h * 0.35 - 10);
      ctx.strokeRect(4, h * 0.35 + 6, w - 8, h - h * 0.35 - 10);
      break;

    case "desk":
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.beginPath();
      ctx.moveTo(10, h - 6);
      ctx.lineTo(10, h - 20);
      ctx.moveTo(w - 10, h - 6);
      ctx.lineTo(w - 10, h - 20);
      ctx.stroke();
      break;

    case "chair":
      const seat = Math.min(w, h) * 0.6;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect((w - seat) / 2, (h - seat) / 2, seat, seat);
      ctx.strokeRect((w - seat) / 2, (h - seat) / 2, seat, seat);
      break;

    case "fridge":
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.beginPath();
      ctx.moveTo(w / 2, 6);
      ctx.lineTo(w / 2, h - 6);
      ctx.stroke();
      break;

    case "washer":
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      break;

    default:
      ctx.strokeRect(4, 4, w - 8, h - 8);
  }

  ctx.fillStyle = "white";
  ctx.font = "12px sans-serif";
  ctx.fillText(item.label, 6, 18);

  if (item === selectedItem) {
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }

  ctx.restore();
}

// 描画
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (floorImage) {
    ctx.drawImage(floorImage, 0, 0);
  }

  if (scaleStart && step2.style.display === "block") {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(scaleStart.x, scaleStart.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (scaleEnd && step2.style.display === "block") {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(scaleEnd.x, scaleEnd.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleStart.x, scaleStart.y);
    ctx.lineTo(scaleEnd.x, scaleEnd.y);
    ctx.stroke();
  }

  furniture.forEach(item => drawFurnitureIcon(item));
}

// PNG保存
document.getElementById("saveImageBtn").addEventListener("click", () => {
  const dataUrl = canvas
