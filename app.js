// キャンバスとコンテキスト
const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

// 間取り図画像
let floorImage = null;

// 家具データ
let furniture = [];

// 縮尺（1mm あたり何pxか）
let pxPerMm = null;

// ドラッグ・選択用
let draggingItem = null;
let selectedItem = null;
let offsetX = 0;
let offsetY = 0;

// 縮尺設定用
let scaleMode = false;
let scaleStart = null;

// 色
let currentColor = "#888888";
document.getElementById("colorPicker").addEventListener("change", (e) => {
  currentColor = e.target.value;
});

// 間取り図アップロード
document.getElementById("floorImageInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    floorImage = img;
    canvas.width = img.width;
    canvas.height = img.height;
    draw();
  };
  img.src = URL.createObjectURL(file);
});

// 縮尺設定ボタン
document.getElementById("setScaleBtn").addEventListener("click", () => {
  if (!floorImage) {
    alert("先に間取り図をアップロードしてください。");
    return;
  }
  scaleMode = true;
  scaleStart = null;
  document.getElementById("scaleInfo").textContent =
    "縮尺設定モード：実寸が分かる線の始点と終点をクリックしてください。";
});

// 回転ボタン
document.getElementById("rotateSelectedBtn").addEventListener("click", () => {
  if (!selectedItem) {
    alert("回転させる家具をキャンバス上でクリックして選択してください。");
    return;
  }
  selectedItem.rotation = (selectedItem.rotation || 0) + Math.PI / 2;
  draw();
});

// キャンバスのクリック（縮尺設定＆ドラッグ開始＆選択）
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // 縮尺設定モード
  if (scaleMode) {
    if (!scaleStart) {
      scaleStart = { x: mx, y: my };
      document.getElementById("scaleInfo").textContent =
        "終点をクリックしてください。";
    } else {
      const dx = mx - scaleStart.x;
      const dy = my - scaleStart.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      const mmStr = window.prompt("この線の長さ(mm)を入力してください（例：900）");
      const mm = parseFloat(mmStr);
      if (!mm || mm <= 0) {
        alert("正しいmmの値を入力してください。");
      } else {
        pxPerMm = distPx / mm;
        document.getElementById("scaleInfo").textContent =
          `縮尺設定完了：1mm ≒ ${pxPerMm.toFixed(4)} px （推定値です）`;
      }
      scaleMode = false;
      scaleStart = null;
    }
    return;
  }

  // 家具選択＆ドラッグ開始（回転を考慮せずざっくり当たり判定）
  selectedItem = null;
  furniture.forEach(item => {
    const w = item.width;
    const h = item.height;
    const x = item.x;
    const y = item.y;
    if (
      mx >= x &&
      mx <= x + w &&
      my >= y &&
      my <= y + h
    ) {
      draggingItem = item;
      selectedItem = item;
      offsetX = mx - item.x;
      offsetY = my - item.y;
    }
  });

  draw();
});

canvas.addEventListener("mousemove", (e) => {
  if (!draggingItem) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  draggingItem.x = mx - offsetX;
  draggingItem.y = my - offsetY;

  draw();
});

canvas.addEventListener("mouseup", () => {
  draggingItem = null;
});

// 家具プリセット寸法（mm）
const presets = {
  desk:        { w: 1200, h: 600, label: "机（1200×600）", type: "desk" },
  studyDesk:   { w: 1000, h: 600, label: "勉強机（1000×600）", type: "desk" },
  chair:       { w: 400,  h: 400, label: "椅子（400×400）", type: "chair" },
  fridgeSmall: { w: 480,  h: 600, label: "冷蔵庫小（480×600）", type: "fridge" },
  fridgeLarge: { w: 600,  h: 700, label: "冷蔵庫大（600×700）", type: "fridge" },
  washer:      { w: 600,  h: 600, label: "洗濯機（600×600）", type: "washer" }
};

// ベッド追加（日本サイズ）
document.getElementById("addBedBtn").addEventListener("click", () => {
  const val = document.getElementById("bedSizeSelect").value;
  let w, h, label, subtype;
  if (val === "single") {
    w = 970; h = 1950; label = "ベッド（シングル）"; subtype = "single";
  } else if (val === "semi") {
    w = 1200; h = 1950; label = "ベッド（セミダブル）"; subtype = "semi";
  } else {
    w = 1400; h = 1950; label = "ベッド（ダブル）"; subtype = "double";
  }
  addFurnitureFromMm(label, w, h, currentColor, "bed", subtype);
});

