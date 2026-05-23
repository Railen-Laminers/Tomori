/* ═══════════════════════════════════════════════════════════
   DRIZZLE — cozy hangout · game.js
   Phaser 3 + Socket.io multiplayer
═══════════════════════════════════════════════════════════ */

// ── Socket ──────────────────────────────────────────────
const socket = io();
let myId       = null;
let myUsername = null;
let myRoom     = null;
let players    = {};
let myPlayer   = null;

// ── Cosmetics catalogue ──────────────────────────────────
const HATS = [
  { id: null,      icon: '∅' },
  { id: 'cap',     icon: '🧢' },
  { id: 'witch',   icon: '🎩' },
  { id: 'bow',     icon: '🎀' },
  { id: 'halo',    icon: '😇' },
  { id: 'cowboy',  icon: '🤠' },
  { id: 'crown',   icon: '👑' },
];

const PETS = [
  { id: null,    icon: '∅' },
  { id: 'cat',   icon: '🐱' },
  { id: 'star',  icon: '⭐' },
  { id: 'ghost', icon: '👻' },
  { id: 'orb',   icon: '🔮' },
  { id: 'duck',  icon: '🦆' },
  { id: 'frog',  icon: '🐸' },
];

const MUSIC_TRACKS = [
  'midnight lo-fi rain',
  'rooftop jazz ensemble',
  'gentle static dreams',
  'cassette tape warmth',
  'old radio blues',
];

// ── Depth layers ─────────────────────────────────────────
const DEPTH = {
  BG:           0,
  WORLD:        1,
  DECO:         2,
  RAIN:         5,
  FOG:          4,
  FIRE:         6,
  AMBIENT:      7,
  SHADOW:       9,
  BODY:        10,
  LABEL:       11,
  COSM:        12,
  BUBBLE:      20,
  ZONE_LABEL:  30,
};

// ── Interaction zones ─────────────────────────────────────
const ZONES = [
  { id: 'campfire', x: 280,  y: 340, w: 90,  h: 70,  label: '🔥 campfire',       sitX: 280,  sitY: 370 },
  { id: 'bench1',   x: 620,  y: 240, w: 110, h: 55,  label: '🪑 bench',           sitX: 620,  sitY: 260 },
  { id: 'bench2',   x: 860,  y: 420, w: 110, h: 55,  label: '🪑 bench',           sitX: 860,  sitY: 440 },
  { id: 'vending',  x: 1060, y: 220, w: 65,  h: 100, label: '🥤 vending machine', sitX: 1000, sitY: 255 },
  { id: 'arcade',   x: 470,  y: 480, w: 100, h: 80,  label: '🕹 arcade',          sitX: 470,  sitY: 510 },
  { id: 'lantern1', x: 155,  y: 165, w: 44,  h: 44,  label: '🏮 lantern',         sitX: 200,  sitY: 195 },
  { id: 'lantern2', x: 990,  y: 305, w: 44,  h: 44,  label: '🏮 lantern',         sitX: 945,  sitY: 325 },
  { id: 'rooftop',  x: 760,  y: 570, w: 130, h: 60,  label: '🌆 rooftop edge',    sitX: 820,  sitY: 590 },
];

// ── Phaser ───────────────────────────────────────────────
let game, scene;
const INTERP = 0.14;

// ── Player stores ─────────────────────────────────────────
const PG     = {};  // Graphics (body)
const PL     = {};  // Labels (username)
const PT     = {};  // Targets
const PHAT   = {};  // Hat text objs
const PPET   = {};  // Pet text objs
const PCHAT  = {};  // Chat bubble text objs
const PEMOTE = {};  // Emote text objs
const PCTIMER= {};
const PETIMER= {};

// ── Movement (WASD / arrow keys) ─────────────────────────
let cursors, wasd;
const MOVE_SPEED = 3;
let moveTarget = null;  // {x, y} click-to-move target
let isSitting  = false;

// ── World graphics ───────────────────────────────────────
let worldGfx, zoneGfx, zoneLabel;
let rainGfx, fireGfx, ambientGfx;
let hoverZone = null;

// ── Particle data ─────────────────────────────────────────
const rainParticles   = [];
const fireParticles   = [];
const fogParticles    = [];
const ambientSparkles = [];
let   fireT = 0;

function initGame() {
  const cfg = {
    type: Phaser.AUTO,
    width:  window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    parent: 'game-container',
    scene: { preload, create, update },
    fps: { target: 60 },
  };
  game = new Phaser.Game(cfg);
  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });
}

function preload() {}

