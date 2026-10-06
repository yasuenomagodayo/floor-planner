// キャンバスとコンテキスト
const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

// 間取り図画像
let floorImage = null;

// 家具データ
let furniture = [];

// 縮尺（1mm あたり何pxか）
let pxPerMm = null;

// ドラッグ用
let draggingItem = null;
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

// キャンバスのクリック（縮尺設定＆ドラッグ開始）
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

  // 家具ドラッグ開始
  furniture.forEach(item => {
    if (
      mx >= item.x &&
      mx <= item.x + item.width &&
      my >= item.y &&
      my <= item.y + item.height
    ) {
      draggingItem = item;
      offsetX = mx - item.x;
      offsetY = my - item.y;
    }
  });
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
  desk:        { w: 1200, h: 600, label: "机（1200×600）" },
  studyDesk:   { w: 1000, h: 600, label: "勉強机（1000×600）" },
  chair:       { w: 400,  h: 400, label: "椅子（400×400）" },
  fridgeSmall: { w: 480,  h: 600, label: "冷蔵庫小（480×600）" },
  fridgeLarge: { w: 600,  h: 700, label: "冷蔵庫大（600×700）" },
  washer:      { w: 600,  h: 600, label: "洗濯機（600×600）" }
};

// ベッド追加
document.getElementById("addBedBtn").addEventListener("click", () => {
  const val = document.getElementById("bedSizeSelect").value;
  let w, h, label;
  if (val === "single") {
    w = 1000; h = 2000; label = "ベッド（シングル）";
  } else if (val === "semi") {
    w = 1200; h = 2000; label = "ベッド（セミダブル）";
  } else {
    w = 1400; h = 2000; label = "ベッド（ダブル）";
  }
  addFurnitureFromMm(label, w, h, currentColor);
});

// ソファ追加
document.getElementById("addSofaBtn").addEventListener("click", () => {
  const val = document.getElementById("sofaSeatSelect").value;
  let w, h, label;
  if (val === "1") {
    w = 800; h = 800; label = "ソファ（1人掛け）";
  } else if (val === "2") {
    w = 1400; h = 800; label = "ソファ（2人掛け）";
  } else {
    w = 1800; h = 800; label = "ソファ（3人掛け）";
  }
  addFurnitureFromMm(label, w, h, currentColor);
});

// その他プリセット家具
document.querySelectorAll(".presetBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    const def = presets[type];
    if (!def) return;
    addFurnitureFromMm(def.label, def.w, def.h, currentColor);
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
  addFurnitureFromMm(label, wMm, hMm, color);
});

// mmから家具を追加
function addFurnitureFromMm(label, wMm, hMm, color) {
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
    label
  };

  furniture.push(item);
  draw();
}

// 描画
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (floorImage) {
    ctx.drawImage(floorImage, 0, 0);
  }

  furniture.forEach(item => {
    ctx.fillStyle = item.color;
    ctx.fillRect(item.x, item.y, item.width, item.height);

    ctx.fillStyle = "white";
    ctx.font = "14px sans-serif";
    ctx.fillText(item.label, item.x + 5, item.y + 20);
  });
}
