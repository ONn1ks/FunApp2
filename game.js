const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const timeEl = document.getElementById("time");
const enemyCountEl = document.getElementById("enemy-count");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart");

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const INPUT = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  a: false,
  s: false,
  d: false,
};

const PLAYER_START_RADIUS = 26;
const PLAYER_MIN_RADIUS = 10;
const PLAYER_SHRINK_PER_SEC = 0.9;
const PLAYER_BASE_SPEED = 160; // px per second
const PLAYER_SPEED_GROWTH = 14; // per second

const ENEMY_SIZE = 28;
const ENEMY_BASE_SPEED = 60;
const ENEMY_SPEED_GROWTH = 4;
const ENEMY_SPAWN_INTERVAL = 4.5; // seconds at start
const ENEMY_SPAWN_ACCELERATION = 0.15; // seconds removed every spawn until cap
const ENEMY_MIN_INTERVAL = 1.2;

let player;
let enemies;
let lastFrame = performance.now();
let elapsedTime = 0;
let spawnTimer = 0;
let spawnInterval = ENEMY_SPAWN_INTERVAL;
let running = true;

function resetGame() {
  player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    radius: PLAYER_START_RADIUS,
    speed: PLAYER_BASE_SPEED,
  };
  enemies = [];
  lastFrame = performance.now();
  elapsedTime = 0;
  spawnTimer = 0;
  spawnInterval = ENEMY_SPAWN_INTERVAL;
  running = true;

  messageEl.classList.add("hidden");
  messageEl.textContent = "";
  restartBtn.classList.add("hidden");
  timeEl.textContent = "0.0";
  enemyCountEl.textContent = "0";

  spawnEnemy();
  requestAnimationFrame(loop);
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x;
  let y;

  switch (side) {
    case 0: // top
      x = Math.random() * GAME_WIDTH;
      y = -ENEMY_SIZE;
      break;
    case 1: // right
      x = GAME_WIDTH + ENEMY_SIZE;
      y = Math.random() * GAME_HEIGHT;
      break;
    case 2: // bottom
      x = Math.random() * GAME_WIDTH;
      y = GAME_HEIGHT + ENEMY_SIZE;
      break;
    default: // left
      x = -ENEMY_SIZE;
      y = Math.random() * GAME_HEIGHT;
      break;
  }

  enemies.push({
    x,
    y,
    speed: ENEMY_BASE_SPEED,
  });

  enemyCountEl.textContent = enemies.length.toString();
}

function handleInput(delta) {
  const horizontal = (INPUT.ArrowRight || INPUT.d ? 1 : 0) -
    (INPUT.ArrowLeft || INPUT.a ? 1 : 0);
  const vertical = (INPUT.ArrowDown || INPUT.s ? 1 : 0) -
    (INPUT.ArrowUp || INPUT.w ? 1 : 0);

  if (horizontal === 0 && vertical === 0) {
    return;
  }

  const magnitude = Math.hypot(horizontal, vertical) || 1;
  const normalizedX = horizontal / magnitude;
  const normalizedY = vertical / magnitude;

  player.x += normalizedX * player.speed * delta;
  player.y += normalizedY * player.speed * delta;

  player.x = Math.min(Math.max(player.radius, player.x), GAME_WIDTH - player.radius);
  player.y = Math.min(Math.max(player.radius, player.y), GAME_HEIGHT - player.radius);
}

function updateEnemies(delta) {
  const target = player;

  enemies.forEach((enemy) => {
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const normX = dx / distance;
    const normY = dy / distance;

    enemy.x += normX * enemy.speed * delta;
    enemy.y += normY * enemy.speed * delta;

    enemy.speed = ENEMY_BASE_SPEED + elapsedTime * ENEMY_SPEED_GROWTH;
  });
}

function checkCollisions() {
  return enemies.some((enemy) => {
    const half = ENEMY_SIZE / 2;
    const closestX = clamp(player.x, enemy.x - half, enemy.x + half);
    const closestY = clamp(player.y, enemy.y - half, enemy.y + half);
    const dx = player.x - closestX;
    const dy = player.y - closestY;
    const distanceSq = dx * dx + dy * dy;
    return distanceSq < player.radius * player.radius;
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function draw() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // background grid for ambience
  const gridSize = 60;
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
  ctx.lineWidth = 1;
  for (let x = gridSize / 2; x < GAME_WIDTH; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_HEIGHT);
    ctx.stroke();
  }
  for (let y = gridSize / 2; y < GAME_HEIGHT; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  // player
  ctx.beginPath();
  ctx.fillStyle = "#38bdf8";
  ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
  ctx.shadowBlur = 25;
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // enemies
  ctx.fillStyle = "#f87171";
  enemies.forEach((enemy) => {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate((elapsedTime + enemy.x) * 0.0025);
    ctx.fillRect(-ENEMY_SIZE / 2, -ENEMY_SIZE / 2, ENEMY_SIZE, ENEMY_SIZE);
    ctx.restore();
  });
}

function updatePlayerStats() {
  const shrinkAmount = elapsedTime * PLAYER_SHRINK_PER_SEC;
  player.radius = Math.max(PLAYER_MIN_RADIUS, PLAYER_START_RADIUS - shrinkAmount);
  player.speed = PLAYER_BASE_SPEED + elapsedTime * PLAYER_SPEED_GROWTH;
}

function loop(now) {
  if (!running) {
    return;
  }

  const delta = (now - lastFrame) / 1000;
  lastFrame = now;
  elapsedTime += delta;
  spawnTimer += delta;

  handleInput(delta);
  updateEnemies(delta);
  updatePlayerStats();

  if (spawnTimer >= spawnInterval) {
    spawnEnemy();
    spawnTimer = 0;
    spawnInterval = Math.max(ENEMY_MIN_INTERVAL, spawnInterval - ENEMY_SPAWN_ACCELERATION);
  }

  if (checkCollisions()) {
    endGame();
    return;
  }

  timeEl.textContent = elapsedTime.toFixed(1);
  draw();

  requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  messageEl.textContent = `Поймали! Ты продержался ${elapsedTime.toFixed(1)} секунды.`;
  messageEl.classList.remove("hidden");
  restartBtn.classList.remove("hidden");
}

window.addEventListener("keydown", (event) => {
  if (event.key in INPUT) {
    INPUT[event.key] = true;
    event.preventDefault();
  }

  if (!running && event.key === "Enter") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key in INPUT) {
    INPUT[event.key] = false;
    event.preventDefault();
  }
});

restartBtn.addEventListener("click", resetGame);

resetGame();
