// client/src/game/GameScene.js
import Phaser from 'phaser';
import { socket } from '../utils/socket';

// Constants
const DEPTH = {
    BG: 0, WORLD: 1, DECO: 2, RAIN: 5, FOG: 4, FIRE: 6,
    AMBIENT: 7, SHADOW: 9, BODY: 10, LABEL: 11, COSM: 12,
    BUBBLE: 20, ZONE_LABEL: 30,
};

const ZONES = [
    { id: 'campfire', x: 280, y: 340, w: 90, h: 70, label: '🔥 campfire', sitX: 280, sitY: 370 },
    { id: 'bench1', x: 620, y: 240, w: 110, h: 55, label: '🪑 bench', sitX: 620, sitY: 260 },
    { id: 'bench2', x: 860, y: 420, w: 110, h: 55, label: '🪑 bench', sitX: 860, sitY: 440 },
    { id: 'vending', x: 1060, y: 220, w: 65, h: 100, label: '🥤 vending machine', sitX: 1000, sitY: 255 },
    { id: 'arcade', x: 470, y: 480, w: 100, h: 80, label: '🕹 arcade', sitX: 470, sitY: 510 },
    { id: 'lantern1', x: 155, y: 165, w: 44, h: 44, label: '🏮 lantern', sitX: 200, sitY: 195 },
    { id: 'lantern2', x: 990, y: 305, w: 44, h: 44, label: '🏮 lantern', sitX: 945, sitY: 325 },
    { id: 'rooftop', x: 760, y: 570, w: 130, h: 60, label: '🌆 rooftop edge', sitX: 820, sitY: 590 },
];

