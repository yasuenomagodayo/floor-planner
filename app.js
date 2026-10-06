const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

const floorImageInput = document.getElementById("floorImageInput");
const scaleCmInput = document.getElementById("scaleCmInput");
const setScaleBtn = document.getElementById("setScaleBtn");
const scaleInfo = document.getElementById("scaleInfo");
const palette = document.getElementById("palette");
const addCustomFurnitureBtn = document.getElementById("addCustomFurnitureBtn");

let floorImage = null;

// スケール関連
let scaleSet = false;
let cmPerPixel = 1;
let scaleMode = false;
let scalePoints = [];

// 家具
let furnitureItems = [];
let selectedItem = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// ズーム・回転
let viewScale = 1;
let lastPinchDistance = 0;
let lastRotationAngle = null;

// サイズ変更
let resizingHandle = null;

// 画像アップロード
floorImageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    floorImage = img;
    draw();
  };
  img.src = URL.createObjectURL(file);
});

// スケール設定
setScaleBtn.addEventListener("click", () => {
  scaleMode = true;
  scalePoints = [];
  scaleInfo.textContent = "スケール設定モード：2点タップしてください";
});

// パレットから家具追加
palette.addEventListener("click", (e) => {
  const btn = e.target.closest(".palette-item");
  if (!btn) return;

  const name = btn.textContent.trim();
  const widthCm = parseFloat(btn.dataset.width);
  const depthCm = parseFloat(btn.dataset.depth);

  furnitureItems.push({
    id: Date.now(),
    name,
    widthCm,
    depthCm,
    x: canvas.width / 2,
    y: canvas.height / 2,
    rotation: 0
  });

  draw();
});

// カスタム家具追加
addCustomFurnitureBtn.addEventListener("click", () => {
  const name = document.getElementById("customName").value.trim() || "家具";
  const widthCm = parseFloat(document.getElementById("customWidth").value) || 100;
  const depthCm = parseFloat(document.getElementById("customDepth").value) || 50;

  const btn = document.createElement("button");
  btn.className = "palette-item";
  btn.textContent = `${name} ${widthCm}×${depthCm}`;
  btn.dataset.width = widthCm;
  btn.dataset.depth = depthCm;

  palette.appendChild(btn);
});

// マウス操作
canvas.addEventListener("mousedown", (e) => {
  const { x, y } = getCanvasPos(e.clientX, e.clientY);

  if (scaleMode) return handleScaleClick(x, y);

  const item = hitTestFurniture(x, y);
  if (item) {
    selectedItem = item;
    isDragging = true;
    dragOffset.x = x - item.x;
    dragOffset.y = y - item.y;
  } else {
    selectedItem = null;
  }
  draw();
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging || !selectedItem) return;

  const { x, y } = getCanvasPos(e.clientX, e.clientY);
  selectedItem.x = x - dragOffset.x;
  selectedItem.y = y - dragOffset.y;

  draw();
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
});

// タッチ操作
canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  const { x, y } = getCanvasPos(t.clientX, t.clientY);

  if (scaleMode) return handleScaleClick(x, y);

  const item = hitTestFurniture(x, y);
  if (item) {
    const handle = hitTestHandle(item, x, y);
    if (handle) {
      resizingHandle = handle;
      selectedItem = item;
      return;
    }

    selectedItem = item;
    isDragging = true;
    dragOffset.x = x - item.x;
    dragOffset.y = y - item.y;
  } else {
    selectedItem = null;
  }
  draw();
});

canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    // ピンチズーム
    const dist = getPinchDistance(e.touches);
    if (lastPinchDistance !== 0) {
      const delta = dist - lastPinchDistance;
      viewScale = Math.min(3, Math.max(0.3, viewScale + delta * 0.005));
      draw();
    }
    lastPinchDistance = dist;

    // 回転
    if (selectedItem) {
      const angle = getTouchAngle(e.touches);
      if (lastRotationAngle !== null) {
        selectedItem.rotation += angle - lastRotationAngle;
        draw();
      }
      lastRotationAngle = angle;
    }
    return;
  }

  // サイズ変更
  if (resizingHandle && selectedItem) {
    const t = e.touches[0];
    const { x, y } = getCanvasPos(t.clientX, t.clientY);

    const dx = x - selectedItem.x;
    const dy = y - selectedItem.y;

    if (["nw", "sw"].includes(resizingHandle))
      selectedItem.widthCm = Math.abs(dx * cmPerPixel * 2);

    if (["ne", "se"].includes(resizingHandle))
      selectedItem.widthCm = Math.abs(dx * cmPerPixel * 2);

    if (["nw", "ne"].includes(resizingHandle))
      selectedItem.depthCm = Math.abs(dy * cmPerPixel * 2);

    if (["sw", "se"].includes(resizingHandle))
      selectedItem.depthCm = Math.abs(dy * cmPerPixel * 2);

    draw();
    return;
  }

  // 移動
  if (!isDragging || !selectedItem) return;

  const t = e.touches[0];
  const { x, y } = getCanvasPos(t.clientX, t.clientY);

  selectedItem.x = x - dragOffset.x;
  selectedItem.y = y - dragOffset.y;

  draw();
});

