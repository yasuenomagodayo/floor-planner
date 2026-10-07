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

// ===============================
// スマホ座標ズレ補正
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
// STEP切り替え
// ===============================
function showStep(n) {
  document.getElementById("step1").style.display = n === 1 ? "block" : "none";
  document.getElementById("step2").style.display = n === 2 ? "block" : "none";
  document.getElementById("step3").style.display = n === 3 ? "block" : "none";

  canvas.style.touchAction = "auto"; // 基本はスクロール可能
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
// プロジェクト読み込み（STEP1）
document.getElementById("loadProjectInputStep1").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      loadProject(JSON.parse(reader.result));
    } catch {
      alert("プロジェクト読み込みに失敗しました");
    }
  };
  reader.readAsText(file);
});

// ===============================
// プロジェクト読み込み（STEP3）
document.getElementById("loadProjectInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      loadProject(JSON.parse(reader.result));
    } catch {
      alert("プロジェクト読み込みに失敗しました");
    }
  };
  reader.readAsText(file);
});

// ===============================
// プロジェクト読み込み処理
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
// pointer events
// ===============================
canvas.addEventListener("pointerdown", startPointer);
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointerleave", endPointer);

// PC右クリック回転
canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
});

// ===============================
// pointer start
// ===============================
function startPointer(e) {
  const pos = getPos(e);

  // STEP2：縮尺設定
  if (scaleMode) {
    if (!scaleStart) {
      scaleStart = pos;
      document.getElementById("scaleInfo").textContent =
        "終点をタップしてください";
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

// ===============================
// pointer move
// ===============================
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

// ===============================
// pointer end
// ===============================
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
// 距離計算
// ===============================
function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// ===============================
// 家具追加（mm → px）
function addFurnitureFromMm(label, wMm, hMm, type) {
  if (!pxPerMm) {
    alert("先に縮尺を設定してください");
    return;
  }

  furniture.push({
    x: 50,
    y: 50,
    width: wMm * pxPerMm,
    height: hMm * pxPerMm,
    color: "#888888",
    label,
    type,
    rotation: 0
  });

  draw();
}

// ===============================
// 家具追加パネル
// ===============================
document.querySelectorAll(".addBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;

    const sizes = {
      bed: { w: 970, h: 1950, label: "ベッド" },
      sofa: { w: 1400, h: 800, label: "ソファ" },
      desk: { w: 1200, h: 600, label: "机" },
      chair: { w: 400, h: 400, label: "椅子" },
      fridge: { w: 600, h: 700, label: "冷蔵庫" },
      washer: { w: 600, h: 600, label: "洗濯機" }
    };

    const s = sizes[type];
    addFurnitureFromMm(`${s.label}`, s.w, s.h, type);
  });
});

// ===============================
// 家具削除
// ===============================
document.getElementById("deleteSelectedBtn").addEventListener("click", () => {
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
// 家具描画
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

// ===============================
// 描画
// ===============================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (floorImage) {
    ctx.drawImage(floorImage, 0, 0);
  }

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
document.getElementById("saveImageBtn").addEventListener("click", () => {
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "floorplan.png";
  a.click();
});

// ===============================
// 共有
// ===============================
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
      alert("共有に対応していません");
    }
  } catch {
    alert("共有に失敗しました");
  }
});

// ===============================
// プロジェクト保存
// ===============================
document.getElementById("saveProjectBtn").addEventListener("click", () => {
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
// 初期表示
// ===============================
showStep(1);
draw();
