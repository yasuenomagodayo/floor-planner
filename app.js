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

// 色
let currentColor = "#888888";
document.getElementById("colorPicker").addEventListener("change", e => {
  currentColor = e.target.value;
});

// STEP UI
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

function showStep(n) {
  step1.style.display = n === 1 ? "block" : "none";
  step2.style.display = n === 2 ? "block" : "none";
  step3.style.display = n === 3 ? "block" : "none";

  // STEPごとのタッチ設定
  if (n === 1 || n === 2) {
    canvas.style.touchAction = "auto";
  } else {
    canvas.style.touchAction = "none";
  }
}

document.getElementById("goStep2").addEventListener("pointerdown", () => {
  showStep(2);
});

document.getElementById("backToStep1").addEventListener("pointerdown", () => {
  showStep(1);
});

document.getElementById("goStep3").addEventListener("pointerdown", () => {
  // STEP3に進むときに縮尺線を消す
  scaleStart = null;
  scaleEnd = null;
  showStep(3);
  draw();
});

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
canvas.addEventListener("pointerdown", startPointer);
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointerleave", endPointer);

// 右クリックで回転モード開始（PC用）
canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
});

// ポインタ開始
function startPointer(e) {
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

  // STEP3での家具操作
  selectedItem = null;
  draggingItem = null;
  rotationMode = false;
  rotationTarget = null;

  // どの家具に当たったか
  for (const item of furniture) {
    if (hitItem(item, pos.x, pos.y)) {
      selectedItem = item;

      // 中央か端かでモード候補を分ける
      const centerDist = distance(pos.x, pos.y, item.x + item.width / 2, item.y + item.height / 2);
      const edgeMargin = Math.min(item.width, item.height) * 0.2;

      if (centerDist < Math.min(item.width, item.height) / 2 - edgeMargin) {
        // 中央 → 移動候補
        draggingItem = item;
        offsetX = pos.x - item.x;
        offsetY = pos.y - item.y;
      } else {
        // 端 → 回転候補（長押しで回転モード）
        rotationTarget = item;
      }
      break;
    }
  }

  // 長押し判定（回転モード用）
  if (rotationTarget) {
    longPressTimer = setTimeout(() => {
      rotationMode = true;
      draggingItem = null;
    }, LONG_PRESS_MS);
  }

  // 右クリックなら即回転モード
  if (e.button === 2 && selectedItem) {
    rotationMode = true;
    rotationTarget = selectedItem;
    draggingItem = null;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  updateDeleteButtonState();
  draw();
}

// ポインタ移動
function movePointer(e) {
  const pos = getPos(e);

  if (rotationMode && rotationTarget) {
    // 回転モード：中心からの角度で回転
    const cx = rotationTarget.x + rotationTarget.width / 2;
    const cy = rotationTarget.y + rotationTarget.height / 2;
    const angle = Math.atan2(pos.y - cy, pos.x - cx);
    rotationTarget.rotation = angle;
    draw();
    return;
  }

  if (draggingItem) {
    // 移動モード
    draggingItem.x = pos.x - offsetX;
    draggingItem.y = pos.y - offsetY;
    draw();
  }
}

// ポインタ終了
function endPointer() {
  draggingItem = null;
  rotationMode = false;
  rotationTarget = null;
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
  // 回転を考慮せず、軸平行の当たり判定
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

// 選択中家具削除
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

  // 縮尺の赤点・赤線（STEP2のみ）
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

  furniture.forEach(item => {
    drawFurnitureIcon(item);
  });
}

// 画像として保存（PNG）
document.getElementById("saveImageBtn").addEventListener("click", () => {
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "floorplan.png";
  a.click();
});

// 画像共有（Web Share API）
document.getElementById("shareImageBtn").addEventListener("click", async () => {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], "floorplan.png", { type: "image/png" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "間取り図",
        text: "間取り図プランナーで作成したキャンバスです。",
        files: [file]
      });
    } else {
      alert("このブラウザは画像の共有に対応していません。PNG保存してから手動で共有してください。");
    }
  } catch (err) {
    alert("共有に失敗しました。");
  }
});

// プロジェクト保存（JSON）
document.getElementById("saveProjectBtn").addEventListener("click", () => {
  if (!floorImage) {
    alert("まず間取り図をアップロードしてください。");
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

// プロジェクト読み込み（JSON）
document.getElementById("loadProjectInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const project = JSON.parse(reader.result);

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
    } catch (err) {
      alert("プロジェクトファイルの読み込みに失敗しました。");
    }
  };
  reader.readAsText(file);
});

// 初期表示
showStep(1);
draw();