// ソファ追加
document.getElementById("addSofaBtn").addEventListener("click", () => {
  const val = document.getElementById("sofaSeatSelect").value;
  let w, h, label, subtype;
  if (val === "1") {
    w = 800; h = 800; label = "ソファ（1人掛け）"; subtype = "1";
  } else if (val === "2") {
    w = 1400; h = 800; label = "ソファ（2人掛け）"; subtype = "2";
  } else {
    w = 1800; h = 800; label = "ソファ（3人掛け）"; subtype = "3";
  }
  addFurnitureFromMm(label, w, h, currentColor, "sofa", subtype);
});

// その他プリセット家具
document.querySelectorAll(".presetBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const typeKey = btn.dataset.type;
    const def = presets[typeKey];
    if (!def) return;
    addFurnitureFromMm(def.label, def.w, def.h, currentColor, def.type, null);
  });
});

// 自作家具追加
document.getElementById("addCustomFurnitureBtn").addEventListener("click", () => {
  const name = document.getElementById("customName").value || "家具";
  const wMm = parseFloat(document.getElementById("customWidthMm").value);
  const hMm = parseFloat(document.getElementById("customHeightMm").value);
  const color = document.getElementById("customColor").value;

  if (!pxPerMm) {
    alert("先に縮尺を設定してください。");
    return;
  }
  if (!wMm || !hMm || wMm <= 0 || hMm <= 0) {
    alert("幅と奥行(mm)を正しく入力してください。");
    return;
  }

  const label = `${name}（${wMm}×${hMm}mm）`;
  addFurnitureFromMm(label, wMm, hMm, color, "custom", null);
});

// mmから家具を追加
function addFurnitureFromMm(label, wMm, hMm, color, type, subtype) {
  if (!pxPerMm) {
    alert("先に縮尺を設定してください。");
    return;
  }

  const wPx = wMm * pxPerMm;
  const hPx = hMm * pxPerMm;

  const item = {
    x: 50,
    y: 50,
    width: wPx,
    height: hPx,
    color,
    label,
    type,
    subtype,
    rotation: 0
  };

  furniture.push(item);
  draw();
}

// 家具アイコン描画（本格め）
function drawFurnitureIcon(item) {
  const w = item.width;
  const h = item.height;

  // アイコンはローカル座標（0,0〜w,h）で描く
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
      // 布団枠
      ctx.strokeRect(4, 4, w - 8, h - 8);
      // 枕
      const pillowH = h * 0.15;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(8, 8, w - 16, pillowH);
      ctx.strokeRect(8, 8, w - 16, pillowH);
      break;

    case "sofa":
      // 背もたれ
      const backH = h * 0.35;
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(4, 4, w - 8, backH);
      ctx.strokeRect(4, 4, w - 8, backH);
      // 座面
      const seatY = backH + 6;
      const seatH = h - seatY - 6;
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(4, seatY, w - 8, seatH);
      ctx.strokeRect(4, seatY, w - 8, seatH);
      break;

    case "desk":
      // 天板
      ctx.strokeRect(4, 4, w - 8, h - 8);
      // 脚
      ctx.beginPath();
      ctx.moveTo(10, h - 6);
      ctx.lineTo(10, h - 20);
      ctx.moveTo(w - 10, h - 6);
      ctx.lineTo(w - 10, h - 20);
      ctx.stroke();
      break;

    case "chair":
      // 座面
      const seatSize = Math.min(w, h) * 0.6;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect((w - seatSize) / 2, (h - seatSize) / 2, seatSize, seatSize);
      ctx.strokeRect((w - seatSize) / 2, (h - seatSize) / 2, seatSize, seatSize);
      // 背もたれ
      ctx.beginPath();
      ctx.moveTo(w / 2, (h - seatSize) / 2);
      ctx.lineTo(w / 2, (h - seatSize) / 2 - 10);
      ctx.stroke();
      break;

    case "fridge":
      // 扉の線
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.beginPath();
      ctx.moveTo(w / 2, 6);
      ctx.lineTo(w / 2, h - 6);
      ctx.stroke();
      break;

    case "washer":
      // 本体枠
      ctx.strokeRect(4, 4, w - 8, h - 8);
      // 窓
      const r = Math.min(w, h) * 0.25;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      break;

    default:
      // 汎用家具：枠だけ
      ctx.strokeRect(4, 4, w - 8, h - 8);
      break;
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

  furniture.forEach(item => {
    drawFurnitureIcon(item);
  });
}
