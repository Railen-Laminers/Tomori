import { useState, useEffect } from "react";
import { socket } from "../utils/socket";

export default function Lobby({ visible }) {
    const [step, setStep] = useState("username");
    const [username, setUsername] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        socket.on("lobby_joined", () => setStep("room"));
        socket.on("error", ({ msg }) => setError(msg));
        return () => {
            socket.off("lobby_joined");
            socket.off("error");
        };
    }, []);

    const handleSetUsername = () => {
        if (!username.trim()) return setError("Pick a name first!");
        socket.emit("join_lobby", { username: username.trim() });
    };

    const handleCreateRoom = () => socket.emit("create_room");
    const handleJoinRoom = () => {
        if (!roomCode.trim()) return setError("Enter a room code");
        socket.emit("join_room", { code: roomCode.toUpperCase() });
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center z-50 overflow-hidden">
            <div className="stars absolute inset-0 pointer-events-none" id="lobby-stars"></div>

            <div className="relative bg-[#0f153e]/85 backdrop-blur-xl border border-white/10 rounded-3xl p-10 w-[420px] max-w-[94vw] shadow-2xl">
                <div className="text-center">
                    <div className="font-['Fredoka_One'] text-5xl text-[#fdf6ec] flex items-center justify-center gap-2">
                        drizzle <span className="text-3xl animate-sway">🌧</span>
                    </div>
                    <div className="text-xs text-[#8b7d6b] tracking-wider mt-1">☁ a cozy place to hang out</div>
                </div>

                {step === "username" && (
                    <>
                        <div className="flex gap-2 justify-center mt-6">
                            <div className="w-2 h-2 rounded-full bg-amber-500 shadow shadow-amber-500"></div>
                            <div className="w-2 h-2 rounded-full bg-white/15"></div>
                        </div>
                        <div className="text-[10px] font-bold tracking-wider text-[#8b7d6b] mt-6">your name</div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSetUsername()}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-[#fdf6ec] font-semibold focus:border-amber-500 focus:outline-none transition"
                            placeholder="e.g. moonpuddle"
                            maxLength={20}
                        />
                        <button onClick={handleSetUsername} className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-[#1a1a2e] font-extrabold py-3 rounded-lg transition transform hover:-translate-y-0.5">
                            step inside ☁
                        </button>
                        {error && <div className="text-rose-300 text-xs font-bold mt-3">{error}</div>}
                    </>
                )}

                {step === "room" && (
                    <>
                        <div className="flex gap-2 justify-center mt-6">
                            <div className="w-2 h-2 rounded-full bg-white/15"></div>
                            <div className="w-2 h-2 rounded-full bg-amber-500 shadow shadow-amber-500"></div>
                        </div>
                        <button onClick={handleCreateRoom} className="w-full mt-6 bg-amber-500 hover:bg-amber-400 text-[#1a1a2e] font-extrabold py-3 rounded-lg transition">
                            ☁ Create a cozy room
                        </button>
                        <div className="flex items-center gap-3 my-5 text-xs text-[#8b7d6b] font-bold uppercase">
                            <hr className="flex-1 border-white/10" />
                            or join one
                            <hr className="flex-1 border-white/10" />
                        </div>
                        <div className="text-[10px] font-bold tracking-wider text-[#8b7d6b]">room code</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 5))}
                                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-[#fdf6ec] font-mono font-bold tracking-wider focus:border-amber-500 outline-none"
                                placeholder="XXXXX"
                                maxLength={5}
                            />
                            <button onClick={handleJoinRoom} className="px-5 py-3 bg-white/5 border border-white/10 rounded-lg hover:border-sky-300 text-white font-bold transition">
                                Join →
                            </button>
                        </div>
                        {error && <div className="text-rose-300 text-xs font-bold mt-3">{error}</div>}
                    </>
                )}
            </div>
        </div>
    );
}