import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { Game } from "./game";
import { api, ws } from "@shared/routes";
import { z } from "zod";
import { setupAuth } from "./auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app, storage);
  
  // Create Game (multiplayer)
  app.post(api.game.create.path, (req, res) => {
    const game = storage.createGame('multiplayer');
    res.json({ gameId: game.id });
  });

  // Create Survival Game (Campaign Mission 1)
  app.post('/api/game/create-survival', (req, res) => {
    const game = storage.createGame('survival');
    res.json({ gameId: game.id });
  });

  // Join Game
  app.post(api.game.join.path, (req, res) => {
    const { gameId } = req.body;
    const user = req.isAuthenticated() ? (req.user as any) : null;
    const playerName = user ? user.username : "Guest";
    
    // Check if game exists, if not create a "Solo" game for AI (quick play)
    let game = storage.getGame(gameId);
    if (!game) {
      game = storage.createGameWithId(gameId, 'solo');
    }
    
    const playerId = game.addPlayer(playerName);
    const player = game.state.players[playerId];
    if (user) {
      (player as any).userId = user.id;
    }
    console.log(`Player ${playerName} (${playerId}, ${player.color}) joined game ${gameId}`);
    
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

  // Global Broadcast Loop 
  setInterval(() => {
    // This is handled by Game.onUpdate callbacks now
  }, 100);
  
  // Hook into storage to provide the broadcast callback
  (storage as any).setWss(wss);

  return httpServer;
}
