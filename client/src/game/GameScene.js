import Phaser from 'phaser';
import { socket } from '../utils/socket';

const DEPTH = {
    BG: 0, WORLD: 1, DECO: 2, DUST: 5,
    BODY: 10, LABEL: 11, BUBBLE: 20, ZONE_LABEL: 30,
};

const C = {
    BG: 0x1e1b1a,
    WALL: 0x2c2827,
    FLOOR: 0x3a2e2a,
    CARPET: 0x5c3e3a,
    WOOD: 0x4a3228,
    LIGHT: 0xf5d5b8,
    WHITE: 0xfef0e0,
    ACCENT: 0xc97e5a,
    LAMP_GLOW: 0xffcc88,
};

const ZONES = [
    { id: 'sofa', x: 300, y: 340, w: 130, h: 70, label: 'SOFA', sitX: 300, sitY: 370 },
    { id: 'armchair', x: 620, y: 240, w: 90, h: 70, label: 'ARMCHAIR', sitX: 620, sitY: 260 },
    { id: 'cushion', x: 860, y: 420, w: 80, h: 60, label: 'FLOOR CUSHION', sitX: 860, sitY: 440 },
    { id: 'tv_watching', x: 1060, y: 220, w: 100, h: 80, label: 'TV SPOT', sitX: 1060, sitY: 255 },
    { id: 'bookshelf', x: 470, y: 480, w: 70, h: 90, label: 'BOOKSHELF', sitX: 470, sitY: 510 },
    { id: 'lamp_corner', x: 155, y: 165, w: 50, h: 50, label: 'READING NOOK', sitX: 180, sitY: 195 },
    { id: 'window_bench', x: 760, y: 570, w: 130, h: 60, label: 'WINDOW SEAT', sitX: 820, sitY: 590 },
];

