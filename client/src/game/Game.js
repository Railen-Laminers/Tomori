import Phaser from "phaser";
import GameScene from "./GameScene";

export function initGame(parentId) {
    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parentId,
        scale: {
            mode: Phaser.Scale.RESIZE,       // canvas resizes to fill its parent
            autoCenter: Phaser.Scale.CENTER_BOTH,
            // width & height are auto‑detected from the parent container
        },
        backgroundColor: "#080808",
        scene: GameScene,
        fps: { target: 60 },
    });

    // No manual resize listener needed – RESIZE mode handles it
    return game;
}