function create() {
  scene = this;

  buildWorld(scene);
  buildParticles(scene);

  /* Input */
  cursors = scene.input.keyboard.createCursorKeys();
  wasd = scene.input.keyboard.addKeys({
    up:    Phaser.Input.Keyboard.KeyCodes.W,
    down:  Phaser.Input.Keyboard.KeyCodes.S,
    left:  Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
  });

  scene.input.on('pointerdown', onPointerDown);
}

// ══════════════════════════════════════════════════════════
//  WORLD
// ══════════════════════════════════════════════════════════
function buildWorld(s) {
  worldGfx = s.add.graphics().setDepth(DEPTH.WORLD);
  drawStaticWorld(worldGfx);

  zoneGfx  = s.add.graphics().setDepth(DEPTH.DECO);

  zoneLabel = s.add.text(0, 0, '', {
    fontSize: '12px',
    fontFamily: 'Nunito, sans-serif',
    fontStyle: 'bold',
    color: '#fdf6ec',
    backgroundColor: '#0f3460cc',
    padding: { x: 10, y: 5 },
    borderRadius: 8,
  }).setDepth(DEPTH.ZONE_LABEL).setVisible(false);
}

function drawStaticWorld(g) {
  const W = game.config.width;
  const H = game.config.height;

  // ── Sky gradient (simulated with rects) ──
  g.fillStyle(0x1a1a2e); g.fillRect(0, 0, W, H);
  g.fillStyle(0x16213e, 0.6); g.fillRect(0, H * 0.4, W, H * 0.6);

  // ── Stars in sky ──
  g.fillStyle(0xffffff);
  for (let i = 0; i < 60; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H * 0.45;
    const sr = Math.random() * 1.2 + 0.3;
    g.fillCircle(sx, sy, sr);
  }

  // ── Rooftop floor ──
  g.fillStyle(0x2a3555, 1);
  g.fillRect(50, 130, W - 100, H - 200);

  // Floor tile grid
  g.lineStyle(1, 0x1e2a45, 0.6);
  for (let x = 80; x < W - 50; x += 70) {
    g.beginPath(); g.moveTo(x, 130); g.lineTo(x, H - 70); g.strokePath();
  }
  for (let y = 160; y < H - 90; y += 70) {
    g.beginPath(); g.moveTo(50, y); g.lineTo(W - 50, y); g.strokePath();
  }

  // ── Roof walls / ledges ──
  // Top ledge
  g.fillStyle(0x1e2a45);
  g.fillRect(30, 112, W - 60, 22);
  g.lineStyle(2, 0x3a5080, 0.9);
  g.strokeRect(30, 112, W - 60, 22);

  // Bottom ledge
  g.fillStyle(0x1e2a45);
  g.fillRect(30, H - 85, W - 60, 22);
  g.lineStyle(2, 0x3a5080, 0.9);
  g.strokeRect(30, H - 85, W - 60, 22);

  // Left ledge
  g.fillStyle(0x1e2a45);
  g.fillRect(30, 112, 22, H - 200);

  // Right ledge
  g.fillStyle(0x1e2a45);
  g.fillRect(W - 52, 112, 22, H - 200);

  // ── Water puddles ──
  g.fillStyle(0x1e2d50, 0.55);
  g.fillEllipse(680, 420, 190, 55);
  g.fillEllipse(340, 510, 120, 38);
  g.fillEllipse(960, 260, 95, 30);
  // Shimmer
  g.lineStyle(1, 0x3060a0, 0.35);
  g.strokeEllipse(680, 420, 190, 55);
  g.strokeEllipse(340, 510, 120, 38);

  // ── Campfire scene ──
  drawCampfireBase(g, 280, 340);

  // ── Benches ──
  drawBench(g, 620, 240);
  drawBench(g, 860, 420);

  // ── Vending machine ──
  drawVending(g, 1060, 165);

  // ── Arcade ──
  drawArcade(g, 470, 450);

  // ── Lanterns ──
  drawLantern(g, 155, 135);
  drawLantern(g, 990, 275);

  // ── Rooftop edge bench ──
  g.fillStyle(0x2a3a55);
  g.fillRect(695, 558, 200, 18);
  g.lineStyle(1, 0x4a6a90, 0.7);
  g.strokeRect(695, 558, 200, 18);

  // ── City skyline ──
  drawSkyline(g, W, H);
}

function drawCampfireBase(g, x, y) {
  // Stone ring
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.fillStyle(0x3a4a60);
    g.fillEllipse(x + Math.cos(a) * 28, y + Math.sin(a) * 17, 15, 11);
  }
  // Logs
  g.fillStyle(0x4a2e15);
  g.fillRect(x - 20, y + 3, 40, 9);
  g.fillStyle(0x5a3a1c);
  g.fillRect(x - 14, y - 2, 10, 10);
  g.fillRect(x + 4, y - 2, 10, 10);
}