const MOVE_SPEED = 3;
const INTERP = 0.14;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = {};
        this.myId = null;
        this.myUsername = null;
        this.myRoom = null;

        this.PG = {};
        this.PL = {};
        this.PT = {};
        this.PHAT = {};
        this.PPET = {};
        this.PCHAT = {};
        this.PEMOTE = {};
        this.PCTIMER = {};
        this.PETIMER = {};

        this.cursors = null;
        this.wasd = null;
        this.moveTarget = null;
        this.isSitting = false;

        this.worldGfx = null;
        this.zoneGfx = null;
        this.zoneLabel = null;
        this.rainGfx = null;
        this.fireGfx = null;
        this.ambientGfx = null;
        this.hoverZone = null;

        this.rainParticles = [];
        this.fireParticles = [];
        this.fogParticles = [];
        this.ambientSparkles = [];
        this.fireT = 0;

        this._keyMoveThrottle = 0;
        this._clickMoveThrottle = 0;
    }

    preload() {}

    create() {
        // ✅ REMOVED: this.scene = this — was overwriting Phaser's built-in ScenePlugin

        this.buildWorld();
        this.buildParticles();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });
        this.input.on('pointerdown', this.onPointerDown, this);

        // ✅ Register all socket handlers
        socket.on('player_joined', this.onPlayerJoined.bind(this));
        socket.on('player_moved', this.onPlayerMoved.bind(this));
        socket.on('player_left', this.onPlayerLeft.bind(this));
        socket.on('chat_message', this.onChatMessage.bind(this));
        socket.on('player_emote', this.onPlayerEmote.bind(this));
        socket.on('player_equipped', this.onPlayerEquipped.bind(this));
        socket.on('left_room', this.onLeftRoom.bind(this));
        socket.on('room_joined', this.onRoomJoined.bind(this));

        // ✅ Pick up room data that arrived before the scene was ready
        if (window.__pendingRoomData) {
            this.onRoomJoined(window.__pendingRoomData);
            window.__pendingRoomData = null;
        }
    }

    update(time, delta) {
        if (!this.myRoom) return;

        this.tickParticles();
        this.drawZones();

        const ptr = this.input.activePointer;
        const hz = this.getZoneAt(ptr.x, ptr.y);
        const newHov = hz ? hz.id : null;
        if (newHov !== this.hoverZone) {
            this.hoverZone = newHov;
            if (hz) {
                this.zoneLabel.setText(hz.label);
                this.zoneLabel.setPosition(ptr.x + 14, ptr.y - 14);
                this.zoneLabel.setVisible(true);
            } else {
                this.zoneLabel.setVisible(false);
            }
        }
        if (hz) this.zoneLabel.setPosition(ptr.x + 14, ptr.y - 14);

        if (this.myId && this.players[this.myId] && !this.isSitting) {
            const me = this.players[this.myId];
            let dx = 0, dy = 0;

            if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= MOVE_SPEED;
            if (this.cursors.right.isDown || this.wasd.right.isDown) dx += MOVE_SPEED;
            if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= MOVE_SPEED;
            if (this.cursors.down.isDown || this.wasd.down.isDown) dy += MOVE_SPEED;

            if (dx !== 0 || dy !== 0) {
                this.moveTarget = null;
                const nx = Math.max(60, Math.min(window.innerWidth - 60, me.x + dx));
                const ny = Math.max(140, Math.min(window.innerHeight - 90, me.y + dy));
                this.PT[this.myId].x = nx;
                this.PT[this.myId].y = ny;

                this._keyMoveThrottle++;
                if (this._keyMoveThrottle % 4 === 0) {
                    socket.emit('move', { x: nx, y: ny });
                }
            }

            if (this.moveTarget) {
                const distX = this.moveTarget.x - me.x;
                const distY = this.moveTarget.y - me.y;
                const dist = Math.hypot(distX, distY);
                if (dist > 4) {
                    const spd = Math.min(MOVE_SPEED * 1.8, dist);
                    const nx = Math.max(60, Math.min(window.innerWidth - 60, me.x + (distX / dist) * spd));
                    const ny = Math.max(140, Math.min(window.innerHeight - 90, me.y + (distY / dist) * spd));
                    this.PT[this.myId].x = nx;
                    this.PT[this.myId].y = ny;

                    this._clickMoveThrottle++;
                    if (this._clickMoveThrottle % 5 === 0) {
                        socket.emit('move', { x: nx, y: ny });
                    }
                } else {
                    socket.emit('move', { x: this.moveTarget.x, y: this.moveTarget.y });
                    this.moveTarget = null;
                }
            }
        }

        for (const id of Object.keys(this.PG)) {
            this.tickPlayer(id);
        }
    }

    // ---------- World drawing ----------
    buildWorld() {
        this.worldGfx = this.add.graphics().setDepth(DEPTH.WORLD);
        this.drawStaticWorld(this.worldGfx);

        this.zoneGfx = this.add.graphics().setDepth(DEPTH.DECO);
        this.zoneLabel = this.add.text(0, 0, '', {
            fontSize: '12px',
            fontFamily: 'Nunito, sans-serif',
            fontStyle: 'bold',
            color: '#fdf6ec',
            backgroundColor: '#0f3460cc',
            padding: { x: 10, y: 5 },
            borderRadius: 8,
        }).setDepth(DEPTH.ZONE_LABEL).setVisible(false);
    }

    drawStaticWorld(g) {
        const W = this.sys.game.config.width;
        const H = this.sys.game.config.height;

        g.fillStyle(0x1a1a2e); g.fillRect(0, 0, W, H);
        g.fillStyle(0x16213e, 0.6); g.fillRect(0, H * 0.4, W, H * 0.6);

        g.fillStyle(0xffffff);
        for (let i = 0; i < 60; i++) {
            const sx = Math.random() * W;
            const sy = Math.random() * H * 0.45;
            const sr = Math.random() * 1.2 + 0.3;
            g.fillCircle(sx, sy, sr);
        }

        g.fillStyle(0x2a3555, 1);
        g.fillRect(50, 130, W - 100, H - 200);
        g.lineStyle(1, 0x1e2a45, 0.6);
        for (let x = 80; x < W - 50; x += 70) {
            g.beginPath(); g.moveTo(x, 130); g.lineTo(x, H - 70); g.strokePath();
        }
        for (let y = 160; y < H - 90; y += 70) {
            g.beginPath(); g.moveTo(50, y); g.lineTo(W - 50, y); g.strokePath();
        }

        g.fillStyle(0x1e2a45);
        g.fillRect(30, 112, W - 60, 22);
        g.lineStyle(2, 0x3a5080, 0.9);
        g.strokeRect(30, 112, W - 60, 22);
        g.fillRect(30, H - 85, W - 60, 22);
        g.strokeRect(30, H - 85, W - 60, 22);
        g.fillRect(30, 112, 22, H - 200);
        g.fillRect(W - 52, 112, 22, H - 200);

        g.fillStyle(0x1e2d50, 0.55);
        g.fillEllipse(680, 420, 190, 55);
        g.fillEllipse(340, 510, 120, 38);
        g.fillEllipse(960, 260, 95, 30);
        g.lineStyle(1, 0x3060a0, 0.35);
        g.strokeEllipse(680, 420, 190, 55);
        g.strokeEllipse(340, 510, 120, 38);

        this.drawCampfireBase(g, 280, 340);
        this.drawBench(g, 620, 240);
        this.drawBench(g, 860, 420);
        this.drawVending(g, 1060, 165);
        this.drawArcade(g, 470, 450);
        this.drawLantern(g, 155, 135);
        this.drawLantern(g, 990, 275);
        g.fillStyle(0x2a3a55);
        g.fillRect(695, 558, 200, 18);
        g.lineStyle(1, 0x4a6a90, 0.7);
        g.strokeRect(695, 558, 200, 18);
        this.drawSkyline(g, W, H);
    }

    drawCampfireBase(g, x, y) {
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2;
            g.fillStyle(0x3a4a60);
            g.fillEllipse(x + Math.cos(a) * 28, y + Math.sin(a) * 17, 15, 11);
        }
        g.fillStyle(0x4a2e15);
        g.fillRect(x - 20, y + 3, 40, 9);
        g.fillStyle(0x5a3a1c);
        g.fillRect(x - 14, y - 2, 10, 10);
        g.fillRect(x + 4, y - 2, 10, 10);
    }

    drawBench(g, x, y) {
        g.fillStyle(0x3a4a60);
        g.fillRect(x - 38, y + 18, 9, 22);
        g.fillRect(x + 29, y + 18, 9, 22);
        g.fillStyle(0x4a6080);
        g.fillRect(x - 44, y + 10, 88, 13);
        g.fillRect(x - 44, y - 6, 88, 11);
        g.fillStyle(0x5a7090);
        g.fillRect(x - 38, y - 6, 7, 22);
        g.fillRect(x + 31, y - 6, 7, 22);
    }

    drawVending(g, x, y) {
        g.fillStyle(0x1e3555);
        g.fillRect(x - 28, y, 56, 95);
        g.lineStyle(1, 0x3a6090, 0.7);
        g.strokeRect(x - 28, y, 56, 95);
        g.fillStyle(0x0a1830);
        g.fillRect(x - 20, y + 8, 40, 32);
        g.fillStyle(0x7cb3ff, 0.25);
        g.fillRect(x - 20, y + 8, 40, 32);
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < 3; col++) {
                g.fillStyle(0x1e3a5a);
                g.fillRect(x - 18 + col * 14, y + 48 + row * 12, 11, 9);
            }
        g.fillStyle(0x4a7090);
        g.fillRect(x + 12, y + 68, 10, 5);
        g.fillStyle(0x80c0ff, 0.08);
        g.fillRect(x - 28, y, 56, 95);
    }

    drawArcade(g, x, y) {
        g.fillStyle(0x1a1a35);
        g.fillRect(x - 38, y, 76, 72);
        g.lineStyle(1, 0x3a3a70, 0.6);
        g.strokeRect(x - 38, y, 76, 72);
        g.fillStyle(0x0a0a1e);
        g.fillRect(x - 30, y + 5, 60, 42);
        g.fillStyle(0x7c9cff, 0.18);
        g.fillRect(x - 26, y + 8, 52, 36);
        g.lineStyle(1, 0x000030, 0.4);
        for (let sy = y + 8; sy < y + 44; sy += 4) {
            g.beginPath(); g.moveTo(x - 26, sy); g.lineTo(x + 26, sy); g.strokePath();
        }
        g.fillStyle(0x2a2a45);
        g.fillRect(x - 30, y + 52, 60, 16);
        g.fillStyle(0xff4055);
        g.fillCircle(x + 14, y + 60, 5.5);
        g.fillStyle(0xffee44);
        g.fillCircle(x + 24, y + 60, 5.5);
        g.fillStyle(0x303050);
        g.fillRect(x - 20, y + 55, 8, 9);
        g.fillStyle(0x5050a0);
        g.fillCircle(x - 16, y + 55, 5);
    }

    drawLantern(g, x, y) {
        g.fillStyle(0x3a4a60);
        g.fillRect(x - 4, y + 2, 8, 62);
        g.fillRect(x - 3, y - 28, 6, 32);
        g.fillStyle(0x2a3a55);
        g.fillRect(x - 13, y - 46, 26, 26);
        g.lineStyle(1, 0x5a7090, 0.9);
        g.strokeRect(x - 13, y - 46, 26, 26);
        g.fillStyle(0xffd060, 0.22);
        g.fillRect(x - 10, y - 43, 20, 20);
        g.fillStyle(0x3a4a60);
        g.fillRect(x - 16, y - 50, 32, 7);
    }

    drawSkyline(g, W, H) {
        const bldgs = [
            { x: 0, w: 48, h: 72 }, { x: 52, w: 32, h: 52 },
            { x: 88, w: 58, h: 95 }, { x: W - 55, w: 48, h: 82 },
            { x: W - 108, w: 42, h: 58 }, { x: W - 155, w: 32, h: 72 }
        ];
        for (const b of bldgs) {
            g.fillStyle(0x0d1122);
            g.fillRect(b.x, H - 82 - b.h, b.w, b.h);
            for (let wy = H - 82 - b.h + 9; wy < H - 92; wy += 14) {
                for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 11) {
                    if (Math.random() > 0.42) {
                        g.fillStyle(0xffd060, 0.18);
                        g.fillRect(wx, wy, 6, 8);
                    }
                }
            }
        }
        g.fillStyle(0xfff5c0, 0.9);
        g.fillCircle(W - 80, 55, 22);
        g.fillStyle(0x1a1a2e, 1);
        g.fillCircle(W - 70, 50, 18);
        g.fillStyle(0xfff0a0, 0.06);
        g.fillCircle(W - 80, 55, 50);
    }

    // ---------- Particles ----------
    buildParticles() {
        this.rainGfx = this.add.graphics().setDepth(DEPTH.RAIN);
        this.fireGfx = this.add.graphics().setDepth(DEPTH.FIRE);
        this.ambientGfx = this.add.graphics().setDepth(DEPTH.AMBIENT);

        for (let i = 0; i < 160; i++) this.rainParticles.push({
            x: Math.random() * 1600, y: Math.random() * 900,
            speed: 4.5 + Math.random() * 5, len: 9 + Math.random() * 13,
            alpha: 0.1 + Math.random() * 0.28
        });
        for (let i = 0; i < 32; i++) this.fireParticles.push({
            x: 280 + (Math.random() - 0.5) * 18, y: 334 + Math.random() * 12,
            vx: (Math.random() - 0.5) * 0.9, vy: -(0.5 + Math.random() * 2.2),
            life: Math.random(), maxLife: 0.55 + Math.random() * 0.45,
            size: 2.5 + Math.random() * 5
        });
        for (let i = 0; i < 10; i++) this.fogParticles.push({
            x: Math.random() * 1600, y: Math.random() * 900,
            vx: 0.08 + Math.random() * 0.18, alpha: 0.012 + Math.random() * 0.035,
            size: 110 + Math.random() * 210
        });
        for (let i = 0; i < 22; i++) this.ambientSparkles.push({
            x: Math.random() * 1400, y: Math.random() * 700,
            phase: Math.random() * Math.PI * 2, size: 0.8 + Math.random() * 1.8
        });
    }

    tickParticles() {
        const W = this.sys.game.config.width;
        const H = this.sys.game.config.height;
        this.fireT++;

        this.rainGfx.clear();
        for (const f of this.fogParticles) {
            f.x += f.vx;
            if (f.x > W + f.size) f.x = -f.size;
            this.rainGfx.fillStyle(0x1a2a45, f.alpha);
            this.rainGfx.fillEllipse(f.x, f.y, f.size, f.size * 0.35);
        }
        for (const r of this.rainParticles) {
            r.x -= 1.1; r.y += r.speed;
            if (r.y > H || r.x < 0) { r.x = Math.random() * (W + 100) + 50; r.y = -20; }
            this.rainGfx.lineStyle(1, 0x4a8ab8, r.alpha);
            this.rainGfx.beginPath();
            this.rainGfx.moveTo(r.x, r.y);
            this.rainGfx.lineTo(r.x - r.len * 0.22, r.y + r.len);
            this.rainGfx.strokePath();
        }

        this.fireGfx.clear();
        for (const f of this.fireParticles) {
            f.x += f.vx + Math.sin(this.fireT * 0.05 + f.life * 10) * 0.28;
            f.y += f.vy;
            f.life += 0.024;
            f.size *= 0.981;
            if (f.life >= f.maxLife || f.size < 0.4) {
                Object.assign(f, {
                    x: 280 + (Math.random() - 0.5) * 18, y: 334 + Math.random() * 10,
                    vx: (Math.random() - 0.5) * 0.9, vy: -(0.4 + Math.random() * 1.6),
                    life: 0, maxLife: 0.45 + Math.random() * 0.55,
                    size: 2.5 + Math.random() * 5
                });
            }
            const t = f.life / f.maxLife;
            const gr = Math.floor(160 * (1 - t * 0.75));
            const bl = Math.floor(40 * (1 - t));
            this.fireGfx.fillStyle(Phaser.Display.Color.GetColor(255, gr, bl), (1 - t) * 0.88);
            this.fireGfx.fillCircle(f.x, f.y, f.size * (1 - t * 0.5));
        }
        const flick = 0.07 + Math.sin(this.fireT * 0.09) * 0.025 + Math.random() * 0.01;
        this.fireGfx.fillStyle(0xff8833, flick);
        this.fireGfx.fillCircle(280, 340, 58 + Math.sin(this.fireT * 0.13) * 6);

        this.ambientGfx.clear();
        const lA = 0.1 + Math.sin(this.fireT * 0.035) * 0.04;
        this.ambientGfx.fillStyle(0xffd060, lA);
        this.ambientGfx.fillCircle(155, 112, 42);
        this.ambientGfx.fillCircle(990, 263, 38);
        this.ambientGfx.fillStyle(0xff9933, 0.04);
        this.ambientGfx.fillCircle(280, 340, 100);
        for (const a of this.ambientSparkles) {
            const al = 0.15 + 0.32 * Math.abs(Math.sin(a.phase + this.fireT * 0.022));
            this.ambientGfx.fillStyle(0xa0c4ff, al);
            this.ambientGfx.fillCircle(a.x, a.y, a.size);
        }
    }

    // ---------- Zones ----------
    getZoneAt(x, y) {
        for (const z of ZONES)
            if (x >= z.x - z.w / 2 && x <= z.x + z.w / 2 && y >= z.y - z.h / 2 && y <= z.y + z.h / 2)
                return z;
        return null;
    }

    drawZones() {
        if (!this.zoneGfx) return;
        this.zoneGfx.clear();
        for (const z of ZONES) {
            const hov = this.hoverZone === z.id;
            this.zoneGfx.lineStyle(1.5, hov ? 0xf4a261 : 0x2a3a60, hov ? 0.9 : 0.28);
            this.zoneGfx.strokeRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 8);
            if (hov) {
                this.zoneGfx.fillStyle(0xf4a261, 0.07);
                this.zoneGfx.fillRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 8);
            }
        }
    }

    // ---------- Player visuals ----------
    createPlayerVisual(id, data) {
        if (this.PG[id]) return;
        const g = this.add.graphics().setDepth(DEPTH.BODY);
        this.PG[id] = g;
        this.PL[id] = this.add.text(data.x, data.y - 30, data.username, {
            fontSize: '11px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
            color: '#fdf6ec', stroke: '#0f1430', strokeThickness: 4
        }).setOrigin(0.5, 1).setDepth(DEPTH.LABEL);
        this.PT[id] = { x: data.x, y: data.y };
        this.redrawPlayer(id, data);
    }

    redrawPlayer(id, data) {
        const g = this.PG[id];
        if (!g) return;
        g.clear();
        const { x, y, color, sitting } = data;
        const col = parseInt((color || '#87CEEB').replace('#', ''), 16);

        g.fillStyle(0x000000, 0.22);
        g.fillEllipse(x, y + 18, 34, 10);
        if (sitting) {
            g.lineStyle(2, 0xf4a261, 0.5);
            g.strokeEllipse(x, y, 38, 38);
        }
        g.fillStyle(col, 1);
        g.fillCircle(x, y, 17);
        g.lineStyle(2, col, 0.28);
        g.strokeCircle(x, y, 21);
        g.fillStyle(col, 0.45);
        g.fillEllipse(x - 9, y + 5, 10, 6);
        g.fillEllipse(x + 9, y + 5, 10, 6);
        g.fillStyle(0x1a1a2e, 0.85);
        g.fillEllipse(x - 5, y - 3, 6, 7);
        g.fillEllipse(x + 5, y - 3, 6, 7);
        g.fillStyle(0xffffff, 0.95);
        g.fillCircle(x - 3.5, y - 5, 2);
        g.fillCircle(x + 6.5, y - 5, 2);
        g.lineStyle(2, 0x1a1a2e, 0.6);
        g.beginPath();
        g.arc(x, y + 4, 5, 0.2, Math.PI - 0.2);
        g.strokePath();

        const hatIcons = { cap: '🧢', witch: '🎩', bow: '🎀', halo: '😇', cowboy: '🤠', crown: '👑' };
        const petIcons = { cat: '🐱', star: '⭐', ghost: '👻', orb: '🔮', duck: '🦆', frog: '🐸' };
        const hi = data.hat ? hatIcons[data.hat] : null;
        if (hi) {
            if (!this.PHAT[id]) this.PHAT[id] = this.add.text(x, y - 27, hi, { fontSize: '15px' }).setOrigin(0.5, 0.5).setDepth(DEPTH.COSM);
            else { this.PHAT[id].setText(hi); this.PHAT[id].setPosition(x, y - 27); }
        } else if (this.PHAT[id]) this.PHAT[id].setText('');
        const pi = data.pet ? petIcons[data.pet] : null;
        if (pi) {
            if (!this.PPET[id]) this.PPET[id] = this.add.text(x + 26, y, pi, { fontSize: '13px' }).setOrigin(0.5, 0.5).setDepth(DEPTH.COSM);
            else { this.PPET[id].setText(pi); this.PPET[id].setPosition(x + 26, y); }
        } else if (this.PPET[id]) this.PPET[id].setText('');
    }

    tickPlayer(id) {
        const g = this.PG[id];
        const lb = this.PL[id];
        if (!g || !lb) return;
        const tgt = this.PT[id];
        const data = this.players[id];
        if (!data || !tgt) return;
        data.x += (tgt.x - data.x) * INTERP;
        data.y += (tgt.y - data.y) * INTERP;
        this.redrawPlayer(id, data);
        lb.setPosition(data.x, data.y - 30);
        const t = this.time.now * 0.001;
        const h = parseInt(id, 36) * 0.1;
        if (this.PHAT[id]?.text) this.PHAT[id].setPosition(data.x, data.y - 27 + Math.sin(t * 1.6 + h) * 1.5);
        if (this.PPET[id]?.text) this.PPET[id].setPosition(data.x + 26 + Math.sin(t * 2.1) * 4, data.y - 4 + Math.cos(t * 1.6) * 4);
        if (this.PCHAT[id]) this.PCHAT[id].setPosition(data.x, data.y - 52);
        if (this.PEMOTE[id]) this.PEMOTE[id].setPosition(data.x, data.y - 52);
    }

    removePlayerVisual(id) {
        [this.PG, this.PL, this.PHAT, this.PPET, this.PCHAT, this.PEMOTE].forEach(store => {
            if (store[id]) { store[id].destroy(); delete store[id]; }
        });
        if (this.PCTIMER[id]) { clearTimeout(this.PCTIMER[id]); delete this.PCTIMER[id]; }
        if (this.PETIMER[id]) { clearTimeout(this.PETIMER[id]); delete this.PETIMER[id]; }
        delete this.PT[id];
        delete this.players[id];
    }

    showChatBubble(id, message) {
        if (this.PCHAT[id]) this.PCHAT[id].destroy();
        if (this.PCTIMER[id]) clearTimeout(this.PCTIMER[id]);
        const p = this.players[id];
        if (!p) return;
        this.PCHAT[id] = this.add.text(p.x, p.y - 52, message, {
            fontSize: '11px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
            color: '#fdf6ec', backgroundColor: '#0f1a3eee', padding: { x: 9, y: 6 },
            wordWrap: { width: 165 }, borderRadius: 8
        }).setOrigin(0.5, 1).setDepth(DEPTH.BUBBLE);
        this.PCTIMER[id] = setTimeout(() => {
            if (this.PCHAT[id]) { this.PCHAT[id].destroy(); delete this.PCHAT[id]; }
        }, 5500);
    }

    showEmoteBubble(id, emote) {
        if (this.PEMOTE[id]) this.PEMOTE[id].destroy();
        if (this.PETIMER[id]) clearTimeout(this.PETIMER[id]);
        const p = this.players[id];
        if (!p) return;
        const em = this.add.text(p.x, p.y - 52, emote, { fontSize: '26px' }).setOrigin(0.5, 1).setDepth(DEPTH.BUBBLE);
        this.tweens.add({
            targets: em,
            y: p.y - 90,
            alpha: { from: 1, to: 0 },
            duration: 2600,
            ease: 'Power2',
            onComplete: () => { em.destroy(); delete this.PEMOTE[id]; }
        });
        this.PEMOTE[id] = em;
    }

    // ---------- Input ----------
    onPointerDown(ptr) {
        if (!this.myId || !this.myRoom) return;
        const zone = this.getZoneAt(ptr.x, ptr.y);
        if (zone) {
            this.isSitting = true;
            this.moveTarget = null;
            socket.emit('sit', { spotId: zone.id, x: zone.sitX, y: zone.sitY });
            if (this.PT[this.myId]) { this.PT[this.myId].x = zone.sitX; this.PT[this.myId].y = zone.sitY; }
            if (this.players[this.myId]) this.players[this.myId].sitting = true;
        } else {
            this.isSitting = false;
            this.moveTarget = { x: ptr.x, y: ptr.y };
            if (this.players[this.myId]) this.players[this.myId].sitting = false;
        }
    }

    // ---------- Socket Handlers ----------
    onRoomJoined({ code, player, players, musicState }) {
        this.myId = socket.id;
        this.myRoom = code;
        this.myUsername = player.username;
        this.players = {};

        // Clear any existing visuals from a previous session
        for (const id of Object.keys(this.PG)) {
            this.removePlayerVisual(id);
        }

        for (const p of players) {
            this.players[p.id] = { ...p };
            this.createPlayerVisual(p.id, p);
        }
        this.PT[this.myId] = { x: player.x, y: player.y };
    }

    onPlayerJoined({ player }) {
        if (!this.players) return;
        this.players[player.id] = { ...player };
        this.createPlayerVisual(player.id, player);
    }

    onPlayerMoved({ id, x, y, sitting, sittingAt }) {
        if (!this.players[id]) return;
        this.players[id].sitting = sitting;
        this.players[id].sittingAt = sittingAt;
        if (this.PT[id]) { this.PT[id].x = x; this.PT[id].y = y; }
    }

    onPlayerLeft({ id }) {
        this.removePlayerVisual(id);
    }

    // ✅ Fixed: use this.sys.isActive() instead of broken this.scene check
    onChatMessage({ id, username, message }) {
        if (!this.sys.isActive()) return;
        this.showChatBubble(id, message);
    }

    onPlayerEmote({ id, emote }) {
        if (!this.sys.isActive()) return;
        this.showEmoteBubble(id, emote);
    }

    onPlayerEquipped({ id, hat, pet }) {
        if (!this.players[id]) return;
        if (hat !== undefined) this.players[id].hat = hat;
        if (pet !== undefined) this.players[id].pet = pet;
        this.redrawPlayer(id, this.players[id]);
    }

    onLeftRoom() {
        for (const id of Object.keys(this.PG)) this.removePlayerVisual(id);
        this.players = {};
        this.myId = null;
        this.myRoom = null;
        this.moveTarget = null;
        this.isSitting = false;

        // ✅ Remove all socket listeners to prevent stacking on rejoin
        socket.off('player_joined');
        socket.off('player_moved');
        socket.off('player_left');
        socket.off('chat_message');
        socket.off('player_emote');
        socket.off('player_equipped');
        socket.off('left_room');
        socket.off('room_joined');
    }
}