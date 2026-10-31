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

const newHighscoreForm = document.getElementById('new-highscore-form');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const highscorePanel = document.getElementById('highscore-panel');
const highscoreListEl = document.getElementById('highscore-list');
const bestComboValEl = document.getElementById('best-combo-val');
const maxLinesValEl = document.getElementById('max-lines-val');
const resetScoresBtn = document.getElementById('reset-scores-btn');

const startScreen = document.getElementById('start-screen');
const startPlayBtn = document.getElementById('start-play-btn');
const startHighscoreListEl = document.getElementById('start-highscore-list');
const startBestComboValEl = document.getElementById('start-best-combo-val');
const startMaxLinesValEl = document.getElementById('start-max-lines-val');
const startResetScoresBtn = document.getElementById('start-reset-scores-btn');

const THEME_KEY = 'tetris-theme';
const GRID_COLORS = { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.08)' };

const HS_KEY = 'tetris-highscores';
const COMBO_KEY = 'tetris-best-combo';
const MAXLINES_KEY = 'tetris-max-lines';
const MAX_HIGHSCORES = 5;

function loadHighScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(HS_KEY));
    if (Array.isArray(raw)) {
      return raw.filter(e => e && typeof e.score === 'number' && typeof e.name === 'string');
    }
  } catch (e) { /* ignore malformed storage */ }
  return [];
}

function saveHighScores(list) {
  localStorage.setItem(HS_KEY, JSON.stringify(list));
}

function qualifiesForHighScore(candidateScore) {
  const list = loadHighScores();
  return list.length < MAX_HIGHSCORES || candidateScore > list[list.length - 1].score;
}

function loadBestCombo() {
  return parseInt(localStorage.getItem(COMBO_KEY), 10) || 0;
}

function saveBestCombo(v) {
  localStorage.setItem(COMBO_KEY, String(v));
}

function loadMaxLines() {
  return parseInt(localStorage.getItem(MAXLINES_KEY), 10) || 0;
}

function saveMaxLines(v) {
  localStorage.setItem(MAXLINES_KEY, String(v));
}

function renderHighScoreList(listEl, highlight) {
  const list = loadHighScores();
  listEl.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin récords todavía';
    listEl.appendChild(li);
    return;
  }
  list.forEach(entry => {
    const li = document.createElement('li');
    if (highlight && entry.name === highlight.name && entry.score === highlight.score) {
      li.classList.add('highscore-new');
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'highscore-name';
    nameSpan.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'highscore-score';
    scoreSpan.textContent = entry.score.toLocaleString();
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    listEl.appendChild(li);
  });
}

function renderBestStats(comboEl, linesEl2) {
  comboEl.textContent = loadBestCombo();
  linesEl2.textContent = loadMaxLines();
}

function refreshHighScoreUI(highlight) {
  renderHighScoreList(highscoreListEl, highlight);
  renderHighScoreList(startHighscoreListEl, null);
  renderBestStats(bestComboValEl, maxLinesValEl);
  renderBestStats(startBestComboValEl, startMaxLinesValEl);
}

function resetHighScores() {
  localStorage.removeItem(HS_KEY);
  localStorage.removeItem(COMBO_KEY);
  localStorage.removeItem(MAXLINES_KEY);
  refreshHighScoreUI(null);
}

function trySaveHighScore() {
  if (newHighscoreForm.classList.contains('hidden')) return;
  const name = (nameInput.value || '').trim().slice(0, 12) || 'Jugador';
  const entry = { name, score };
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  saveHighScores(list);
  newHighscoreForm.classList.add('hidden');
  refreshHighScoreUI(entry);
}

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
    if (cleared > loadBestCombo()) {
      saveBestCombo(cleared);
      renderBestStats(bestComboValEl, maxLinesValEl);
      renderBestStats(startBestComboValEl, startMaxLinesValEl);
    }
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawNut(context, ox, oy, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = COLORS[8];
  context.fillRect(ox * size + 1, oy * size + 1, size * 3 - 2, size * 3 - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(ox * size + 1, oy * size + 1, size * 3 - 2, 4);
  const cx = (ox + 1.5) * size, cy = (oy + 1.5) * size;
  context.fillStyle = 'rgba(0,0,0,0.55)';
  context.beginPath();
  context.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = GRID_COLORS[document.body.dataset.theme] || GRID_COLORS.light;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
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

  if (lines > loadMaxLines()) {
    saveMaxLines(lines);
  }

  highscorePanel.classList.remove('hidden');
  if (qualifiesForHighScore(score)) {
    newHighscoreForm.classList.remove('hidden');
    nameInput.value = '';
    refreshHighScoreUI(null);
    setTimeout(() => nameInput.focus(), 0);
  } else {
    newHighscoreForm.classList.add('hidden');
    refreshHighScoreUI(null);
  }

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
    newHighscoreForm.classList.add('hidden');
    highscorePanel.classList.add('hidden');
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
  if (!startScreen.classList.contains('hidden')) return;
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
saveScoreBtn.addEventListener('click', trySaveHighScore);
nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') trySaveHighScore();
});
resetScoresBtn.addEventListener('click', resetHighScores);
startResetScoresBtn.addEventListener('click', resetHighScores);

startPlayBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
});

init();
paused = true;
cancelAnimationFrame(animId);
refreshHighScoreUI(null);
startScreen.classList.remove('hidden');