function drawBench(g, x, y) {
  // Legs
  g.fillStyle(0x3a4a60);
  g.fillRect(x - 38, y + 18, 9, 22);
  g.fillRect(x + 29, y + 18, 9, 22);
  // Seat
  g.fillStyle(0x4a6080);
  g.fillRect(x - 44, y + 10, 88, 13);
  // Back rest
  g.fillStyle(0x4a6080);
  g.fillRect(x - 44, y - 6, 88, 11);
  // Back supports
  g.fillStyle(0x5a7090);
  g.fillRect(x - 38, y - 6, 7, 22);
  g.fillRect(x + 31, y - 6, 7, 22);
}

function drawVending(g, x, y) {
  // Body
  g.fillStyle(0x1e3555);
  g.fillRect(x - 28, y, 56, 95);
  g.lineStyle(1, 0x3a6090, 0.7);
  g.strokeRect(x - 28, y, 56, 95);
  // Screen
  g.fillStyle(0x0a1830);
  g.fillRect(x - 20, y + 8, 40, 32);
  g.fillStyle(0x7cb3ff, 0.25);
  g.fillRect(x - 20, y + 8, 40, 32);
  // Buttons grid
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      g.fillStyle(0x1e3a5a);
      g.fillRect(x - 18 + col * 14, y + 48 + row * 12, 11, 9);
    }
  // Slot
  g.fillStyle(0x4a7090);
  g.fillRect(x + 12, y + 68, 10, 5);
  // Warm glow
  g.fillStyle(0x80c0ff, 0.08);
  g.fillRect(x - 28, y, 56, 95);
}

function drawArcade(g, x, y) {
  // Cabinet
  g.fillStyle(0x1a1a35);
  g.fillRect(x - 38, y, 76, 72);
  g.lineStyle(1, 0x3a3a70, 0.6);
  g.strokeRect(x - 38, y, 76, 72);
  // Screen bezel
  g.fillStyle(0x0a0a1e);
  g.fillRect(x - 30, y + 5, 60, 42);
  // Screen glow
  g.fillStyle(0x7c9cff, 0.18);
  g.fillRect(x - 26, y + 8, 52, 36);
  // Scanlines
  g.lineStyle(1, 0x000030, 0.4);
  for (let sy = y + 8; sy < y + 44; sy += 4) {
    g.beginPath(); g.moveTo(x - 26, sy); g.lineTo(x + 26, sy); g.strokePath();
  }
  // Controls
  g.fillStyle(0x2a2a45);
  g.fillRect(x - 30, y + 52, 60, 16);
  // Buttons
  g.fillStyle(0xff4055);
  g.fillCircle(x + 14, y + 60, 5.5);
  g.fillStyle(0xffee44);
  g.fillCircle(x + 24, y + 60, 5.5);
  // Joystick
  g.fillStyle(0x303050);
  g.fillRect(x - 20, y + 55, 8, 9);
  g.fillStyle(0x5050a0);
  g.fillCircle(x - 16, y + 55, 5);
}

function drawLantern(g, x, y) {
  // Pole
  g.fillStyle(0x3a4a60);
  g.fillRect(x - 4, y + 2, 8, 62);
  // Arm
  g.fillStyle(0x3a4a60);
  g.fillRect(x - 3, y - 28, 6, 32);
  // Lantern body
  g.fillStyle(0x2a3a55);
  g.fillRect(x - 13, y - 46, 26, 26);
  g.lineStyle(1, 0x5a7090, 0.9);
  g.strokeRect(x - 13, y - 46, 26, 26);
  // Lantern glass
  g.fillStyle(0xffd060, 0.22);
  g.fillRect(x - 10, y - 43, 20, 20);
  // Cap
  g.fillStyle(0x3a4a60);
  g.fillRect(x - 16, y - 50, 32, 7);
}

