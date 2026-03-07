import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { Game } from "./game";
import { WebSocket } from "ws";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStats(id: number, stats: any): Promise<User>;
  
  // Game Storage
  createGame(mode?: 'solo' | 'multiplayer'): Game;
  createGameWithId(id: string, mode?: 'solo' | 'multiplayer'): Game;
  getGame(id: string): Game | undefined;
}

export class MemStorage implements IStorage {
  private games: Map<string, Game>;
  private wss: any = null;

  constructor() {
    this.games = new Map();
  }

  setWss(wss: any) {
    this.wss = wss;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserStats(id: number, stats: any): Promise<User> {
    const [currentUser] = await db.select().from(users).where(eq(users.id, id));
    if (!currentUser) throw new Error("User not found");

    const updatedStats: any = {};
    for (const key in stats) {
      if (key in currentUser) {
        updatedStats[key] = (currentUser as any)[key] + stats[key];
      }
    }

    const [user] = await db
      .update(users)
      .set(updatedStats)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  createGameWithId(id: string, mode: 'solo' | 'multiplayer' = 'multiplayer'): Game {
    const game = new Game(id, (state) => {
      if (this.wss) {
        const message = JSON.stringify({ type: 'game_update', payload: state });
        this.wss.clients.forEach((client: any) => {
          if (client.readyState === WebSocket.OPEN && client.gameId === id) {
            client.send(message);
          }
        });
      }
    }, mode);
    this.games.set(id, game);
    return game;
  }

  createGame(mode: 'solo' | 'multiplayer' = 'multiplayer'): Game {
    const id = Math.random().toString(36).substring(7);
    return this.createGameWithId(id, mode);
  }

  getGame(id: string): Game | undefined {
    return this.games.get(id);
  }
}

export const storage = new MemStorage();
