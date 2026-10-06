// キャンバス設定
const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

// 家具データ
let furniture = [];
let currentColor = "#888888";

// ドラッグ用
let draggingItem = null;
let offsetX = 0;
let offsetY = 0;

// 色変更
document.getElementById("colorPicker").addEventListener("change", (e) => {
  currentColor = e.target.value;
});

// 間取り図アップロード
let floorImage = null;

document.getElementById("floorImageInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    floorImage = img;

    // キャンバスを画像サイズに合わせる
    canvas.width = img.width;
    canvas.height = img.height;

    draw();

    document.getElementById("dimensionResult").innerHTML =
      `推定寸法：幅 ${img.width} px × 高さ ${img.height} px<br>
       （※この寸法は推定値です）`;
  };
  img.src = URL.createObjectURL(file);
});

// 家具のデフォルトサイズ
const furnitureDefaults = {
  desk:  { w: 120, h: 40, label: "机" },
  chair: { w: 40,  h: 40, label: "椅子" },
  bed:   { w: 200, h: 100, label: "ベッド" },
  fridge:{ w: 60,  h: 60, label: "冷蔵庫" },
  washer:{ w: 60,  h: 60, label: "洗濯機" }
};

// 家具追加イベント
document.querySelectorAll(".palette-item").forEach(btn => {
  btn.addEventListener("click", () => {
    addFurniture(btn.dataset.type);
  });
});

// 家具追加処理
function addFurniture(type) {
  const def = furnitureDefaults[type];

  const item = {
    type,
    x: 50,
    y: 50,
    width: def.w,
    height: def.h,
    color: currentColor,
    label: def.label
  };

  furniture.push(item);
  draw();
}

// 描画処理
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 間取り図
  if (floorImage) {
    ctx.drawImage(floorImage, 0, 0);
  }

  // 家具描画
  furniture.forEach(item => {
    ctx.fillStyle = item.color;
    ctx.fillRect(item.x, item.y, item.width, item.height);

    ctx.fillStyle = "white";
    ctx.font = "16px sans-serif";
    ctx.fillText(item.label, item.x + 5, item.y + 20);
  });
}

// ドラッグ処理
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

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