function drawSkyline(g, W, H) {
  const bldgs = [
    { x: 0,     w: 48,  h: 72 },
    { x: 52,    w: 32,  h: 52 },
    { x: 88,    w: 58,  h: 95 },
    { x: W-55,  w: 48,  h: 82 },
    { x: W-108, w: 42,  h: 58 },
    { x: W-155, w: 32,  h: 72 },
  ];
  for (const b of bldgs) {
    g.fillStyle(0x0d1122);
    g.fillRect(b.x, H - 82 - b.h, b.w, b.h);
    // Lit windows
    for (let wy = H - 82 - b.h + 9; wy < H - 92; wy += 14) {
      for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 11) {
        if (Math.random() > 0.42) {
          g.fillStyle(0xffd060, 0.18);
          g.fillRect(wx, wy, 6, 8);
        }
      }
    }
  }
  // Moon
  g.fillStyle(0xfff5c0, 0.9);
  g.fillCircle(W - 80, 55, 22);
  g.fillStyle(0x1a1a2e, 1);
  g.fillCircle(W - 70, 50, 18);
  // Moon glow
  g.fillStyle(0xfff0a0, 0.06);
  g.fillCircle(W - 80, 55, 50);
}

// ══════════════════════════════════════════════════════════
//  PARTICLES
// ══════════════════════════════════════════════════════════
function buildParticles(s) {
  rainGfx    = s.add.graphics().setDepth(DEPTH.RAIN);
  fireGfx    = s.add.graphics().setDepth(DEPTH.FIRE);
  ambientGfx = s.add.graphics().setDepth(DEPTH.AMBIENT);

  for (let i = 0; i < 160; i++) rainParticles.push({
    x: Math.random() * 1600,
    y: Math.random() * 900,
    speed: 4.5 + Math.random() * 5,
    len:   9 + Math.random() * 13,
    alpha: 0.1 + Math.random() * 0.28,
  });

  for (let i = 0; i < 32; i++) fireParticles.push({
    x: 280 + (Math.random() - 0.5) * 18,
    y: 334 + Math.random() * 12,
    vx: (Math.random() - 0.5) * 0.9,
    vy: -(0.5 + Math.random() * 2.2),
    life: Math.random(),
    maxLife: 0.55 + Math.random() * 0.45,
    size: 2.5 + Math.random() * 5,
  });

  for (let i = 0; i < 10; i++) fogParticles.push({
    x: Math.random() * 1600,
    y: Math.random() * 900,
    vx: 0.08 + Math.random() * 0.18,
    alpha: 0.012 + Math.random() * 0.035,
    size: 110 + Math.random() * 210,
  });

  for (let i = 0; i < 22; i++) ambientSparkles.push({
    x: Math.random() * 1400,
    y: Math.random() * 700,
    phase: Math.random() * Math.PI * 2,
    size: 0.8 + Math.random() * 1.8,
  });
}

function tickParticles() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  fireT++;

  /* ── Fog + rain ── */
  rainGfx.clear();

  for (const f of fogParticles) {
    f.x += f.vx;
    if (f.x > W + f.size) f.x = -f.size;
    rainGfx.fillStyle(0x1a2a45, f.alpha);
    rainGfx.fillEllipse(f.x, f.y, f.size, f.size * 0.35);
  }

  for (const r of rainParticles) {
    r.x -= 1.1; r.y += r.speed;
    if (r.y > H || r.x < 0) { r.x = Math.random() * (W + 100) + 50; r.y = -20; }
    rainGfx.lineStyle(1, 0x4a8ab8, r.alpha);
    rainGfx.beginPath();
    rainGfx.moveTo(r.x, r.y);
    rainGfx.lineTo(r.x - r.len * 0.22, r.y + r.len);
    rainGfx.strokePath();
  }

  /* ── Fire ── */
  fireGfx.clear();

  for (const f of fireParticles) {
    f.x += f.vx + Math.sin(fireT * 0.05 + f.life * 10) * 0.28;
    f.y += f.vy;
    f.life += 0.024;
    f.size *= 0.981;

    if (f.life >= f.maxLife || f.size < 0.4) {
      Object.assign(f, {
        x: 280 + (Math.random() - 0.5) * 18,
        y: 334 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.9,
        vy: -(0.4 + Math.random() * 1.6),
        life: 0,
        maxLife: 0.45 + Math.random() * 0.55,
        size: 2.5 + Math.random() * 5,
      });
    }

    const t = f.life / f.maxLife;
    const gr = Math.floor(160 * (1 - t * 0.75));
    const bl = Math.floor(40 * (1 - t));
    fireGfx.fillStyle(Phaser.Display.Color.GetColor(255, gr, bl), (1 - t) * 0.88);
    fireGfx.fillCircle(f.x, f.y, f.size * (1 - t * 0.5));
  }

  // Glow flicker
  const flick = 0.07 + Math.sin(fireT * 0.09) * 0.025 + Math.random() * 0.01;
  fireGfx.fillStyle(0xff8833, flick);
  fireGfx.fillCircle(280, 340, 58 + Math.sin(fireT * 0.13) * 6);

  /* ── Ambient ── */
  ambientGfx.clear();

  // Lantern halos
  const lA = 0.1 + Math.sin(fireT * 0.035) * 0.04;
  ambientGfx.fillStyle(0xffd060, lA);
  ambientGfx.fillCircle(155, 112, 42);
  ambientGfx.fillCircle(990, 263, 38);

  // Campfire area warmth
  ambientGfx.fillStyle(0xff9933, 0.04);
  ambientGfx.fillCircle(280, 340, 100);

  // Sparkles
  for (const a of ambientSparkles) {
    const al = 0.15 + 0.32 * Math.abs(Math.sin(a.phase + fireT * 0.022));
    ambientGfx.fillStyle(0xa0c4ff, al);
    ambientGfx.fillCircle(a.x, a.y, a.size);
  }
}

