import { useState, useEffect, useRef } from "react";
import { socket } from "../utils/socket";

const HATS = [
  { id: null, icon: "∅" },
  { id: "cap", icon: "🧢" },
  { id: "witch", icon: "🎩" },
  { id: "bow", icon: "🎀" },
  { id: "halo", icon: "😇" },
  { id: "cowboy", icon: "🤠" },
  { id: "crown", icon: "👑" },
];
const PETS = [
  { id: null, icon: "∅" },
  { id: "cat", icon: "🐱" },
  { id: "star", icon: "⭐" },
  { id: "ghost", icon: "👻" },
  { id: "orb", icon: "🔮" },
  { id: "duck", icon: "🦆" },
  { id: "frog", icon: "🐸" },
];

export default function GameUI({ roomCode, playerCount: initialPlayerCount }) {
  const [playerCount, setPlayerCount] = useState(initialPlayerCount);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [cosmeticsOpen, setCosmeticsOpen] = useState(false);
  const [selectedHat, setSelectedHat] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const onPlayerJoined = () => setPlayerCount((prev) => prev + 1);
    const onPlayerLeft = () => setPlayerCount((prev) => prev - 1);
    const onChatMessage = ({ username, message }) => {
      setChatMessages((prev) => [...prev, { username, message, isMe: username === socket.id }]);
    };
    const onPlayerEquipped = ({ hat, pet }) => {
      if (hat !== undefined) setSelectedHat(hat);
      if (pet !== undefined) setSelectedPet(pet);
    };

    socket.on("player_joined", onPlayerJoined);
    socket.on("player_left", onPlayerLeft);
    socket.on("chat_message", onChatMessage);
    socket.on("player_equipped", onPlayerEquipped);

    return () => {
      socket.off("player_joined", onPlayerJoined);
      socket.off("player_left", onPlayerLeft);
      socket.off("chat_message", onChatMessage);
      socket.off("player_equipped", onPlayerEquipped);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit("chat", { message: chatInput });
    setChatInput("");
  };

  const sendEmote = (emote) => socket.emit("emote", { emote });
  const leaveRoom = () => socket.emit("leave_room");

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 flex gap-2 pointer-events-auto">
        <div className="bg-[#0f1432]/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#8b7d6b] tracking-wider">ROOM</span>
          <span className="font-['Fredoka_One'] text-amber-400 tracking-widest">
            {roomCode || "-----"}
          </span>
        </div>
        <div className="bg-[#0f1432]/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow shadow-emerald-400/50 animate-pulse"></div>
          <span className="text-sm font-bold">{playerCount} cozy</span>
        </div>
        <div className="flex-1"></div>
        <button
          onClick={leaveRoom}
          className="bg-rose-500/20 border border-rose-500/40 rounded-full px-4 py-2 text-rose-300 text-xs font-extrabold hover:bg-rose-500/30 transition"
        >
          ✕ leave
        </button>
      </div>

      {/* Cosmetics panel */}
      <div className="absolute top-3 right-3 pointer-events-auto">
        <button
          onClick={() => setCosmeticsOpen(!cosmeticsOpen)}
          className="bg-[#0f1432]/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-1 text-sm font-bold hover:border-amber-500 transition"
        >
          ✦ outfit
        </button>
        {cosmeticsOpen && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-[#0a0e32]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl animate-fadeIn">
            <div className="text-[10px] font-bold text-[#8b7d6b] tracking-wider mb-2">Hats</div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {HATS.map((hat) => (
                <div
                  key={hat.id || "none"}
                  onClick={() => socket.emit("equip", { hat: hat.id })}
                  className={`h-10 flex items-center justify-center rounded-xl cursor-pointer transition text-lg ${
                    selectedHat === hat.id
                      ? "bg-amber-500/20 border border-amber-500 shadow shadow-amber-500/30"
                      : "bg-white/5 border border-white/10 hover:border-amber-500/50"
                  }`}
                >
                  {hat.icon}
                </div>
              ))}
            </div>
            <div className="text-[10px] font-bold text-[#8b7d6b] tracking-wider mb-2">Pets</div>
            <div className="grid grid-cols-4 gap-2">
              {PETS.map((pet) => (
                <div
                  key={pet.id || "none"}
                  onClick={() => socket.emit("equip", { pet: pet.id })}
                  className={`h-10 flex items-center justify-center rounded-xl cursor-pointer transition text-lg ${
                    selectedPet === pet.id
                      ? "bg-amber-500/20 border border-amber-500 shadow shadow-amber-500/30"
                      : "bg-white/5 border border-white/10 hover:border-amber-500/50"
                  }`}
                >
                  {pet.icon}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat panel */}
      <div className="absolute bottom-20 left-3 w-72 pointer-events-auto">
        <div className="max-h-44 overflow-y-auto flex flex-col gap-1 mb-2 scrollbar-hide">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className="bg-[#0a0e28]/80 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 text-xs animate-fadeInUp"
            >
              <span className="font-extrabold mr-1" style={{ color: msg.isMe ? "#f4a261" : "#a8dadc" }}>
                {msg.username}
              </span>
              {msg.message}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            className="flex-1 bg-[#0a0e28]/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-sm text-[#fdf6ec] placeholder:text-white/20 focus:border-amber-500 outline-none"
            placeholder="say something cozy..."
            maxLength={120}
          />
          <button
            onClick={sendChat}
            className="w-9 h-9 bg-amber-500 rounded-full flex items-center justify-center text-[#1a1a2e] font-black hover:bg-amber-400 transition transform hover:scale-105"
          >
            ↑
          </button>
        </div>
      </div>

      {/* Emote bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-[#0a0e28]/80 backdrop-blur-md border border-white/10 rounded-full px-3 py-2 pointer-events-auto">
        {["👋", "💛", "✨", "🌧️", "😌", "🔥", "🌙", "🎵"].map((em) => (
          <button
            key={em}
            onClick={() => sendEmote(em)}
            className="w-10 h-10 rounded-full hover:bg-white/10 transition text-xl hover:-translate-y-1"
          >
            {em}
          </button>
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 left-80 right-80 flex justify-center pointer-events-none text-[10px] font-bold tracking-wider text-white/20">
        click anywhere to move • click a spot to sit
      </div>

      {/* Music bar */}
      <div className="absolute bottom-4 right-3 bg-[#0a0e28]/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 text-xs pointer-events-auto">
        <span className="text-base animate-spin-slow">🎵</span>
        <div>
          <div className="text-[#fdf6ec] font-bold text-[11px]">midnight lo-fi rain</div>
          <div className="text-[9px] text-[#8b7d6b]">synced playback</div>
        </div>
        <div className="flex gap-0.5 items-end h-3">
          <span className="w-0.5 bg-amber-500 animate-eq1"></span>
          <span className="w-0.5 bg-amber-500 animate-eq2"></span>
          <span className="w-0.5 bg-amber-500 animate-eq3"></span>
          <span className="w-0.5 bg-amber-500 animate-eq4"></span>
        </div>
      </div>
    </div>
  );
}