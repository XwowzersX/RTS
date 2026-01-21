import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { Game } from "./game";
import { api, ws } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Create Game
  app.post(api.game.create.path, (req, res) => {
    const game = storage.createGame();
    res.json({ gameId: game.id });
  });

  // Join Game
  app.post(api.game.join.path, (req, res) => {
    const { gameId } = req.body;
    const game = storage.getGame(gameId);
    if (!game) {
      console.log(`Join failed: Game ${gameId} not found`);
      return res.status(404).json({ message: "Game not found" });
    }
    const playerId = game.addPlayer("Player");
    const player = game.state.players[playerId];
    console.log(`Player ${playerId} (${player.color}) joined game ${gameId}`);
    
    res.json({ playerId, color: player.color });
  });

  // WebSocket
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket: any) => {
    console.log('New WS connection established');
    let currentGameId: string | null = null;
    let currentPlayerId: string | null = null;

    // Use a heartbeat to detect disconnected clients
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });

    socket.on('message', (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WS Message received:', message.type);
        
        if (message.type === 'join_game') {
          console.log('Join Game Message Full:', JSON.stringify(message));
          
          // The message sent from Game.tsx is sendMessage('join_game', { gameId, playerId })
          // So message = { type: 'join_game', payload: { gameId, playerId } }
          const gameId = message.payload?.gameId;
          const playerId = message.payload?.playerId;
          
          if (!gameId) {
            console.error('WS Join failed: gameId is missing in payload');
            return;
          }

          socket.gameId = gameId;
          currentGameId = gameId;
          currentPlayerId = playerId;
          
          console.log(`WS Client joined game channel: ${gameId} as ${playerId}`);
          
          const game = storage.getGame(gameId);
          if (game) {
             socket.send(JSON.stringify({ type: 'game_update', payload: game.state }));
          }
        } else if (currentGameId && currentPlayerId) {
          const game = storage.getGame(currentGameId);
          if (game) {
            game.handleAction(currentPlayerId, message);
          }
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    socket.on('error', (err: any) => {
      console.error('WS Socket Error:', err);
    });

    socket.on('close', () => {
      console.log('WS connection closed');
    });
  });

  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  // Global Broadcast Loop (Hack for MVP to avoid complex subscription logic)
  setInterval(() => {
    wss.clients.forEach((client: any) => {
       // Ideally we store gameId on the client object
       // But for now, we just broadcast to everyone if we knew their game.
       // Let's improve:
    });
  }, 100);
  
  // Hook into Game.onUpdate
  // We need to register the callback when creating the game, but we need access to WSS.
  // We can patch the game instances in the storage.
  
  const originalCreateGame = storage.createGame.bind(storage);
  storage.createGame = () => {
    const id = Math.random().toString(36).substring(7);
    const game = new Game(id, (state: any) => {
       // Broadcast to clients in this game
       const message = JSON.stringify({ type: 'game_update', payload: state });
       wss.clients.forEach((client: any) => {
         if (client.readyState === WebSocket.OPEN && client.gameId === id) {
           client.send(message);
         }
       });
    });
    (storage as any).games.set(id, game);
    return game;
  };

  return httpServer;
}