// ══════════════════════════════════════════════════════════
//  PLAYER VISUALS
// ══════════════════════════════════════════════════════════
const PLAYER_COLORS = ['#FF6B9D','#C77DFF','#72EFDD','#FFB347','#87CEEB','#FF8C69','#98FB98','#DDA0DD','#F0E68C','#87CEFA'];

function createPlayerVisual(id, data) {
  if (PG[id]) return;

  const g = scene.add.graphics().setDepth(DEPTH.BODY);
  PG[id] = g;

  PL[id] = scene.add.text(data.x, data.y - 30, data.username, {
    fontSize: '11px',
    fontFamily: 'Nunito, sans-serif',
    fontStyle: 'bold',
    color: '#fdf6ec',
    stroke: '#0f1430',
    strokeThickness: 4,
  }).setOrigin(0.5, 1).setDepth(DEPTH.LABEL);

  PT[id] = { x: data.x, y: data.y };

  redrawPlayer(id, data);
}

function redrawPlayer(id, data) {
  const g = PG[id];
  if (!g) return;
  g.clear();

  const { x, y, color, sitting } = data;
  const col = parseInt((color || '#87CEEB').replace('#', ''), 16);

  // Shadow
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(x, y + 18, 34, 10);

  // Sitting indicator ring
  if (sitting) {
    g.lineStyle(2, 0xf4a261, 0.5);
    g.strokeEllipse(x, y, 38, 38);
  }

  // Body
  g.fillStyle(col, 1);
  g.fillCircle(x, y, 17);

  // Subtle rim
  g.lineStyle(2, col, 0.28);
  g.strokeCircle(x, y, 21);

  // Blush
  g.fillStyle(col, 0.45);
  g.fillEllipse(x - 9, y + 5, 10, 6);
  g.fillEllipse(x + 9, y + 5, 10, 6);

  // Eyes
  g.fillStyle(0x1a1a2e, 0.85);
  g.fillEllipse(x - 5, y - 3, 6, 7);
  g.fillEllipse(x + 5, y - 3, 6, 7);

  // Eye shine
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(x - 3.5, y - 5, 2);
  g.fillCircle(x + 6.5, y - 5, 2);

  // Smile
  g.lineStyle(2, 0x1a1a2e, 0.6);
  g.beginPath();
  g.arc(x, y + 4, 5, 0.2, Math.PI - 0.2);
  g.strokePath();

  /* Cosmetics */
  const hatIcons = { cap:'🧢', witch:'🎩', bow:'🎀', halo:'😇', cowboy:'🤠', crown:'👑' };
  const petIcons = { cat:'🐱', star:'⭐', ghost:'👻', orb:'🔮', duck:'🦆', frog:'🐸' };

  const hi = data.hat ? hatIcons[data.hat] : null;
  if (hi) {
    if (!PHAT[id]) PHAT[id] = scene.add.text(x, y - 27, hi, { fontSize: '15px' }).setOrigin(0.5, 0.5).setDepth(DEPTH.COSM);
    else { PHAT[id].setText(hi); PHAT[id].setPosition(x, y - 27); }
  } else if (PHAT[id]) PHAT[id].setText('');

  const pi = data.pet ? petIcons[data.pet] : null;
  if (pi) {
    if (!PPET[id]) PPET[id] = scene.add.text(x + 26, y, pi, { fontSize: '13px' }).setOrigin(0.5, 0.5).setDepth(DEPTH.COSM);
    else { PPET[id].setText(pi); PPET[id].setPosition(x + 26, y); }
  } else if (PPET[id]) PPET[id].setText('');
}

