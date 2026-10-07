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
    draggingItem
