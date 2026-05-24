import { useState, useEffect, useRef } from "react";
import { socket } from "../utils/socket";

// Simple inline SVG icons
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const HideIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ShowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const LeaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function GameUI({ roomCode, playerCount: initialPlayerCount }) {
  const [playerCount, setPlayerCount] = useState(initialPlayerCount);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const addSystemMessage = (message) => {
    setChatMessages((prev) => [...prev, { message, system: true }]);
  };

  useEffect(() => {
    let mounted = true;
    const playerNames = new Map();

    const onRoomJoined = (data) => {
      data.players.forEach((p) => playerNames.set(p.id, p.username));
    };

    const onPlayerJoined = ({ player }) => {
      if (!mounted) return;
      playerNames.set(player.id, player.username);
      setPlayerCount((prev) => prev + 1);
      addSystemMessage(`${player.username} joined the room`);
    };

    const onPlayerLeft = ({ id }) => {
      if (!mounted) return;
      const username = playerNames.get(id);
      if (username) {
        addSystemMessage(`${username} left the room`);
        playerNames.delete(id);
      }
      setPlayerCount((prev) => prev - 1);
    };

    const onChatMessage = ({ username, message, system }) => {
      if (!mounted) return;
      if (!system) {
        setChatMessages((prev) => [
          ...prev,
          { username, message, isMe: username === socket.id, system: false },
        ]);
      }
    };

    socket.on("room_joined", onRoomJoined);
    socket.on("player_joined", onPlayerJoined);
    socket.on("player_left", onPlayerLeft);
    socket.on("chat_message", onChatMessage);

    return () => {
      mounted = false;
      socket.off("room_joined", onRoomJoined);
      socket.off("player_joined", onPlayerJoined);
      socket.off("player_left", onPlayerLeft);
      socket.off("chat_message", onChatMessage);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit("chat", { message: chatInput });
    setChatInput("");
    inputRef.current?.focus();
  };

  const leaveRoom = () => socket.emit("leave_room");

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 pointer-events-auto z-10 bg-[#050505]/90 backdrop-blur-sm border-b border-[#d4a843]/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[#d4a843]/60 text-[9px] font-share tracking-[0.2em] uppercase">&gt; ROOM</span>
            <span className="font-vt323 text-2xl text-[#d4a843] tracking-wider">{roomCode || "?????"}</span>
          </div>
          <div className="w-px h-5 bg-[#d4a843]/20" />
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4a843] shadow-[0_0_6px_#d4a843] animate-pulse" />
            <span className="font-vt323 text-xl text-white tracking-wide">{playerCount}</span>
            <span className="text-white/40 text-[9px] font-share tracking-[0.15em] uppercase">people</span>
          </div>
        </div>
        <button
          onClick={leaveRoom}
          className="text-red-500 hover:text-red-400 transition-all p-2 border border-red-500/30 hover:border-red-400/60 hover:bg-red-500/10 rounded"
          title="Leave room"
        >
          <LeaveIcon />
        </button>
      </div>

      {/* Chat panel */}
      {chatVisible && (
        <div className="absolute bottom-5 left-5 w-80 pointer-events-auto">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="text-[#d4a843]/70 text-[8px] font-share tracking-[0.2em] uppercase">✦ chat.log</span>
            <div className="flex-1 h-px bg-gradient-to-r from-[#d4a843]/30 to-transparent" />
          </div>

          <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 mb-2 pr-1 scrollbar-hide">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`bg-[#050505]/80 border-l-2 p-2 backdrop-blur-sm hover:bg-[#0a0a0a]/90 transition-all ${msg.system ? "border-[#888]/40" : "border-[#d4a843]/40"
                  }`}
              >
                {!msg.system && (
                  <div
                    className={`font-share text-[9px] tracking-wide ${msg.isMe ? "text-[#d4a843]" : "text-white/50"
                      }`}
                  >
                    {msg.isMe ? "➤ " : "  "}
                    {msg.username}
                  </div>
                )}
                <div
                  className={`font-special text-sm mt-0.5 leading-relaxed break-words ${msg.system ? "text-white/60 italic" : "text-white/90"
                    }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input area with send and hide buttons */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              className={`flex-1 bg-[#050505]/90 border text-white font-special text-sm px-3 py-2 outline-none transition-all placeholder:text-white/20 ${inputFocused
                  ? "border-[#d4a843]/70 shadow-[0_0_6px_#d4a843]/20"
                  : "border-white/10"
                }`}
              placeholder=">_ type message..."
              maxLength={120}
            />
            <button
              onClick={sendChat}
              className="p-2 bg-[#d4a843]/10 hover:bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/30 transition-all hover:shadow-[0_0_5px_#d4a843]/30 rounded"
              title="Send message"
            >
              <SendIcon />
            </button>
            <button
              onClick={() => setChatVisible(false)}
              className="p-2 bg-[#050505]/80 hover:bg-[#d4a843]/10 text-white/70 hover:text-[#d4a843] border border-white/20 hover:border-[#d4a843]/40 transition-all rounded"
              title="Hide chat"
            >
              <HideIcon />
            </button>
          </div>
        </div>
      )}

      {/* Show chat button (when hidden) - placed in same bottom-left area */}
      {!chatVisible && (
        <button
          onClick={() => setChatVisible(true)}
          className="absolute bottom-5 left-5 p-2 bg-[#050505]/80 backdrop-blur-sm border border-[#d4a843]/40 rounded-full text-[#d4a843] hover:bg-[#d4a843]/20 transition-all pointer-events-auto"
          title="Show chat"
        >
          <ShowIcon />
        </button>
      )}
    </div>
  );
}