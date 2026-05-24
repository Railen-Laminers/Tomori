import { io } from "socket.io-client";

// Hmm Prefer polling for more reliable mobile connections; WebSocket upgrade will happen if possible
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

export const socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ["polling", "websocket"],   // polling first for better mobile compatibility
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

// Simple reactive connection state
export const socketState = {
    isConnected: socket.connected,
    listeners: new Set(),
    setConnected(connected) {
        this.isConnected = connected;
        this.listeners.forEach(fn => fn(connected));
    },
    onStatusChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
};

socket.on("connect", () => socketState.setConnected(true));
socket.on("disconnect", () => socketState.setConnected(false));
socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err);
    socketState.setConnected(false);
});