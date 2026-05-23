import Phaser from "phaser";
import GameScene from "./GameScene";

export function initGame(parentId) {
    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parentId,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: "#1a1a2e",
        scene: GameScene,
        fps: { target: 60 },
    });

    window.addEventListener("resize", () => {
        game.scale.resize(window.innerWidth, window.innerHeight);
    });

    return game;
}