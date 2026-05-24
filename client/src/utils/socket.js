import { io } from "socket.io-client";

// Use environment variable if set (for production cross-origin), otherwise fallback to same-origin
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

export const socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ["websocket", "polling"],
});