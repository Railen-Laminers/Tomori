import { io } from "socket.io-client";

// For development, Vite will proxy /socket.io to localhost:3000 (see vite.config.js)
export const socket = io();