const MOVE_SPEED = 3;
const INTERP = 0.14;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = {};
        this.myId = null;
        this.myRoom = null;
        this.PG = {}; this.PL = {}; this.PT = {};
        this.PCHAT = {}; this.PCTIMER = {};
        this.moveTarget = null;
        this.isSitting = false;
        this.hoverZone = null;
        this.dustMotes = [];

        // Bind handlers so we can remove them individually
        this.onPlayerJoined = this.onPlayerJoined.bind(this);
        this.onPlayerMoved = this.onPlayerMoved.bind(this);
        this.onPlayerLeft = this.onPlayerLeft.bind(this);
        this.onChatMessage = this.onChatMessage.bind(this);
        this.onLeftRoom = this.onLeftRoom.bind(this);
        this.onRoomJoined = this.onRoomJoined.bind(this);
    }

    create() {
        this.buildWorld();
        this.initDust();

        this.input.on('pointerdown', this.onPointerDown, this);

        socket.on('player_joined', this.onPlayerJoined);
        socket.on('player_moved', this.onPlayerMoved);
        socket.on('player_left', this.onPlayerLeft);
        socket.on('chat_message', this.onChatMessage);
        socket.on('left_room', this.onLeftRoom);
        socket.on('room_joined', this.onRoomJoined);

        if (window.__pendingRoomData) {
            this.onRoomJoined(window.__pendingRoomData);
            window.__pendingRoomData = null;
        }
    }

    update() {
        if (!this.myRoom) return;

        this.updateDust();
        this.drawZones();

        const ptr = this.input.activePointer;
        const zone = this.getZoneAt(ptr.x, ptr.y);
        if (zone && this.hoverZone !== zone.id) {
            this.hoverZone = zone.id;
            this.zoneLabel.setText(zone.label);
            this.zoneLabel.setPosition(ptr.x + 14, ptr.y - 14);
            this.zoneLabel.setVisible(true);
        } else if (!zone && this.hoverZone) {
            this.hoverZone = null;
            this.zoneLabel.setVisible(false);
        }
        if (zone) this.zoneLabel.setPosition(ptr.x + 14, ptr.y - 14);

        if (this.myId && this.players[this.myId] && !this.isSitting && !this.isChatFocused() && this.moveTarget) {
            const me = this.players[this.myId];
            const dx = this.moveTarget.x - me.x;
            const dy = this.moveTarget.y - me.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 4) {
                const spd = Math.min(MOVE_SPEED * 1.8, dist);
                const nx = Math.max(60, Math.min(window.innerWidth - 60, me.x + (dx / dist) * spd));
                const ny = Math.max(140, Math.min(window.innerHeight - 90, me.y + (dy / dist) * spd));
                this.PT[this.myId] = { x: nx, y: ny };
                socket.emit('move', { x: nx, y: ny });
            } else {
                socket.emit('move', { x: this.moveTarget.x, y: this.moveTarget.y });
                this.moveTarget = null;
            }
        }

        for (const id of Object.keys(this.PG)) this.tickPlayer(id);
    }

    isChatFocused() {
        const active = document.activeElement;
        return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    }

    // ---------- World drawing (unchanged) ----------
    buildWorld() {
        this.worldGfx = this.add.graphics().setDepth(DEPTH.WORLD);
        const W = this.sys.game.config.width;
        const H = this.sys.game.config.height;

        this.worldGfx.fillStyle(C.WALL);
        this.worldGfx.fillRect(0, 0, W, H);

        this.worldGfx.fillStyle(C.FLOOR);
        this.worldGfx.fillRect(0, 130, W, H - 130);
        this.worldGfx.lineStyle(1, 0x2a221f, 0.5);
        for (let y = 140; y < H; y += 35) {
            this.worldGfx.beginPath();
            this.worldGfx.moveTo(0, y);
            this.worldGfx.lineTo(W, y);
            this.worldGfx.strokePath();
        }

        this.worldGfx.fillStyle(C.CARPET, 0.7);
        this.worldGfx.fillRoundedRect(200, 300, 500, 300, 20);
        this.worldGfx.lineStyle(1, C.ACCENT, 0.5);
        this.worldGfx.strokeRoundedRect(200, 300, 500, 300, 20);

        this.worldGfx.fillStyle(C.WOOD);
        this.worldGfx.fillRect(0, 125, W, 8);

        this.drawSofa(300, 340);
        this.drawArmchair(620, 240);
        this.drawFloorCushion(860, 420);
        this.drawTVStand(1060, 210);
        this.drawBookshelf(470, 460);
        this.drawFloorLamp(155, 145);
        this.drawWindowSeat(760, 570);

        this.worldGfx.lineStyle(2, C.ACCENT, 0.7);
        this.worldGfx.strokeRect(150, 60, 80, 60);
        this.worldGfx.strokeRect(W - 250, 60, 80, 60);
        this.worldGfx.fillStyle(C.LIGHT, 0.2);
        this.worldGfx.fillRect(152, 62, 76, 56);
        this.worldGfx.fillRect(W - 248, 62, 76, 56);

        this.worldGfx.fillStyle(C.BG);
        this.worldGfx.fillRect(W - 150, 40, 90, 70);
        this.worldGfx.lineStyle(1, C.LIGHT, 0.4);
        this.worldGfx.strokeRect(W - 150, 40, 90, 70);
        this.worldGfx.lineStyle(1, C.LIGHT, 0.2);
        this.worldGfx.beginPath();
        this.worldGfx.moveTo(W - 105, 40);
        this.worldGfx.lineTo(W - 105, 110);
        this.worldGfx.moveTo(W - 150, 75);
        this.worldGfx.lineTo(W - 60, 75);
        this.worldGfx.strokePath();

        this.zoneLabel = this.add.text(0, 0, '', {
            fontSize: '12px',
            fontFamily: "'VT323', monospace",
            color: '#1e1b1a',
            backgroundColor: '#f5d5b8',
            padding: { x: 6, y: 3 },
        }).setDepth(DEPTH.ZONE_LABEL).setVisible(false);
    }

    // Furniture drawing methods (unchanged)
    drawSofa(x, y) {
        const g = this.worldGfx;
        g.fillStyle(C.ACCENT);
        g.fillRoundedRect(x - 60, y - 20, 120, 50, 15);
        g.fillStyle(C.WOOD);
        g.fillRect(x - 55, y + 25, 12, 15);
        g.fillRect(x + 43, y + 25, 12, 15);
        g.fillStyle(C.LIGHT, 0.4);
        g.fillRoundedRect(x - 50, y - 15, 100, 40, 10);
        g.lineStyle(1, C.WOOD, 0.3);
        g.beginPath();
        g.moveTo(x, y - 15);
        g.lineTo(x, y + 25);
        g.strokePath();
    }

    drawArmchair(x, y) {
        const g = this.worldGfx;
        g.fillStyle(C.ACCENT);
        g.fillRoundedRect(x - 35, y - 20, 70, 50, 12);
        g.fillStyle(C.WOOD);
        g.fillRect(x - 30, y + 25, 10, 12);
        g.fillRect(x + 20, y + 25, 10, 12);
        g.fillStyle(C.LIGHT, 0.4);
        g.fillRoundedRect(x - 28, y - 15, 56, 40, 8);
    }

    drawFloorCushion(x, y) {
        const g = this.worldGfx;
        g.fillStyle(C.CARPET);
        g.fillEllipse(x, y, 45, 25);
        g.fillStyle(C.LIGHT, 0.2);
        g.fillEllipse(x, y - 3, 35, 18);
    }

    drawTVStand(x, y) {
        const g = this.worldGfx;
        g.fillStyle(C.WOOD);
        g.fillRect(x - 45, y, 90, 40);
        g.fillStyle(C.BG);
        g.fillRect(x - 35, y - 35, 70, 35);
        g.fillStyle(C.LIGHT, 0.3);
        g.fillRect(x - 33, y - 33, 66, 31);
        g.fillRect(x - 20, y + 40, 6, 12);
        g.fillRect(x + 14, y + 40, 6, 12);
    }

    drawBookshelf(x, y) {
        const g = this.worldGfx;
        g.fillStyle(C.WOOD);
        g.fillRect(x - 30, y, 60, 85);
        g.fillStyle(C.ACCENT, 0.4);
        for (let i = 0; i < 3; i++) {
            g.fillRect(x - 26, y + 12 + i * 24, 52, 4);
        }
        g.fillStyle(C.LIGHT);
        g.fillRect(x - 18, y + 14, 6, 20);
        g.fillStyle(C.CARPET);
        g.fillRect(x - 6, y + 16, 5, 18);
        g.fillStyle(C.ACCENT);
        g.fillRect(x + 6, y + 12, 7, 22);
    }

    drawFloorLamp(x, y) {
        const g = this.worldGfx;
        g.fillStyle(C.WOOD);
        g.fillRect(x - 3, y, 6, 55);
        g.fillStyle(C.LAMP_GLOW, 0.7);
        g.fillTriangle(x, y - 15, x - 15, y - 35, x + 15, y - 35);
        g.fillStyle(C.LAMP_GLOW, 0.15);
        g.fillCircle(x, y - 25, 35);
    }

    drawWindowSeat(x, y) {
        const g = this.worldGfx;
        g.fillStyle(C.WOOD);
        g.fillRect(x - 60, y - 10, 120, 20);
        g.fillStyle(C.ACCENT);
        g.fillRect(x - 55, y - 25, 110, 15);
        g.fillStyle(C.LIGHT, 0.2);
        g.fillRect(x - 50, y - 23, 100, 11);
    }

    // Dust motes
    initDust() {
        this.dustGfx = this.add.graphics().setDepth(DEPTH.DUST);
        for (let i = 0; i < 60; i++) {
            this.dustMotes.push({
                x: Math.random() * this.sys.game.config.width,
                y: Math.random() * this.sys.game.config.height,
                radius: 1 + Math.random() * 2.5,
                alpha: 0.1 + Math.random() * 0.2,
                speedY: 0.2 + Math.random() * 0.5,
                speedX: (Math.random() - 0.5) * 0.2,
            });
        }
    }

    updateDust() {
        this.dustGfx.clear();
        const W = this.sys.game.config.width;
        const H = this.sys.game.config.height;
        for (const d of this.dustMotes) {
            d.x += d.speedX;
            d.y += d.speedY;
            if (d.y > H + 20) d.y = -20;
            if (d.x < -20) d.x = W + 20;
            if (d.x > W + 20) d.x = -20;
            this.dustGfx.fillStyle(C.LIGHT, d.alpha);
            this.dustGfx.fillCircle(d.x, d.y, d.radius);
        }
    }

    // Zones
    getZoneAt(x, y) {
        for (const z of ZONES) {
            if (x >= z.x - z.w / 2 && x <= z.x + z.w / 2 && y >= z.y - z.h / 2 && y <= z.y + z.h / 2)
                return z;
        }
        return null;
    }

    drawZones() {
        if (!this.zoneGfx) this.zoneGfx = this.add.graphics().setDepth(DEPTH.DECO);
        this.zoneGfx.clear();
        for (const z of ZONES) {
            const hov = this.hoverZone === z.id;
            this.zoneGfx.lineStyle(1, hov ? C.LAMP_GLOW : C.WOOD, hov ? 0.9 : 0.4);
            this.zoneGfx.strokeRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h);
            if (hov) {
                this.zoneGfx.fillStyle(C.LAMP_GLOW, 0.1);
                this.zoneGfx.fillRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h);
            }
        }
    }

    // Player visuals
    createPlayerVisual(id, data) {
        if (this.PG[id]) return;
        const g = this.add.graphics().setDepth(DEPTH.BODY);
        this.PG[id] = g;
        this.PL[id] = this.add.text(data.x, data.y - 28, data.username.toUpperCase(), {
            fontSize: '12px',
            fontFamily: "'VT323', monospace",
            color: '#fef0e0',
            backgroundColor: '#1e1b1acc',
            padding: { x: 5, y: 2 },
        }).setOrigin(0.5, 1).setDepth(DEPTH.LABEL);
        this.PT[id] = { x: data.x, y: data.y };
        this.redrawPlayer(id, data);
    }

    redrawPlayer(id, data) {
        const g = this.PG[id];
        if (!g) return;
        g.clear();
        const { x, y, sitting } = data;

        g.fillStyle(0x000000, 0.3);
        g.fillEllipse(x, y + 18, 32, 10);

        if (sitting) {
            g.lineStyle(2, C.LAMP_GLOW, 0.8);
            g.strokeEllipse(x, y, 38, 38);
        }

        g.fillStyle(C.WHITE);
        g.fillCircle(x, y, 16);
        g.fillStyle(C.BG);
        g.fillEllipse(x - 4, y - 2, 5, 6);
        g.fillEllipse(x + 4, y - 2, 5, 6);
        g.fillStyle(C.WHITE);
        g.fillCircle(x - 2.5, y - 4, 1.2);
        g.fillCircle(x + 2.5, y - 4, 1.2);
        g.lineStyle(1.5, C.BG, 0.8);
        g.beginPath();
        g.moveTo(x - 3, y + 5);
        g.lineTo(x + 3, y + 5);
        g.strokePath();
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
        lb.setPosition(data.x, data.y - 28);
        if (this.PCHAT[id]) this.PCHAT[id].setPosition(data.x, data.y - 50);
    }

    removePlayerVisual(id) {
        [this.PG, this.PL, this.PCHAT].forEach(store => {
            if (store[id]) { store[id].destroy(); delete store[id]; }
        });
        if (this.PCTIMER[id]) { clearTimeout(this.PCTIMER[id]); delete this.PCTIMER[id]; }
        delete this.PT[id];
        delete this.players[id];
    }

    showChatBubble(id, message, isSystem = false) {
        if (this.PCHAT[id]) this.PCHAT[id].destroy();
        if (this.PCTIMER[id]) clearTimeout(this.PCTIMER[id]);
        const p = this.players[id];
        if (!p && id !== 'system') return;
        const xPos = id === 'system' ? 400 : p.x;
        const yPos = id === 'system' ? 100 : p.y - 50;
        const bgColor = isSystem ? '#4a4a4aee' : '#f5d5b8ee';
        const textColor = isSystem ? '#f5d5b8' : '#1e1b1a';
        this.PCHAT[id] = this.add.text(xPos, yPos, message, {
            fontSize: '11px',
            fontFamily: "'VT323', monospace",
            color: textColor,
            backgroundColor: bgColor,
            padding: { x: 6, y: 3 },
            wordWrap: { width: 150 },
        }).setOrigin(0.5, 1).setDepth(DEPTH.BUBBLE);
        this.PCTIMER[id] = setTimeout(() => {
            if (this.PCHAT[id]) { this.PCHAT[id].destroy(); delete this.PCHAT[id]; }
        }, 5000);
    }

    onPointerDown(ptr) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) active.blur();
        if (!this.myId || !this.myRoom) return;

        const zone = this.getZoneAt(ptr.x, ptr.y);
        if (zone) {
            this.isSitting = true;
            this.moveTarget = null;
            socket.emit('sit', { spotId: zone.id, x: zone.sitX, y: zone.sitY });
            if (this.PT[this.myId]) this.PT[this.myId] = { x: zone.sitX, y: zone.sitY };
            if (this.players[this.myId]) this.players[this.myId].sitting = true;
        } else {
            this.isSitting = false;
            this.moveTarget = { x: ptr.x, y: ptr.y };
            if (this.players[this.myId]) this.players[this.myId].sitting = false;
        }
    }

    // Socket handlers
    onRoomJoined({ code, player, players }) {
        this.myId = socket.id;
        this.myRoom = code;
        this.players = {};
        for (const id of Object.keys(this.PG)) this.removePlayerVisual(id);
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

    onPlayerMoved({ id, x, y, sitting }) {
        if (!this.players[id]) return;
        this.players[id].sitting = sitting;
        if (this.PT[id]) this.PT[id] = { x, y };
    }

    onPlayerLeft({ id }) {
        this.removePlayerVisual(id);
    }

    onChatMessage({ id, username, message, system }) {
        if (!this.sys.isActive()) return;
        if (system) return;  // ignore system messages – they are handled by GameUI
        this.showChatBubble(id, message);
    }

    onLeftRoom() {
        // Remove only this scene's handlers
        socket.off('player_joined', this.onPlayerJoined);
        socket.off('player_moved', this.onPlayerMoved);
        socket.off('player_left', this.onPlayerLeft);
        socket.off('chat_message', this.onChatMessage);
        socket.off('left_room', this.onLeftRoom);
        socket.off('room_joined', this.onRoomJoined);

        for (const id of Object.keys(this.PG)) this.removePlayerVisual(id);
        this.players = {};
        this.myId = null;
        this.myRoom = null;
        this.moveTarget = null;
        this.isSitting = false;
    }
}