function tickPlayer(id) {
  const g  = PG[id];
  const lb = PL[id];
  if (!g || !lb) return;

  const tgt  = PT[id];
  const data = players[id];
  if (!data || !tgt) return;

  data.x += (tgt.x - data.x) * INTERP;
  data.y += (tgt.y - data.y) * INTERP;

  redrawPlayer(id, data);

  lb.setPosition(data.x, data.y - 30);

  const t = scene ? scene.time.now * 0.001 : 0;
  const h = parseInt(id, 36) * 0.1;

  if (PHAT[id]?.text) PHAT[id].setPosition(data.x, data.y - 27 + Math.sin(t * 1.6 + h) * 1.5);
  if (PPET[id]?.text) PPET[id].setPosition(data.x + 26 + Math.sin(t * 2.1) * 4, data.y - 4 + Math.cos(t * 1.6) * 4);
  if (PCHAT[id])  PCHAT[id].setPosition(data.x, data.y - 52);
  if (PEMOTE[id]) PEMOTE[id].setPosition(data.x, data.y - 52);
}

function removePlayerVisual(id) {
  [PG, PL, PHAT, PPET, PCHAT, PEMOTE].forEach(store => {
    if (store[id]) { store[id].destroy(); delete store[id]; }
  });
  if (PCTIMER[id]) { clearTimeout(PCTIMER[id]); delete PCTIMER[id]; }
  if (PETIMER[id]) { clearTimeout(PETIMER[id]); delete PETIMER[id]; }
  delete PT[id];
  delete players[id];
}

// ══════════════════════════════════════════════════════════
//  ZONES
// ══════════════════════════════════════════════════════════
function drawZones() {
  if (!zoneGfx) return;
  zoneGfx.clear();
  for (const z of ZONES) {
    const hov = hoverZone === z.id;
    zoneGfx.lineStyle(1.5, hov ? 0xf4a261 : 0x2a3a60, hov ? 0.9 : 0.28);
    zoneGfx.strokeRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 8);
    if (hov) {
      zoneGfx.fillStyle(0xf4a261, 0.07);
      zoneGfx.fillRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 8);
    }
  }
}

function getZoneAt(x, y) {
  for (const z of ZONES)
    if (x >= z.x - z.w/2 && x <= z.x + z.w/2 && y >= z.y - z.h/2 && y <= z.y + z.h/2) return z;
  return null;
}

// ══════════════════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════════════════
function onPointerDown(ptr) {
  if (!myId || !myRoom) return;

  const zone = getZoneAt(ptr.x, ptr.y);
  if (zone) {
    isSitting = true;
    moveTarget = null;
    socket.emit('sit', { spotId: zone.id, x: zone.sitX, y: zone.sitY });
    if (PT[myId]) { PT[myId].x = zone.sitX; PT[myId].y = zone.sitY; }
    if (players[myId]) players[myId].sitting = true;
  } else {
    isSitting = false;
    moveTarget = { x: ptr.x, y: ptr.y };
    if (players[myId]) players[myId].sitting = false;
  }
}

// ══════════════════════════════════════════════════════════
//  UPDATE LOOP
// ══════════════════════════════════════════════════════════
function update() {
  if (!myRoom) return;

  tickParticles();
  drawZones();

  /* Hover zone label */
  const ptr = this.input.activePointer;
  const hz  = getZoneAt(ptr.x, ptr.y);
  const newHov = hz ? hz.id : null;

  if (newHov !== hoverZone) {
    hoverZone = newHov;
    if (hz) {
      zoneLabel.setText(hz.label);
      zoneLabel.setPosition(ptr.x + 14, ptr.y - 14);
      zoneLabel.setVisible(true);
    } else {
      zoneLabel.setVisible(false);
    }
  }
  if (hz) zoneLabel.setPosition(ptr.x + 14, ptr.y - 14);

  /* ── My player movement ── */
  if (myId && players[myId] && !isSitting) {
    const me = players[myId];
    let dx = 0, dy = 0;

    // Keyboard
    if (cursors.left.isDown  || wasd.left.isDown)  dx -= MOVE_SPEED;
    if (cursors.right.isDown || wasd.right.isDown) dx += MOVE_SPEED;
    if (cursors.up.isDown    || wasd.up.isDown)    dy -= MOVE_SPEED;
    if (cursors.down.isDown  || wasd.down.isDown)  dy += MOVE_SPEED;

    if (dx !== 0 || dy !== 0) {
      moveTarget = null; // cancel click-to-move when keys pressed
      const nx = Math.max(60, Math.min(window.innerWidth  - 60, me.x + dx));
      const ny = Math.max(140, Math.min(window.innerHeight - 90, me.y + dy));
      PT[myId].x = nx;
      PT[myId].y = ny;

      // Throttle server emit: only send every ~4 frames to avoid spam
      if (!update._keyMoveThrottle) update._keyMoveThrottle = 0;
      update._keyMoveThrottle++;
      if (update._keyMoveThrottle % 4 === 0) {
        socket.emit('move', { x: nx, y: ny });
      }
    }

    // Click-to-move: drift toward target
    if (moveTarget) {
      const distX = moveTarget.x - me.x;
      const distY = moveTarget.y - me.y;
      const dist  = Math.sqrt(distX * distX + distY * distY);
      if (dist > 4) {
        const spd = Math.min(MOVE_SPEED * 1.8, dist);
        const nx  = Math.max(60, Math.min(window.innerWidth  - 60, me.x + (distX / dist) * spd));
        const ny  = Math.max(140, Math.min(window.innerHeight - 90, me.y + (distY / dist) * spd));
        PT[myId].x = nx;
        PT[myId].y = ny;

        if (!update._clickMoveThrottle) update._clickMoveThrottle = 0;
        update._clickMoveThrottle++;
        if (update._clickMoveThrottle % 5 === 0) {
          socket.emit('move', { x: nx, y: ny });
        }
      } else {
        socket.emit('move', { x: moveTarget.x, y: moveTarget.y });
        moveTarget = null;
      }
    }
  }

  /* Tick all player visuals */
  for (const id of Object.keys(PG)) tickPlayer(id);
}

