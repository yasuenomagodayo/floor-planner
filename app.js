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

// ドラッグ用
let draggingItem = null;
let offsetX = 0;
let offsetY = 0;

// 縮尺設定用
let scaleMode = false;
let scaleStart = null;
let scaleEnd = null;

// 色
let currentColor = "#888888";
document.getElementById("colorPicker").addEventListener("change", e => {
  currentColor = e.target.value;
});

// STEP UI
document.getElementById("goStep2").addEventListener("click", () => {
  document.getElementById("step1").style.display = "none";
  document.getElementById("step2").style.display = "block";
});

document.getElementById("goStep3").addEventListener("click", () => {
  document.getElementById("step2").style.display = "none";
  document.getElementById("step3").style.display = "block";
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

    // STEP1 → STEP2 を有効化
    document.getElementById("goStep2").disabled = false;
  };
  img.src = URL.createObjectURL(file);
});

// 縮尺設定ボタン
document.getElementById("setScaleBtn").addEventListener("click", () => {
  scaleMode = true;
  scaleStart = null;
  scaleEnd = null;
  document.getElementById("scaleInfo").textContent =
    "縮尺設定モード：線の始点をクリックしてください。";
});

// PC + スマホ共通座標取得
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches.length > 0) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  } else {
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
}

// イベント登録（PC + スマホ）
canvas.addEventListener("mousedown", startDrag);
canvas.addEventListener("mousemove", moveDrag);
canvas.addEventListener("mouseup", endDrag);
canvas.addEventListener("mouseleave", endDrag);

canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  startDrag(e);
});
canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  moveDrag(e);
});
canvas.addEventListener("touchend", e => {
  e.preventDefault();
  endDrag(e);
});

// ドラッグ開始 & 縮尺設定 & 回転アイコン
function startDrag(e) {
  const pos = getPos(e);

  // 縮尺設定モード
  if (scaleMode) {
    if (!scaleStart) {
      scaleStart = pos;
      document.getElementById("scaleInfo").textContent =
        "終点をクリックしてください。";
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
          `縮尺設定完了：1mm ≒ ${pxPerMm.toFixed(4)} px（推定値）`;
        document.getElementById("goStep3").disabled = false;
      } else {
        alert("正しいmmを入力してください");
      }

      scaleMode = false;
    }
    draw();
    return;
  }

  // 家具選択 & 回転アイコン判定
  selectedItem = null;
  draggingItem = null;

  for (const item of furniture) {
    if (hitItem(item, pos.x, pos.y)) {
      selectedItem = item;

      // 回転アイコンを押したか？
      if (hitRotateIcon(item, pos.x, pos.y)) {
        item.rotation = (item.rotation || 0) + Math.PI / 2;
        draw();
        return;
      }

      draggingItem = item;
      offsetX = pos.x - item.x;
      offsetY = pos.y - item.y;
      break;
    }
  }

  draw();
}

// ドラッグ移動
function moveDrag(e) {
  if (!draggingItem) return;
  const pos = getPos(e);

  draggingItem.x = pos.x - offsetX;
  draggingItem.y = pos.y - offsetY;

  draw();
}

// ドラッグ終了
function endDrag() {
  draggingItem = null;
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

// 回転アイコン当たり判定
function hitRotateIcon(item, x, y) {
  const iconSize = 24;
  const ix = item.x + item.width - iconSize;
  const iy = item.y;
  return (
    x >= ix &&
    x <= ix + iconSize &&
    y >= iy &&
    y <= iy + iconSize
  );
}

// 家具追加（mm → px）
function addFurnitureFromMm(label, wMm, hMm, color, type) {
  if (!pxPerMm) {
    alert("先に縮尺を設定してください");
    return;
  }

  const wPx = wMm * pxPerMm;
  const hPx = hMm * pxPerMm;

  furniture.push({
    x: 50,
    y: 50,
    width: wPx,
    height: hPx,
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

// ベッド（日本サイズ）
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

// 家具アイコン描画
function drawFurnitureIcon(item) {
  const w = item.width;
  const h = item.height;

  ctx.save();
  ctx.translate(item.x + w / 2, item.y + h / 2);
  ctx.rotate(item.rotation || 0);
  ctx.translate(-w / 2, -h / 2);

  // 本体
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

  // ラベル
  ctx.fillStyle = "white";
  ctx.font = "12px sans-serif";
  ctx.fillText(item.label, 6, 18);

  // 回転アイコン（右上）
  const iconSize = 24;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.arc(w - iconSize / 2, iconSize / 2, iconSize / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "14px sans-serif";
  ctx.fillText("↻", w - iconSize + 6, iconSize / 2 + 5);

  // 選択中なら枠を強調
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

  // 縮尺の赤点・赤線
  if (scaleStart) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(scaleStart.x, scaleStart.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (scaleEnd) {
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

  furniture.forEach(item => {
    drawFurnitureIcon(item);
  });
}
