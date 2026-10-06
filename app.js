// キャンバス設定
const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

// 内部サイズを設定（CSSでは描画されないため）
canvas.width = 800;
canvas.height = 600;

// 間取り図画像
let floorImage = null;

// 家具データ
let furniture = [];

// 現在選択中の色
let currentColor = "#888888";

// 色変更
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
    draw();
  };
  img.src = URL.createObjectURL(file);
});

// 家具追加イベント
document.querySelectorAll(".palette-item").forEach(btn => {
  btn.addEventListener("click", () => {
    addFurniture(btn.dataset.type);
  });
});

// 家具追加処理
function addFurniture(type) {
  const item = {
    type,
    x: 100,
    y: 100,
    width: 80,
    height: 80,
    color: currentColor
  };
  furniture.push(item);
  draw();
}

// 描画処理
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 間取り図
  if (floorImage) {
    ctx.drawImage(floorImage, 0, 0, canvas.width, canvas.height);
  }

  // 家具描画
  furniture.forEach(item => {
    ctx.fillStyle = item.color;
    ctx.fillRect(item.x, item.y, item.width, item.height);
  });
}
