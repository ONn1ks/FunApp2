(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const hud = {
    time: document.getElementById("time"),
    speed: document.getElementById("speed"),
    enemies: document.getElementById("enemy-count"),
  };

  const messageEl = document.getElementById("message");
  const messageText = document.getElementById("message-text");
  const restartButton = document.getElementById("restart");

  const keys = new Set();
  const pointer = { active: false, id: null, x: 0, y: 0 };

  const keyBindings = {
    arrowup: "up",
    arrowdown: "down",
    arrowleft: "left",
    arrowright: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
  };

  const settings = {
    player: {
      baseRadius: 26,
      minRadius: 9,
      shrinkRate: 0.55, // радиус уменьшается на 0.55 пикселя в секунду
      baseSpeed: 220,
      speedGrowth: 18,
      color: "#38bdf8",
    },
    enemy: {
      baseSpeed: 110,
      speedGrowth: 22,
      baseSize: 30,
      maxSize: 46,
      sizeGrowth: 0.35,
      wobbleStrength: 0.35,
    },
    spawn: {
      initialInterval: 2.4,
      minInterval: 0.7,
      acceleration: 0.055,
    },
  };

  const STORAGE_KEY = "escapeSquaresBestTime";

  const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: settings.player.baseRadius,
    speed: settings.player.baseSpeed,
  };

  const gameState = {
    active: false,
    elapsed: 0,
    lastTimestamp: 0,
    spawnTimer: settings.spawn.initialInterval,
    enemies: [],
    bestTime: 0,
  };

  loadBestTime();

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function loadBestTime() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          gameState.bestTime = parsed;
        }
      }
    } catch (error) {
      // Игнорируем ошибки доступа к хранилищу (например, приватный режим)
    }
  }

  function saveBestTime() {
    try {
      localStorage.setItem(STORAGE_KEY, gameState.bestTime.toFixed(2));
    } catch (error) {
      // Игнорируем ошибки доступа к хранилищу
    }
  }

  function resetGame() {
    gameState.active = true;
    gameState.elapsed = 0;
    gameState.lastTimestamp = 0;
    gameState.spawnTimer = settings.spawn.initialInterval;
    gameState.enemies = [];

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.radius = settings.player.baseRadius;
    player.speed = settings.player.baseSpeed;

    pointer.active = false;
    keys.clear();

    messageEl.classList.add("hidden");
    updateHud();
    spawnEnemy();
  }

  function updatePointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    pointer.x = (event.clientX - rect.left) * scaleX;
    pointer.y = (event.clientY - rect.top) * scaleY;
  }

  function spawnEnemy() {
    const elapsed = gameState.elapsed;
    const size = clamp(
      settings.enemy.baseSize + elapsed * settings.enemy.sizeGrowth + randomBetween(-2, 4),
      settings.enemy.baseSize * 0.85,
      settings.enemy.maxSize
    );

    let spawnPosition = null;
    let attempts = 0;
    const minDistance = 140;
    while (attempts < 12 && (!spawnPosition || distance(spawnPosition, player) < minDistance)) {
      spawnPosition = randomEdgePosition(size);
      attempts += 1;
    }

    const enemy = {
      x: spawnPosition.x,
      y: spawnPosition.y,
      size,
      baseSpeed: settings.enemy.baseSpeed + randomBetween(-10, 30),
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed: randomBetween(0.8, 1.6),
    };

    gameState.enemies.push(enemy);
    updateHud();
  }

  function randomEdgePosition(size) {
    const half = size / 2;
    const margin = 24;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0:
        return {
          x: half + margin,
          y: randomBetween(half + margin, canvas.height - half - margin),
        };
      case 1:
        return {
          x: canvas.width - half - margin,
          y: randomBetween(half + margin, canvas.height - half - margin),
        };
      case 2:
        return {
          x: randomBetween(half + margin, canvas.width - half - margin),
          y: half + margin,
        };
      default:
        return {
          x: randomBetween(half + margin, canvas.width - half - margin),
          y: canvas.height - half - margin,
        };
    }
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function nextSpawnInterval() {
    const base = Math.max(
      settings.spawn.minInterval,
      settings.spawn.initialInterval - settings.spawn.acceleration * gameState.elapsed
    );
    const variation = base * 0.35;
    return clamp(
      base + randomBetween(-variation / 2, variation / 2),
      settings.spawn.minInterval,
      settings.spawn.initialInterval
    );
  }

  function circleSquareCollision(circle, square) {
    const half = square.size / 2;
    const closestX = clamp(circle.x, square.x - half, square.x + half);
    const closestY = clamp(circle.y, square.y - half, square.y + half);
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
  }

  function updateHud() {
    hud.time.textContent = `${gameState.elapsed.toFixed(1)} c`;
    hud.speed.textContent = `${Math.round(player.speed)} ед./с`;
    hud.enemies.textContent = `${gameState.enemies.length}`;
  }

  function endGame() {
    if (!gameState.active) {
      return;
    }

    gameState.active = false;
    pointer.active = false;

    const survived = gameState.elapsed;
    const newRecord = survived > gameState.bestTime;

    if (newRecord) {
      gameState.bestTime = survived;
      saveBestTime();
    }

    const survivedText = survived.toFixed(1);
    const bestText = gameState.bestTime > 0 ? gameState.bestTime.toFixed(1) : survivedText;
    const resultLine = newRecord
      ? "<strong>Новый рекорд!</strong>"
      : `Твой лучший результат: <strong>${bestText} c</strong>.`;

    messageText.innerHTML = `Пойман! Ты продержался <strong>${survivedText} c</strong>.<br />${resultLine}<br /><span class="muted">Нажми Enter или кнопку ниже, чтобы сыграть снова.</span>`;

    messageEl.classList.remove("hidden");
    window.setTimeout(() => restartButton.focus({ preventScroll: true }), 80);
  }

  function update(dt) {
    gameState.elapsed += dt;

    player.radius = clamp(
      settings.player.baseRadius - settings.player.shrinkRate * gameState.elapsed,
      settings.player.minRadius,
      settings.player.baseRadius
    );
    player.speed = settings.player.baseSpeed + settings.player.speedGrowth * gameState.elapsed;

    let moveX = 0;
    let moveY = 0;

    if (keys.has("up")) moveY -= 1;
    if (keys.has("down")) moveY += 1;
    if (keys.has("left")) moveX -= 1;
    if (keys.has("right")) moveX += 1;

    if (pointer.active) {
      const dx = pointer.x - player.x;
      const dy = pointer.y - player.y;
      const pointerDistance = Math.hypot(dx, dy);
      if (pointerDistance > 2) {
        moveX = dx / pointerDistance;
        moveY = dy / pointerDistance;
      }
    }

    if (moveX !== 0 || moveY !== 0) {
      const length = Math.hypot(moveX, moveY) || 1;
      player.x += (moveX / length) * player.speed * dt;
      player.y += (moveY / length) * player.speed * dt;
    }

    player.x = clamp(player.x, player.radius, canvas.width - player.radius);
    player.y = clamp(player.y, player.radius, canvas.height - player.radius);

    gameState.spawnTimer -= dt;
    if (gameState.spawnTimer <= 0) {
      spawnEnemy();
      gameState.spawnTimer = nextSpawnInterval();
    }

    for (const enemy of gameState.enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const baseAngle = Math.atan2(dy, dx);
      const wobble = Math.sin(gameState.elapsed * enemy.wobbleSpeed + enemy.wobbleOffset) * settings.enemy.wobbleStrength;
      const angle = baseAngle + wobble;
      const speed = enemy.baseSpeed + gameState.elapsed * settings.enemy.speedGrowth;

      enemy.x += Math.cos(angle) * speed * dt;
      enemy.y += Math.sin(angle) * speed * dt;

      const half = enemy.size / 2;
      enemy.x = clamp(enemy.x, half, canvas.width - half);
      enemy.y = clamp(enemy.y, half, canvas.height - half);

      if (circleSquareCollision(player, enemy)) {
        endGame();
        break;
      }
    }

    updateHud();
  }

  function drawBackground() {
    const { width, height } = canvas;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const gridSize = 40;
    const offset = (gameState.elapsed * 40) % gridSize;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";

    ctx.beginPath();
    for (let x = -gridSize; x < width + gridSize; x += gridSize) {
      const xPos = x + offset;
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, height);
    }
    for (let y = -gridSize; y < height + gridSize; y += gridSize) {
      const yPos = y + offset;
      ctx.moveTo(0, yPos);
      ctx.lineTo(width, yPos);
    }
    ctx.stroke();
  }

  function drawPlayer() {
    ctx.save();
    ctx.shadowColor = "rgba(56, 189, 248, 0.7)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = settings.player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(226, 232, 240, 0.6)";
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemies() {
    const elapsed = gameState.elapsed;
    for (const enemy of gameState.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const spin = Math.sin(elapsed * enemy.wobbleSpeed + enemy.wobbleOffset) * 0.25;
      ctx.rotate(spin);
      const size = enemy.size;
      const half = size / 2;
      const gradient = ctx.createLinearGradient(-half, -half, half, half);
      gradient.addColorStop(0, "#ef4444");
      gradient.addColorStop(1, "#b91c1c");
      ctx.fillStyle = gradient;
      ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
      ctx.shadowBlur = 16;
      ctx.fillRect(-half, -half, size, size);
      ctx.restore();
    }
  }

  function draw() {
    drawBackground();
    drawEnemies();
    drawPlayer();

    if (!gameState.active) {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  function gameLoop(timestamp) {
    if (!gameState.lastTimestamp) {
      gameState.lastTimestamp = timestamp;
    }
    const delta = (timestamp - gameState.lastTimestamp) / 1000;
    gameState.lastTimestamp = timestamp;

    if (gameState.active) {
      update(Math.min(delta, 0.1));
    }

    draw();
    requestAnimationFrame(gameLoop);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const action = keyBindings[key];
    if (action) {
      event.preventDefault();
      keys.add(action);
      return;
    }

    if (!gameState.active && (event.key === "Enter" || event.code === "Space")) {
      event.preventDefault();
      resetGame();
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    const action = keyBindings[key];
    if (action) {
      event.preventDefault();
      keys.delete(action);
    }
  });

  window.addEventListener("blur", () => {
    keys.clear();
    pointer.active = false;
  });

  restartButton.addEventListener("click", () => {
    resetGame();
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener("pointerdown", (event) => {
    pointer.active = true;
    pointer.id = event.pointerId;
    updatePointerPosition(event);
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointer.active || (pointer.id !== null && event.pointerId !== pointer.id)) {
      return;
    }
    updatePointerPosition(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId === pointer.id) {
      pointer.active = false;
      pointer.id = null;
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener("pointerleave", () => {
    pointer.active = false;
    pointer.id = null;
  });

  resetGame();
  requestAnimationFrame(gameLoop);
})();
