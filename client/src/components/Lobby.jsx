import { useState, useEffect, useRef } from "react";
import { socket } from "../utils/socket";
import { useSocketConnection } from "../hooks/useSocketConnection";

export default function Lobby({ visible }) {
    const isSocketConnected = useSocketConnection();
    const [step, setStep] = useState("username");
    const [username, setUsername] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cursorVisible, setCursorVisible] = useState(true);

    const [nameError, setNameError] = useState("");
    const [roomCodeError, setRoomCodeError] = useState("");

    const nameErrorTimeoutRef = useRef(null);
    const roomCodeErrorTimeoutRef = useRef(null);
    const joinLobbyTimeoutRef = useRef(null);

    const inputRef = useRef(null);
    const canvasRef = useRef(null);
    const prevVisibleRef = useRef(visible);

    const setAutoHideError = (setter, message, timeoutRef) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setter(message);
        if (message) {
            timeoutRef.current = setTimeout(() => {
                setter("");
                timeoutRef.current = null;
            }, 3000);
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setCursorVisible(v => !v);
        }, 530);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (visible && !prevVisibleRef.current) {
            setRoomCode("");
            setIsSubmitting(false);
            setNameError("");
            setRoomCodeError("");
            if (nameErrorTimeoutRef.current) clearTimeout(nameErrorTimeoutRef.current);
            if (roomCodeErrorTimeoutRef.current) clearTimeout(roomCodeErrorTimeoutRef.current);
            if (joinLobbyTimeoutRef.current) clearTimeout(joinLobbyTimeoutRef.current);
        }
        prevVisibleRef.current = visible;
    }, [visible]);

    // Particle background (unchanged)
    useEffect(() => {
        if (!visible) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let animationId;
        let particles = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        const initParticles = () => {
            particles = [];
            const count = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 15000));
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: Math.random() * 2.5 + 0.8,
                    alpha: Math.random() * 0.4 + 0.1,
                    speedX: (Math.random() - 0.5) * 0.3,
                    speedY: (Math.random() - 0.5) * 0.2 + 0.1,
                });
            }
        };

        const draw = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = "rgba(255,255,240,0.03)";
            ctx.lineWidth = 0.5;
            const step = 45;
            for (let x = 0; x < canvas.width; x += step) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += step) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
            for (let p of particles) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(212, 168, 67, ${p.alpha * 0.5})`;
                ctx.fill();
                p.x += p.speedX;
                p.y += p.speedY;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
            }
            animationId = requestAnimationFrame(draw);
        };

        window.addEventListener("resize", resize);
        resize();
        draw();

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animationId);
        };
    }, [visible]);

    useEffect(() => {
        const onLobbyJoined = () => {
            if (joinLobbyTimeoutRef.current) clearTimeout(joinLobbyTimeoutRef.current);
            setIsSubmitting(false);
            setStep("room");
        };
        const onError = ({ msg }) => {
            if (joinLobbyTimeoutRef.current) clearTimeout(joinLobbyTimeoutRef.current);
            setIsSubmitting(false);
            // Route the error to the current step’s error state
            if (step === "username") {
                setAutoHideError(setNameError, msg, nameErrorTimeoutRef);
            } else {
                setAutoHideError(setRoomCodeError, msg, roomCodeErrorTimeoutRef);
            }
        };
        const onDisconnect = () => {
            setIsSubmitting(false);
            const msg = "⚠ Connection lost. Refresh the page.";
            if (step === "username") {
                setAutoHideError(setNameError, msg, nameErrorTimeoutRef);
            } else {
                setAutoHideError(setRoomCodeError, msg, roomCodeErrorTimeoutRef);
            }
        };

        socket.on("lobby_joined", onLobbyJoined);
        socket.on("error", onError);
        socket.on("disconnect", onDisconnect);

        return () => {
            socket.off("lobby_joined", onLobbyJoined);
            socket.off("error", onError);
            socket.off("disconnect", onDisconnect);
        };
    }, [step]); // re‑run when step changes so error goes to correct field

    const handleSetUsername = () => {
        if (nameErrorTimeoutRef.current) clearTimeout(nameErrorTimeoutRef.current);
        if (joinLobbyTimeoutRef.current) clearTimeout(joinLobbyTimeoutRef.current);
        setNameError("");

        if (!username.trim()) {
            setAutoHideError(setNameError, "⚠ A name is required.", nameErrorTimeoutRef);
            return;
        }

        if (!isSocketConnected) {
            setAutoHideError(setNameError, "⚠ Connecting to server... please wait or refresh.", nameErrorTimeoutRef);
            return;
        }

        setIsSubmitting(true);
        joinLobbyTimeoutRef.current = setTimeout(() => {
            if (isSubmitting) {
                setIsSubmitting(false);
                setAutoHideError(setNameError, "⚠ Server didn't respond. Check your connection.", nameErrorTimeoutRef);
            }
        }, 10000);

        socket.emit("join_lobby", { username: username.trim() });
    };

    const handleCreateRoom = () => {
        if (!isSocketConnected) {
            setAutoHideError(setRoomCodeError, "⚠ Not connected to server.", roomCodeErrorTimeoutRef);
            return;
        }
        setIsSubmitting(true);
        const timeout = setTimeout(() => {
            if (isSubmitting) {
                setIsSubmitting(false);
                setAutoHideError(setRoomCodeError, "Request timed out – try again", roomCodeErrorTimeoutRef);
            }
        }, 10000);
        socket.emit("create_room", () => clearTimeout(timeout));
    };

    const handleJoinRoom = () => {
        if (roomCodeErrorTimeoutRef.current) clearTimeout(roomCodeErrorTimeoutRef.current);
        setRoomCodeError("");

        if (!roomCode.trim()) {
            setAutoHideError(setRoomCodeError, "⚠ Enter a room code.", roomCodeErrorTimeoutRef);
            return;
        }

        if (!isSocketConnected) {
            setAutoHideError(setRoomCodeError, "⚠ Not connected to server.", roomCodeErrorTimeoutRef);
            return;
        }

        setIsSubmitting(true);
        const timeout = setTimeout(() => {
            if (isSubmitting) {
                setIsSubmitting(false);
                setAutoHideError(setRoomCodeError, "Request timed out – try again", roomCodeErrorTimeoutRef);
            }
        }, 10000);
        socket.emit("join_room", { code: roomCode.toUpperCase() }, () => clearTimeout(timeout));
    };

    const generateRandomName = () => {
        const prefixes = ["drift", "echo", "lumen", "static", "vibe", "noir", "pixel", "cipher", "ember", "karma"];
        const suffixes = ["walker", "shade", "fox", "byte", "ghost", "rune", "spark", "void", "owl", "moth"];
        const random = `${prefixes[Math.floor(Math.random() * prefixes.length)]}_${suffixes[Math.floor(Math.random() * suffixes.length)]}${Math.floor(Math.random() * 99)}`;
        setUsername(random);
        if (nameErrorTimeoutRef.current) clearTimeout(nameErrorTimeoutRef.current);
        setNameError("");
        if (inputRef.current) inputRef.current.focus();
    };

    const goBackToIdentity = () => {
        setStep("username");
        setRoomCode("");
        if (roomCodeErrorTimeoutRef.current) clearTimeout(roomCodeErrorTimeoutRef.current);
        setRoomCodeError("");
    };

    if (!visible) return null;

    return (
        <>
            <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.6 }} />
            <div className="fixed inset-0 bg-[#050505]/80 backdrop-blur-[2px] flex items-center justify-center z-50 font-special overflow-hidden">
                <div className="relative z-10 w-[460px] max-w-[90vw] bg-[#0c0c0c] border border-[#d4a843]/30 shadow-2xl shadow-black/50 p-8 animate-fadeUp">
                    <div className="absolute w-5 h-5 border-[#d4a843]/40 border-t-2 border-l-2 -top-px -left-px" />
                    <div className="absolute w-5 h-5 border-[#d4a843]/40 border-t-2 border-r-2 -top-px -right-px" />
                    <div className="absolute w-5 h-5 border-[#d4a843]/40 border-b-2 border-l-2 -bottom-px -left-px" />
                    <div className="absolute w-5 h-5 border-[#d4a843]/40 border-b-2 border-r-2 -bottom-px -right-px" />

                    <div className="relative">
                        <h1 className="font-vt323 text-5xl text-[#d4a843] tracking-wider text-center animate-titleFlicker">
                            <span className="relative inline-block">
                                Tomori
                                <span className="absolute -top-1 -right-6 text-[10px] font-share text-white/30">v1.0</span>
                            </span>
                        </h1>
                        <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#d4a843]/30 to-transparent" />
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6" />

                    <div className="flex gap-3 justify-center mb-6">
                        {["IDENTITY", "ACCESS"].map((label, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${step === (idx === 0 ? "username" : "room") ? "bg-[#d4a843] shadow-[0_0_6px_#d4a843]" : "bg-white/10"}`} />
                                <span className={`font-share text-[8px] tracking-wider ${step === (idx === 0 ? "username" : "room") ? "text-[#d4a843]" : "text-white/30"}`}>
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {step === "username" && (
                        <div className="animate-fadeUp">
                            <label className="block font-share text-[10px] text-[#d4a843]/70 tracking-wider uppercase mb-2 flex justify-between">
                                <span>&gt; Name</span>
                                <button
                                    type="button"
                                    onClick={generateRandomName}
                                    className="text-white/30 hover:text-[#d4a843] transition-colors text-[9px]"
                                >
                                    [ randomize ]
                                </button>
                            </label>
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        if (nameErrorTimeoutRef.current) clearTimeout(nameErrorTimeoutRef.current);
                                        setNameError("");
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && !isSubmitting && isSocketConnected && handleSetUsername()}
                                    className="w-full bg-[#0a0a0a] border border-[#d4a843]/30 text-white font-vt323 text-xl px-4 py-2.5 outline-none focus:border-[#d4a843]/70 transition-all placeholder:text-white/10"
                                    placeholder="anonymous"
                                    maxLength={20}
                                    autoFocus
                                    disabled={isSubmitting}
                                />
                                {cursorVisible && document.activeElement === inputRef && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-[#d4a843]/80 animate-pulse" />
                                )}
                            </div>
                            {nameError && (
                                <div className="font-share text-[11px] text-red-400/90 mt-2 px-2 py-1 bg-red-950/20 border-l-2 border-red-500 animate-fadeIn">
                                    {nameError}
                                </div>
                            )}
                            <button
                                onClick={handleSetUsername}
                                disabled={isSubmitting || !isSocketConnected}
                                className={`w-full font-vt323 text-xl py-3 mt-6 transition-all flex items-center justify-center gap-2 ${(isSubmitting || !isSocketConnected) ? "bg-white/5 text-white/30" : "bg-[#d4a843]/20 hover:bg-[#d4a843]/30 text-[#d4a843] border border-[#d4a843]/40 hover:border-[#d4a843]/80"}`}
                            >
                                {isSubmitting ? (
                                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-[#d4a843] rounded-full animate-spin" />
                                ) : !isSocketConnected ? (
                                    "⟳ CONNECTING..."
                                ) : (
                                    "► CONNECT"
                                )}
                            </button>
                            {/* Global error display removed – now handled by nameError above */}
                        </div>
                    )}

                    {step === "room" && (
                        <div className="animate-fadeUp">
                            <div className="flex justify-start mb-4">
                                <button
                                    onClick={goBackToIdentity}
                                    disabled={isSubmitting}
                                    className="text-white/40 hover:text-[#d4a843] text-[10px] font-share tracking-wider uppercase transition-all disabled:opacity-30"
                                >
                                    ← back to identity
                                </button>
                            </div>

                            <button
                                onClick={handleCreateRoom}
                                disabled={isSubmitting || !isSocketConnected}
                                className={`w-full font-vt323 text-xl py-3 transition-all flex items-center justify-center gap-2 ${(isSubmitting || !isSocketConnected) ? "bg-white/5 text-white/30" : "bg-[#d4a843]/20 hover:bg-[#d4a843]/30 text-[#d4a843] border border-[#d4a843]/40"}`}
                            >
                                {isSubmitting ? (
                                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-[#d4a843] rounded-full animate-spin" />
                                ) : !isSocketConnected ? (
                                    "⟳ CONNECTING..."
                                ) : (
                                    "CREATE NEW ROOM"
                                )}
                            </button>

                            <div className="flex items-center gap-4 my-6">
                                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
                                <span className="font-share text-[9px] text-white/30 tracking-wider">— OR JOIN EXISTING —</span>
                                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
                            </div>

                            <label className="block font-share text-[10px] text-[#d4a843]/70 tracking-wider uppercase mb-2">
                                &gt; room code
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={roomCode}
                                    onChange={(e) => {
                                        setRoomCode(e.target.value.toUpperCase().slice(0, 5));
                                        if (roomCodeErrorTimeoutRef.current) clearTimeout(roomCodeErrorTimeoutRef.current);
                                        setRoomCodeError("");
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && !isSubmitting && isSocketConnected && handleJoinRoom()}
                                    className="flex-1 bg-[#0a0a0a] border border-[#d4a843]/30 text-white font-vt323 text-2xl tracking-[0.2em] px-3 py-2 outline-none focus:border-[#d4a843]/70 text-center uppercase"
                                    placeholder="XXXXX"
                                    maxLength={5}
                                    disabled={isSubmitting}
                                />
                                <button
                                    onClick={handleJoinRoom}
                                    disabled={isSubmitting || !isSocketConnected}
                                    className="px-6 bg-[#d4a843]/20 hover:bg-[#d4a843]/30 text-[#d4a843] font-vt323 text-lg transition-all disabled:opacity-30"
                                >
                                    ↲
                                </button>
                            </div>
                            {roomCodeError && (
                                <div className="font-share text-[11px] text-red-400/90 mt-2 px-2 py-1 bg-red-950/20 border-l-2 border-red-500 animate-fadeIn">
                                    {roomCodeError}
                                </div>
                            )}
                            {/* Global error display removed – now handled by roomCodeError above */}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}