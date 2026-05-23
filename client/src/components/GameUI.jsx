import { useState, useEffect, useRef } from "react";
import { socket } from "../utils/socket";

export default function GameUI({ roomCode, playerCount: initialPlayerCount }) {
  const [playerCount, setPlayerCount] = useState(initialPlayerCount);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const onPlayerJoined = () => mounted && setPlayerCount((prev) => prev + 1);
    const onPlayerLeft = () => mounted && setPlayerCount((prev) => prev - 1);
    const onChatMessage = ({ username, message }) => {
      mounted && setChatMessages((prev) => [
        ...prev,
        { username, message, isMe: username === socket.id },
      ]);
    };

    socket.on("player_joined", onPlayerJoined);
    socket.on("player_left", onPlayerLeft);
    socket.on("chat_message", onChatMessage);

    return () => {
      mounted = false;
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
      {/* Top bar – neon terminal style */}
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
            <span className="text-white/40 text-[9px] font-share tracking-[0.15em] uppercase">occupants</span>
          </div>
        </div>
        <button
          onClick={leaveRoom}
          className="text-white/50 hover:text-[#d4a843] text-[11px] font-share tracking-wider uppercase transition-all px-3 py-1.5 border border-white/10 hover:border-[#d4a843]/50 hover:bg-[#d4a843]/5"
        >
          [ leave ]
        </button>
      </div>

      {/* Chat panel – retro terminal */}
      <div className="absolute bottom-5 left-5 w-80 pointer-events-auto">
        {/* Chat header */}
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <span className="text-[#d4a843]/70 text-[8px] font-share tracking-[0.2em] uppercase">✦ chat.log</span>
          <div className="flex-1 h-px bg-gradient-to-r from-[#d4a843]/30 to-transparent" />
        </div>

        {/* Messages */}
        <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 mb-2 pr-1 scrollbar-hide">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className="bg-[#050505]/80 border-l-2 border-[#d4a843]/40 p-2 backdrop-blur-sm hover:bg-[#0a0a0a]/90 transition-all"
            >
              <div className={`font-share text-[9px] tracking-wide ${msg.isMe ? "text-[#d4a843]" : "text-white/50"}`}>
                {msg.isMe ? "➤ " : "  "}{msg.username}
              </div>
              <div className="font-special text-sm text-white/90 mt-0.5 leading-relaxed break-words">
                {msg.message}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            className={`flex-1 bg-[#050505]/90 border text-white font-special text-sm px-3 py-2 outline-none transition-all placeholder:text-white/20 ${inputFocused ? "border-[#d4a843]/70 shadow-[0_0_6px_#d4a843]/20" : "border-white/10"
              }`}
            placeholder=">_ type message..."
            maxLength={120}
          />
          <button
            onClick={sendChat}
            className="px-4 bg-[#d4a843]/10 hover:bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/30 font-share text-xs uppercase tracking-wider transition-all hover:shadow-[0_0_5px_#d4a843]/30"
          >
            send
          </button>
        </div>
      </div>
    </div>
  );
}