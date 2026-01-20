import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { Game } from "./game";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game Storage
  createGame(): Game;
  getGame(id: string): Game | undefined;
}

export class MemStorage implements IStorage {
  private games: Map<string, Game>;

  constructor() {
    this.games = new Map();
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

  createGame(): Game {
    const id = Math.random().toString(36).substring(7);
    const game = new Game(id, (state) => {
      // Broadcast hook - handled in routes
    });
    this.games.set(id, game);
    return game;
  }

  getGame(id: string): Game | undefined {
    return this.games.get(id);
  }
}

export const storage = new MemStorage();