// ══════════════════════════════════════════════════════════
//  CHAT BUBBLES
// ══════════════════════════════════════════════════════════
function showChatBubble(id, message) {
  if (PCHAT[id]) PCHAT[id].destroy();
  if (PCTIMER[id]) clearTimeout(PCTIMER[id]);
  const p = players[id];
  if (!p) return;

  PCHAT[id] = scene.add.text(p.x, p.y - 52, message, {
    fontSize: '11px',
    fontFamily: 'Nunito, sans-serif',
    fontStyle: 'bold',
    color: '#fdf6ec',
    backgroundColor: '#0f1a3eee',
    padding: { x: 9, y: 6 },
    wordWrap: { width: 165 },
    borderRadius: 8,
  }).setOrigin(0.5, 1).setDepth(DEPTH.BUBBLE);

  PCTIMER[id] = setTimeout(() => {
    if (PCHAT[id]) { PCHAT[id].destroy(); delete PCHAT[id]; }
  }, 5500);
}

function showEmoteBubble(id, emote) {
  if (PEMOTE[id]) PEMOTE[id].destroy();
  if (PETIMER[id]) clearTimeout(PETIMER[id]);
  const p = players[id];
  if (!p) return;

  const em = scene.add.text(p.x, p.y - 52, emote, {
    fontSize: '26px',
  }).setOrigin(0.5, 1).setDepth(DEPTH.BUBBLE);

  scene.tweens.add({
    targets: em,
    y: p.y - 90,
    alpha: { from: 1, to: 0 },
    duration: 2600,
    ease: 'Power2',
    onComplete: () => { em.destroy(); delete PEMOTE[id]; },
  });

  PEMOTE[id] = em;
}

// ══════════════════════════════════════════════════════════
//  SOCKET EVENTS
// ══════════════════════════════════════════════════════════
socket.on('lobby_joined', ({ username }) => {
  myUsername = username;
  document.getElementById('step-username').style.display = 'none';
  document.getElementById('step-room').style.display    = 'block';
});

socket.on('room_joined', ({ code, player, players: all, musicState }) => {
  myId     = socket.id;
  myRoom   = code;
  myPlayer = player;

  document.getElementById('lobby').style.display         = 'none';
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('room-code-display').textContent = code;

  if (!game) initGame();

  const waitScene = setInterval(() => {
    if (scene) {
      clearInterval(waitScene);
      players = {};
      for (const p of all) {
        players[p.id] = { ...p };
        createPlayerVisual(p.id, p);
      }
      updatePlayerCount();
      updateMusicDisplay(musicState);
    }
  }, 50);
});

socket.on('player_joined', ({ player }) => {
  if (!scene) return;
  players[player.id] = { ...player };
  createPlayerVisual(player.id, player);
  updatePlayerCount();
  addSystemMsg(`${player.username} joined the rooftop 🌧`);
});

socket.on('player_moved', ({ id, x, y, sitting, sittingAt }) => {
  if (!players[id]) return;
  players[id].sitting   = sitting;
  players[id].sittingAt = sittingAt;
  if (PT[id]) { PT[id].x = x; PT[id].y = y; }
});

