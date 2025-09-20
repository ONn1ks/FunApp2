(() => {
  const canvas = document.getElementById("game");
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");

  const hud = {
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    speed: document.getElementById("speed"),
    triangles: document.getElementById("triangle-count"),
  };

  const messageEl = document.getElementById("message");
  const messageTitleEl = document.getElementById("message-title");
  const messageDetailEl = document.getElementById("message-detail");
  const restartButton = document.getElementById("restart");

  const keys = new Set();
  const pointer = { active: false, id: null, x: 0, y: 0 };

  const keyBindings = {
    arrowleft: "left",
    arrowright: "right",
    arrowup: "up",
    arrowdown: "down",
    a: "left",
    d: "right",
    w: "up",
    s: "down",
  };

  const settings = {
    fieldPadding: 28,
    outMargin: 140,
    player: {
      baseRadius: 24,
      minRadius: 12,
      shrinkPerSecond: 0.32,
      baseSpeed: 260,
      speedGrowth: 6.2,
      maxSpeed: 460,
    },
    triangle: {
      baseSpeed: 150,
      speedGrowth: 6.2,
      maxSpeed: 520,
      minSize: 20,
      maxSize: 36,
      sizeGrowth: 0.28,
      collisionScale: 0.58,
    },
    spawn: {
      initialDelay: 0.8,
      baseInterval: 1.4,
      minInterval: 0.32,
      acceleration: 0.018,
      burstAfter: 16,
      burstProbability: 0.32,
    },
  };

  const STORAGE_KEY = "triangleStormBestTime";

  const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: settings.player.baseRadius,
    speed: settings.player.baseSpeed,
  };

  const gameState = {
    active: false,
    elapsed: 0,
    spawnTimer: settings.spawn.initialDelay,
    triangles: [],
    bestTime: 0,
  };

  let lastFrameTime = 0;

  loadBestTime();
  updateHud();

  restartButton?.addEventListener("click", () => {
    resetGame();
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (!gameState.active && !messageEl.classList.contains("hidden") && (key === "enter" || key === " ")) {
      event.preventDefault();
      resetGame();
      return;
    }

    const binding = keyBindings[key];
    if (binding) {
      event.preventDefault();
      keys.add(binding);
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    const binding = keyBindings[key];
    if (binding) {
      keys.delete(binding);
    }
  });

  window.addEventListener("blur", () => {
    keys.clear();
    pointer.active = false;
    pointer.id = null;
    pointer.x = player.x;
    pointer.y = player.y;
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointer.active = true;
    pointer.id = event.pointerId;
    updatePointerPosition(event);
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointer.active || pointer.id !== event.pointerId) {
      return;
    }
    updatePointerPosition(event);
  });

  const endPointer = (event) => {
    if (pointer.id === event.pointerId) {
      pointer.active = false;
      pointer.id = null;
    }
  };

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("lostpointercapture", () => {
    pointer.active = false;
    pointer.id = null;
  });

  resetGame();
  requestAnimationFrame(loop);

  function loop(timestamp) {
    if (!lastFrameTime) {
      lastFrameTime = timestamp;
    }

    const delta = Math.min((timestamp - lastFrameTime) / 1000, 0.12);
    if (gameState.active) {
      updateGame(delta);
    }

    lastFrameTime = timestamp;
    render();
    requestAnimationFrame(loop);
  }

  function resetGame() {
    gameState.active = true;
    gameState.elapsed = 0;
    gameState.spawnTimer = settings.spawn.initialDelay;
    gameState.triangles = [];

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.radius = settings.player.baseRadius;
    player.speed = settings.player.baseSpeed;

    keys.clear();
    pointer.active = false;
    pointer.id = null;
    pointer.x = player.x;
    pointer.y = player.y;

    messageEl.classList.add("hidden");
    messageTitleEl.textContent = "";
    messageDetailEl.textContent = "";

    lastFrameTime = 0;
    updateHud();
  }

  function updateGame(delta) {
    gameState.elapsed += delta;
    gameState.spawnTimer -= delta;

    while (gameState.spawnTimer <= 0) {
      spawnTriangle();
      if (
        gameState.elapsed > settings.spawn.burstAfter &&
        Math.random() < settings.spawn.burstProbability
      ) {
        const extra = Math.min(
          2,
          1 + Math.floor((gameState.elapsed - settings.spawn.burstAfter) / 12)
        );
        for (let i = 0; i < extra; i += 1) {
          spawnTriangle();
        }
      }
      gameState.spawnTimer += nextSpawnInterval();
    }

    updatePlayer(delta);
    updateTriangles(delta);
    updateHud();
  }

  function updatePlayer(delta) {
    player.radius = Math.max(
      settings.player.minRadius,
      player.radius - settings.player.shrinkPerSecond * delta
    );

    const targetSpeed = clamp(
      settings.player.baseSpeed + gameState.elapsed * settings.player.speedGrowth,
      settings.player.baseSpeed,
      settings.player.maxSpeed
    );
    player.speed = targetSpeed;

    const input = movementInput();
    if (input.x !== 0 || input.y !== 0) {
      const length = Math.hypot(input.x, input.y);
      const scale = length > 1 ? 1 / length : 1;
      player.x += input.x * scale * player.speed * delta;
      player.y += input.y * scale * player.speed * delta;
    }

    const minX = settings.fieldPadding + player.radius;
    const maxX = canvas.width - settings.fieldPadding - player.radius;
    const minY = settings.fieldPadding + player.radius;
    const maxY = canvas.height - settings.fieldPadding - player.radius;
    player.x = clamp(player.x, minX, maxX);
    player.y = clamp(player.y, minY, maxY);
  }

  function movementInput() {
    if (pointer.active) {
      const dx = pointer.x - player.x;
      const dy = pointer.y - player.y;
      if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) {
        return { x: 0, y: 0 };
      }
      const scale = player.speed * 0.08;
      return {
        x: clamp(dx / scale, -1, 1),
        y: clamp(dy / scale, -1, 1),
      };
    }

    let x = 0;
    let y = 0;
    if (keys.has("left")) {
      x -= 1;
    }
    if (keys.has("right")) {
      x += 1;
    }
    if (keys.has("up")) {
      y -= 1;
    }
    if (keys.has("down")) {
      y += 1;
    }

    if (x !== 0 || y !== 0) {
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
    }

    return { x, y };
  }

  function updateTriangles(delta) {
    const alive = [];
    const out = settings.outMargin;

    for (const triangle of gameState.triangles) {
      triangle.x += triangle.vx * delta;
      triangle.y += triangle.vy * delta;

      const dx = triangle.x - player.x;
      const dy = triangle.y - player.y;
      const collisionDistance = player.radius + triangle.collisionRadius;
      if (dx * dx + dy * dy <= collisionDistance * collisionDistance) {
        gameOver();
        return;
      }

      if (
        triangle.x < -out ||
        triangle.x > canvas.width + out ||
        triangle.y < -out ||
        triangle.y > canvas.height + out
      ) {
        continue;
      }

      alive.push(triangle);
    }

    gameState.triangles = alive;
  }

  function render() {
    drawBackdrop();
    drawTriangles();
    drawPlayer();
  }

  function drawBackdrop() {
    const { width, height } = canvas;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#060d1c");
    gradient.addColorStop(1, "#0a1428");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const radial = ctx.createRadialGradient(
      width / 2,
      height / 2,
      height * 0.12,
      width / 2,
      height / 2,
      width * 0.9
    );
    radial.addColorStop(0, "rgba(37, 99, 235, 0.08)");
    radial.addColorStop(1, "rgba(15, 23, 42, 0.02)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    const stripes = 8;
    for (let i = 1; i < stripes; i += 1) {
      const y = (height / stripes) * i + Math.sin((gameState.elapsed + i) * 0.8) * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);

    const glow = ctx.createRadialGradient(0, 0, player.radius * 0.2, 0, 0, player.radius);
    glow.addColorStop(0, "#a5f3fc");
    glow.addColorStop(1, "#0ea5e9");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
    ctx.stroke();

    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(94, 234, 212, 0.45)";
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawTriangles() {
    for (const triangle of gameState.triangles) {
      ctx.save();
      ctx.translate(triangle.x, triangle.y);
      ctx.rotate(triangle.rotation);

      const gradient = ctx.createLinearGradient(0, -triangle.size, 0, triangle.size);
      gradient.addColorStop(0, triangle.colorBright);
      gradient.addColorStop(1, triangle.colorDark);
      ctx.fillStyle = gradient;

      ctx.beginPath();
      ctx.moveTo(0, -triangle.size * 0.85);
      ctx.lineTo(triangle.size * 0.75, triangle.size * 0.8);
      ctx.lineTo(-triangle.size * 0.75, triangle.size * 0.8);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(248, 113, 113, 0.7)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function spawnTriangle() {
    const sizeBase = randomBetween(settings.triangle.minSize, settings.triangle.maxSize);
    const size = Math.min(
      sizeBase + gameState.elapsed * settings.triangle.sizeGrowth,
      settings.triangle.maxSize + 8
    );

    const spawn = randomSpawnPosition(size);
    const speed = clamp(
      settings.triangle.baseSpeed + gameState.elapsed * settings.triangle.speedGrowth + randomBetween(-18, 24),
      settings.triangle.baseSpeed,
      settings.triangle.maxSpeed
    );

    const vx = spawn.direction.x * speed;
    const vy = spawn.direction.y * speed;
    const angle = Math.atan2(spawn.direction.y, spawn.direction.x) + Math.PI / 2;

    const hue = (360 + randomBetween(350, 370)) % 360;
    const triangle = {
      x: spawn.x,
      y: spawn.y,
      vx,
      vy,
      size,
      rotation: angle,
      collisionRadius: size * settings.triangle.collisionScale,
      colorBright: `hsl(${hue}, 88%, 66%)`,
      colorDark: `hsl(${hue}, 78%, 46%)`,
    };

    gameState.triangles.push(triangle);
  }

  function randomSpawnPosition(size) {
    const margin = size + 24;
    const xMin = -margin;
    const xMax = canvas.width + margin;
    const yMin = -margin;
    const yMax = canvas.height + margin;
    const side = Math.floor(Math.random() * 4);

    const focusedX = clamp(
      player.x + randomBetween(-canvas.width * 0.45, canvas.width * 0.45),
      xMin,
      xMax
    );
    const focusedY = clamp(
      player.y + randomBetween(-canvas.height * 0.45, canvas.height * 0.45),
      yMin,
      yMax
    );

    switch (side) {
      case 0:
        return {
          x: Math.random() < 0.7 ? focusedX : randomBetween(xMin, xMax),
          y: yMin,
          direction: { x: 0, y: 1 },
        };
      case 1:
        return {
          x: Math.random() < 0.7 ? focusedX : randomBetween(xMin, xMax),
          y: yMax,
          direction: { x: 0, y: -1 },
        };
      case 2:
        return {
          x: xMin,
          y: Math.random() < 0.7 ? focusedY : randomBetween(yMin, yMax),
          direction: { x: 1, y: 0 },
        };
      default:
        return {
          x: xMax,
          y: Math.random() < 0.7 ? focusedY : randomBetween(yMin, yMax),
          direction: { x: -1, y: 0 },
        };
    }
  }

  function nextSpawnInterval() {
    const difficulty = Math.min(gameState.elapsed, 60);
    const base = Math.max(
      settings.spawn.minInterval,
      settings.spawn.baseInterval - difficulty * settings.spawn.acceleration
    );
    const variation = base * 0.35;
    return Math.max(settings.spawn.minInterval, base + randomBetween(-variation, variation * 0.7));
  }

  function gameOver() {
    if (!gameState.active) {
      return;
    }

    gameState.active = false;
    pointer.active = false;
    pointer.id = null;
    keys.clear();

    const finalTime = gameState.elapsed;
    let newRecord = false;
    if (finalTime > gameState.bestTime) {
      gameState.bestTime = finalTime;
      saveBestTime();
      newRecord = true;
    }

    updateHud();

    messageTitleEl.textContent = newRecord ? "Новый рекорд!" : "Треугольники поймали";
    messageDetailEl.textContent = `Твой результат: ${finalTime.toFixed(1)} c. Лучшее время: ${gameState.bestTime.toFixed(1)} c.`;
    messageEl.classList.remove("hidden");
  }

  function updatePointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    pointer.x = (event.clientX - rect.left) * scaleX;
    pointer.y = (event.clientY - rect.top) * scaleY;
  }

  function updateHud() {
    if (hud.time) {
      hud.time.textContent = `${gameState.elapsed.toFixed(1)} c`;
    }
    if (hud.best) {
      hud.best.textContent = `${gameState.bestTime.toFixed(1)} c`;
    }
    if (hud.speed) {
      hud.speed.textContent = `${Math.round(player.speed)} пикс/с`;
    }
    if (hud.triangles) {
      hud.triangles.textContent = `${gameState.triangles.length}`;
    }
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
      // Ignore storage errors (e.g., private mode)
    }
  }

  function saveBestTime() {
    try {
      localStorage.setItem(STORAGE_KEY, gameState.bestTime.toFixed(2));
    } catch (error) {
      // Ignore storage errors
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }
})();