canvas.addEventListener("touchend", () => {
  isDragging = false;
  resizingHandle = null;
  lastPinchDistance = 0;
  lastRotationAngle = null;
});

// 座標変換（ズーム対応）
function getCanvasPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / viewScale,
    y: (clientY - rect.top) / viewScale
  };
}

// ピンチ距離
function getPinchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// 角度
function getTouchAngle(touches) {
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.atan2(dy, dx);
}

// スケール設定
function handleScaleClick(x, y) {
  scalePoints.push({ x, y });
  if (scalePoints.length === 2) {
    const p1 = scalePoints[0];
    const p2 = scalePoints[1];
    const pixelDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    const cm = parseFloat(scaleCmInput.value) || 300;
    cmPerPixel = cm / pixelDist;
    scaleSet = true;
    scaleMode = false;

    scaleInfo.textContent = `1px ≒ ${cmPerPixel.toFixed(3)} cm`;
    draw();
  }
}

// 家具当たり判定
function hitTestFurniture(x, y) {
  for (let i = furnitureItems.length - 1; i >= 0; i--) {
    const item = furnitureItems[i];
    const wPx = item.widthCm / cmPerPixel;
    const dPx = item.depthCm / cmPerPixel;

    const left = item.x - wPx / 2;
    const right = item.x + wPx / 2;
    const top = item.y - dPx / 2;
    const bottom = item.y + dPx / 2;

    if (x >= left && x <= right && y >= top && y <= bottom)
      return item;
  }
  return null;
}

// ハンドル判定
function hitTestHandle(item, x, y) {
  const wPx = item.widthCm / cmPerPixel;
  const dPx = item.depthCm / cmPerPixel;

  const handles = {
    nw: { x: item.x - wPx/2, y: item.y - dPx/2 },
    ne: { x: item.x + wPx/2, y: item.y - dPx/2 },
    sw: { x: item.x - wPx/2, y: item.y + dPx/2 },
    se: { x: item.x + wPx/2, y: item.y + dPx/2 }
  };

  for (const key in handles) {
    const hx = handles[key].x;
    const hy = handles[key].y;
    if (Math.hypot(x - hx, y - hy) < 15) return key;
  }
  return null;
}

// 描画
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(viewScale, viewScale);

  // 間取り画像
  if (floorImage) {
    const imgAspect = floorImage.width / floorImage.height;
    const canvasAspect = canvas.width / canvas.height;
    let drawWidth, drawHeight;

    if (imgAspect > canvasAspect) {
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgAspect;
    } else {
      drawHeight = canvas.height;
      drawWidth = drawHeight * imgAspect;
    }

    const x = (canvas.width - drawWidth) / 2;
    const y = (canvas.height - drawHeight) / 2;
    ctx.drawImage(floorImage, x, y, drawWidth, drawHeight);
  }

  // スケール線
  if (scalePoints.length === 1) {
    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.arc(scalePoints[0].x, scalePoints[0].y, 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (scalePoints.length === 2) {
    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.moveTo(scalePoints[0].x, scalePoints[0].y);
    ctx.lineTo(scalePoints[1].x, scalePoints[1].y);
    ctx.stroke();
  }

  // 家具描画
  furnitureItems.forEach((item) => {
    const wPx = item.widthCm / cmPerPixel;
    const dPx = item.depthCm / cmPerPixel;

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);

    ctx.fillStyle = item === selectedItem ? "rgba(0,150,255,0.5)" : "rgba(0,0,0,0.3)";
    ctx.strokeStyle = "#000";

    ctx.beginPath();
    ctx.rect(-wPx/2, -dPx/2, wPx, dPx);
    ctx.fill();
    ctx.stroke();

    // ラベル
    ctx.fillStyle = "#000";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(item.name, 0, 0);

    ctx.fillText(`${item.widthCm}×${item.depthCm}cm`, 0, dPx/2 + 12);

    // ハンドル
    drawHandle(-wPx/2,