socket.on('player_left', ({ id }) => {
  if (players[id]) addSystemMsg(`${players[id].username} left`);
  removePlayerVisual(id);
  updatePlayerCount();
});

socket.on('chat_message', ({ id, username, message }) => {
  addChatMsg(username, message, id === myId);
  if (scene) showChatBubble(id, message);
});

socket.on('player_emote', ({ id, emote }) => {
  if (scene) showEmoteBubble(id, emote);
});

socket.on('player_equipped', ({ id, hat, pet }) => {
  if (!players[id]) return;
  players[id].hat = hat;
  players[id].pet = pet;
  redrawPlayer(id, players[id]);
});

socket.on('left_room', () => {
  myRoom = null; myId = null; players = {};
  moveTarget = null; isSitting = false;
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('lobby').style.display         = 'flex';
  document.getElementById('step-room').style.display     = 'block';
  document.getElementById('step-username').style.display = 'none';
  document.getElementById('room-error').textContent      = '';
});

socket.on('error', ({ msg }) => {
  const usHidden = document.getElementById('step-username').style.display === 'none';
  document.getElementById(usHidden ? 'room-error' : 'username-error').textContent = msg;
});

// ══════════════════════════════════════════════════════════
//  UI ACTIONS
// ══════════════════════════════════════════════════════════
function setUsername() {
  const v = document.getElementById('username-input').value.trim();
  if (!v) { document.getElementById('username-error').textContent = 'Pick a name first!'; return; }
  document.getElementById('username-error').textContent = '';
  socket.emit('join_lobby', { username: v });
}

function createRoom() {
  document.getElementById('room-error').textContent = '';
  socket.emit('create_room');
}

function joinRoom() {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code) { document.getElementById('room-error').textContent = 'Enter a room code'; return; }
  document.getElementById('room-error').textContent = '';
  socket.emit('join_room', { code });
}

function leaveRoom() { socket.emit('leave_room'); }

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = '';
  socket.emit('chat', { message: msg });
}

function sendEmote(e) { socket.emit('emote', { emote: e }); }

function addChatMsg(username, message, isMe) {
  const c   = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="sender" style="color:${isMe ? 'var(--warm1)' : 'var(--cozy1)'}">${username}</span>${message}`;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
  while (c.children.length > 40) c.removeChild(c.firstChild);
}

function addSystemMsg(msg) {
  const c   = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  Object.assign(div.style, { color: 'var(--muted)', fontStyle: 'italic' });
  div.textContent = msg;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

function updatePlayerCount() {
  const n = Object.keys(players).length;
  document.getElementById('player-count-text').textContent = `${n} cozy`;
}

function updateMusicDisplay(state) {
  if (!state) return;
  document.getElementById('music-title').textContent = MUSIC_TRACKS[state.track % MUSIC_TRACKS.length];
}

// ══════════════════════════════════════════════════════════
//  COSMETICS UI
// ══════════════════════════════════════════════════════════
function buildCosmeticsUI() {
  const hatGrid = document.getElementById('hat-grid');
  const petGrid = document.getElementById('pet-grid');

  for (const hat of HATS) {
    const d = document.createElement('div');
    d.className = 'cosm-item';
    d.textContent = hat.icon;
    d.title = hat.id || 'none';
    d.onclick = () => {
      hatGrid.querySelectorAll('.cosm-item').forEach(el => el.classList.remove('selected'));
      d.classList.add('selected');
      socket.emit('equip', { hat: hat.id });
      if (players[myId]) { players[myId].hat = hat.id; redrawPlayer(myId, players[myId]); }
    };
    hatGrid.appendChild(d);
  }

  for (const pet of PETS) {
    const d = document.createElement('div');
    d.className = 'cosm-item';
    d.textContent = pet.icon;
    d.title = pet.id || 'none';
    d.onclick = () => {
      petGrid.querySelectorAll('.cosm-item').forEach(el => el.classList.remove('selected'));
      d.classList.add('selected');
      socket.emit('equip', { pet: pet.id });
      if (players[myId]) { players[myId].pet = pet.id; redrawPlayer(myId, players[myId]); }
    };
    petGrid.appendChild(d);
  }
}

function toggleCosmetics() {
  document.getElementById('cosmetics-menu').classList.toggle('open');
}

document.addEventListener('click', e => {
  if (!document.getElementById('cosmetics-panel').contains(e.target))
    document.getElementById('cosmetics-menu').classList.remove('open');
});

// ══════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.stopPropagation(); sendChat(); }
});

document.getElementById('username-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') setUsername();
});

document.getElementById('room-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom();
});

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
buildCosmeticsUI();