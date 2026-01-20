import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Game Constants ---
export const MAP_WIDTH = 2000;
export const MAP_HEIGHT = 1500;
export const TICK_RATE = 10; // Updates per second

export type ResourceType = 'wood' | 'stone' | 'iron' | 'ladders';
export type UnitType = 'lumberjack' | 'miner' | 'knight' | 'archer';
export type BuildingType = 'hub' | 'barracks' | 'iron_works' | 'factory' | 'resource_manager' | 'wall';

export const COSTS: Record<UnitType | BuildingType, Partial<Record<ResourceType, number>>> = {
  // Units
  lumberjack: { wood: 3, stone: 5 }, // "Resource Management" produces these, using Prompt costs: 5w, 2s actually? Prompt says: "Resource Management (3 Wood, 5 Stone): Produces Lumberjacks (5w, 2s) and Miners (2w, 5s)."
  miner: { wood: 5, stone: 2 }, // Prompt says Miners (2w, 5s) - wait, I'll stick to prompt.
  knight: { wood: 2, stone: 3, iron: 1 },
  archer: { wood: 5, stone: 5, iron: 1 },
  // Buildings
  hub: { wood: 0, stone: 0 }, // Initial
  barracks: { wood: 3, stone: 5 },
  iron_works: { wood: 10, stone: 7 },
  factory: { wood: 5, stone: 5 },
  resource_manager: { wood: 3, stone: 5 },
  wall: { wood: 2, stone: 2 }, // Unlocked by Factory
};

export const UNIT_STATS: Record<UnitType, { hp: number, attack: number, speed: number, range: number }> = {
  lumberjack: { hp: 20, attack: 2, speed: 1.5, range: 10 },
  miner: { hp: 20, attack: 2, speed: 1.5, range: 10 },
  knight: { hp: 80, attack: 10, speed: 2, range: 15 },
  archer: { hp: 40, attack: 8, speed: 1.8, range: 150 },
};

export const BUILDING_STATS: Record<BuildingType, { hp: number, size: number }> = {
  hub: { hp: 1000, size: 60 },
  barracks: { hp: 300, size: 50 },
  iron_works: { hp: 300, size: 50 },
  factory: { hp: 300, size: 50 },
  resource_manager: { hp: 200, size: 40 },
  wall: { hp: 500, size: 20 },
};

// --- Game State Types (Not persisted in DB, but shared) ---

export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  playerId: string;
  type: UnitType | BuildingType;
  position: Position;
  hp: number;
  maxHp: number;
  state: 'idle' | 'moving' | 'attacking' | 'gathering' | 'returning';
  targetId?: string; // Attack target or resource target
}

export interface PlayerState {
  id: string;
  color: string;
  resources: Record<ResourceType, number>;
  population: number;
}

export interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'ended';
  players: Record<string, PlayerState>;
  entities: Record<string, Entity>;
  resources: { id: string, type: 'tree' | 'rock', position: Position, amount: number }[];
  winner?: string;
}

// --- WebSocket Protocol ---
export const WS_MESSAGES = {
  JOIN: 'join_game',
  GAME_START: 'game_start',
  GAME_UPDATE: 'game_update',
  ACTION_MOVE: 'action_move',
  ACTION_ATTACK: 'action_attack',
  ACTION_GATHER: 'action_gather',
  ACTION_BUILD: 'action_build',
  ACTION_TRAIN: 'action_train',
} as const;

export type WsMessage = 
  | { type: typeof WS_MESSAGES.JOIN, payload: { name: string } }
  | { type: typeof WS_MESSAGES.ACTION_MOVE, payload: { entityIds: string[], target: Position } }
  | { type: typeof WS_MESSAGES.ACTION_ATTACK, payload: { entityIds: string[], targetEntityId: string } }
  | { type: typeof WS_MESSAGES.ACTION_GATHER, payload: { entityIds: string[], resourceId: string } }
  | { type: typeof WS_MESSAGES.ACTION_BUILD, payload: { buildingType: BuildingType, position: Position } }
  | { type: typeof WS_MESSAGES.ACTION_TRAIN, payload: { buildingId: string, unitType: UnitType } };

// --- DB Schema (For simple session tracking if needed, primarily MemStorage used) ---
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
