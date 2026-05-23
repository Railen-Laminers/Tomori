import { useState, useEffect, useRef } from "react";
import { socket } from "./utils/socket";
import Lobby from "./components/Lobby";
import GameUI from "./components/GameUI";
import { initGame } from "./game/Game";

function App() {
  const [inGame, setInGame] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [playerCount, setPlayerCount] = useState(0);
  const gameRef = useRef(null);

  useEffect(() => {
    const onRoomJoined = (data) => {
      window.__pendingRoomData = data;
      setRoomCode(data.code);
      setPlayerCount(data.players.length);
      setInGame(true);
    };

    const onPlayerJoined = () => setPlayerCount((prev) => prev + 1);
    const onPlayerLeft = () => setPlayerCount((prev) => prev - 1);
    const onLeftRoom = () => {
      setInGame(false);
      setRoomCode("");
      setPlayerCount(0);
    };

    socket.on("room_joined", onRoomJoined);
    socket.on("player_joined", onPlayerJoined);
    socket.on("player_left", onPlayerLeft);
    socket.on("left_room", onLeftRoom);

    const onReconnect = () => {
      setInGame(false);
      setRoomCode("");
      setPlayerCount(0);
    };
    socket.io?.on("reconnect", onReconnect);

    return () => {
      socket.off("room_joined", onRoomJoined);
      socket.off("player_joined", onPlayerJoined);
      socket.off("player_left", onPlayerLeft);
      socket.off("left_room", onLeftRoom);
      socket.io?.off("reconnect", onReconnect);
    };
  }, []);

  useEffect(() => {
    if (inGame && !gameRef.current) {
      gameRef.current = initGame("game-container");
    }
    if (!inGame && gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
  }, [inGame]);

  return (
    <>
      <Lobby visible={!inGame} />
      <div id="game-container" className={inGame ? "block" : "hidden"} />
      {inGame && <GameUI roomCode={roomCode} playerCount={playerCount} />}
    </>
  );
}

export default App;