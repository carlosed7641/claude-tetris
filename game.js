'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#9fa8da', // J - pale indigo
  '#ffb74d', // L - orange
  '#90a4ae', // Nut - metallic gray
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const PASTEL_COLORS = [
  null,
  '#a8e6f0', // I
  '#fff0b3', // O
  '#dcb8e6', // T
  '#c3e8c5', // S
  '#f0b8b8', // Z
  '#c9cdf0', // J
  '#f5d3a8', // L
  '#c9d3d8', // Nut
];

const SKINS = {
  retro: { colors: COLORS, glow: false, rounded: false, pattern: false, blackBg: false },
  neon: { colors: COLORS, glow: true, rounded: false, pattern: false, blackBg: true },
  pastel: { colors: PASTEL_COLORS, glow: false, rounded: true, pattern: false, blackBg: false },
  pixel: { colors: COLORS, glow: false, rounded: false, pattern: true, blackBg: false },
};

const SKIN_KEY = 'tetris-skin';
let currentSkin = localStorage.getItem(SKIN_KEY) || 'retro';
if (!SKINS[currentSkin]) currentSkin = 'retro';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const GRID_COLORS = { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.08)' };

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  draw();
}

applyTheme(localStorage.getItem(THEME_KEY) || 'light');

function applySkin(skin) {
  if (!SKINS[skin]) skin = 'retro';
  currentSkin = skin;
  localStorage.setItem(SKIN_KEY, skin);
  if (skinSelect) skinSelect.value = currentSkin;
  draw();
  drawNext();
}

if (skinSelect) skinSelect.value = currentSkin;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawRoundedRect(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
  } else {
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }
}

function drawPixelPattern(context, x, y, s) {
  const cell = Math.max(2, Math.floor(s / 7));
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let yy = 0; yy < s; yy += cell) {
    for (let xx = 0; xx < s; xx += cell) {
      if (((xx / cell) + (yy / cell)) % 2 === 0) {
        context.fillRect(x + xx, y + yy, cell, cell);
      }
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  const color = (skin.colors || COLORS)[colorIndex];
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.save();
  context.globalAlpha = alpha ?? 1;
  if (skin.glow) {
    context.shadowBlur = 15;
    context.shadowColor = color;
  }
  context.fillStyle = color;
  if (skin.rounded) {
    drawRoundedRect(context, px, py, s, s, size * 0.25);
    context.fill();
  } else {
    context.fillRect(px, py, s, s);
  }
  if (!skin.glow) {
    context.fillStyle = 'rgba(255,255,255,0.12)';
    if (skin.rounded) {
      drawRoundedRect(context, px, py, s, 4, 2);
      context.fill();
    } else {
      context.fillRect(px, py, s, 4);
    }
  }
  if (skin.pattern) {
    context.shadowBlur = 0;
    drawPixelPattern(context, px, py, s);
  }
  context.restore();
}

function drawNut(context, ox, oy, size, alpha) {
  const skin = SKINS[currentSkin];
  const color = (skin.colors || COLORS)[8];
  const px = ox * size + 1, py = oy * size + 1, s = size * 3 - 2;
  context.save();
  context.globalAlpha = alpha ?? 1;
  if (skin.glow) {
    context.shadowBlur = 15;
    context.shadowColor = color;
  }
  context.fillStyle = color;
  if (skin.rounded) {
    drawRoundedRect(context, px, py, s, s, size * 0.3);
    context.fill();
  } else {
    context.fillRect(px, py, s, s);
  }
  if (!skin.glow) {
    context.fillStyle = 'rgba(255,255,255,0.12)';
    if (skin.rounded) {
      drawRoundedRect(context, px, py, s, 4, 2);
      context.fill();
    } else {
      context.fillRect(px, py, s, 4);
    }
  }
  if (skin.pattern) {
    drawPixelPattern(context, px, py, s);
  }
  context.shadowBlur = 0;
  const cx = (ox + 1.5) * size, cy = (oy + 1.5) * size;
  context.fillStyle = 'rgba(0,0,0,0.55)';
  context.beginPath();
  context.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].blackBg
    ? 'rgba(255,255,255,0.08)'
    : (GRID_COLORS[document.body.dataset.theme] || GRID_COLORS.light);
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  if (SKINS[currentSkin].blackBg) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  if (current.type === 8) {
    drawNut(ctx, current.x, gy, BLOCK, 0.2);
  } else {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  }

  // current piece
  if (current.type === 8) {
    drawNut(ctx, current.x, current.y, BLOCK);
  } else {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  if (SKINS[currentSkin].blackBg) {
    nextCtx.fillStyle = '#000000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  } else {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  if (next.type === 8) {
    drawNut(nextCtx, offX, offY, NB);
  } else {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggleBtn.addEventListener('click', toggleTheme);
if (skinSelect) skinSelect.addEventListener('change', e => applySkin(e.target.value));

init();
