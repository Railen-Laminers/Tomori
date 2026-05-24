import { useEffect, useState } from "react";
import { socketState } from "../utils/socket";

export function useSocketConnection() {
    const [isConnected, setIsConnected] = useState(socketState.isConnected);

    useEffect(() => {
        return socketState.onStatusChange(setIsConnected);
    }, []);

    return isConnected;
}