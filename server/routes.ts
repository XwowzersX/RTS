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
      return res.status(404).json({ message: "Game not found" });
    }
    const playerId = game.addPlayer("Player");
    const player = game.state.players[playerId];
    
    // Start game if 2 players
    if (Object.keys(game.state.players).length === 2) {
      game.start();
    }

    res.json({ playerId, color: player.color });
  });

  // WebSocket
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket) => {
    let currentGameId: string | null = null;
    let currentPlayerId: string | null = null;

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'join_game') {
          const { gameId, playerId } = message; // Frontend needs to send playerId obtained from REST
          currentGameId = gameId;
          currentPlayerId = playerId;
          
          const game = storage.getGame(gameId);
          if (game) {
             // Setup broadcast listener for this socket
             // In a real app, use an event emitter. Here we hack it for MVP
             // We'll just poll or let the Game loop handle broadcasting to clients map
          }
        } else if (currentGameId && currentPlayerId) {
          const game = storage.getGame(currentGameId);
          if (game) {
            game.handleAction(currentPlayerId, message);
          }
        }
      } catch (err) {
        console.error('WS Error', err);
      }
    });
  });

  // Global Broadcast Loop (Hack for MVP to avoid complex subscription logic)
  setInterval(() => {
    wss.clients.forEach((client: any) => {
       // Ideally we store gameId on the client object
       // But for now, we just broadcast to everyone if we knew their game.
       // Let's improve:
    });
  }, 100);
  
  // Better approach: Hook into Game.onUpdate
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

  // Enhance WS connection to store gameId
  wss.on('connection', (socket: any) => {
     socket.on('message', (data: any) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'join_game') {
                socket.gameId = msg.gameId;
                // Send initial state immediately
                const game = storage.getGame(msg.gameId);
                if (game) {
                    socket.send(JSON.stringify({ type: 'game_update', payload: game.state }));
                }
            }
        } catch(e) {}
     });
  });

  return httpServer;
}
