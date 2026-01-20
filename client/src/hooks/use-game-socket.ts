import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { GameState, WsMessage } from "@shared/schema";
import { WS_MESSAGES } from "@shared/schema";

export function useGameSocket(gameId: string | null) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!gameId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Connected to game server");
      setIsConnected(true);
      // clear any pending reconnects
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("WS message received:", message.type);
        // Normalize the message type check to be case-insensitive or handle both
        if (message.type === "game_update" || message.type === "GAME_UPDATE") {
          setGameState(message.payload);
        } else if (message.type === 'error') {
          toast({
            variant: "destructive",
            title: "Game Error",
            description: message.message
          });
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from game server");
      setIsConnected(false);
      setSocket(null);
      
      // Attempt reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connect();
      }, 3000);
    };

    setSocket(ws);

    return () => {
      ws.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [gameId, toast]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    } else {
      console.warn("Socket not open, cannot send message", type);
    }
  }, [socket]);

  return { socket, gameState, isConnected, sendMessage };
}
