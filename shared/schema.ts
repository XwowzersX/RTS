import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Game Constants ---
export const MAP_WIDTH = 4000;
export const MAP_HEIGHT = 4000;
export const TICK_RATE = 10; // Updates per second

export type ResourceType = 'wood' | 'stone' | 'iron' | 'ladders';
export type UnitType = 'lumberjack' | 'miner' | 'knight' | 'archer' | 'builder';
export type BuildingType = 'hub' | 'barracks' | 'iron_works' | 'factory' | 'wall' | 'watchtower';

export const COSTS: Record<UnitType | BuildingType | 'iron_ingot' | 'ladder', Partial<Record<ResourceType, number>>> = {
  // Units
  lumberjack: { wood: 3, stone: 5 },
  miner: { wood: 5, stone: 2 },
  knight: { wood: 2, stone: 3, iron: 5 },
  archer: { wood: 5, stone: 5, iron: 5 },
  builder: { wood: 5, stone: 5 },
  // Buildings
  hub: { wood: 0, stone: 0 },
  barracks: { wood: 10, stone: 15 },
  iron_works: { wood: 15, stone: 10 },
  factory: { wood: 10, stone: 10 },
  wall: { wood: 5, stone: 5 },
  watchtower: { wood: 20, stone: 20, iron: 10 },
  // Production
  iron_ingot: { stone: 5 },
  ladder: { wood: 5 },
};

export const PRODUCTION_TIME: Record<string, number> = {
  iron_ingot: 5000,
  ladder: 5000,
  knight: 10000,
  archer: 10000,
  miner: 3000,
  lumberjack: 3000,
  builder: 5000,
};

export const UNIT_STATS: Record<UnitType, { hp: number, attack: number, speed: number, range: number }> = {
  lumberjack: { hp: 20, attack: 2, speed: 1.5, range: 10 },
  miner: { hp: 20, attack: 2, speed: 1.5, range: 10 },
  knight: { hp: 80, attack: 10, speed: 2, range: 15 },
  archer: { hp: 40, attack: 8, speed: 1.8, range: 150 },
  builder: { hp: 30, attack: 2, speed: 1.4, range: 10 },
};

export const BUILDING_STATS: Record<BuildingType, { hp: number, size: number }> = {
  hub: { hp: 1000, size: 60 },
  barracks: { hp: 300, size: 50 },
  iron_works: { hp: 300, size: 50 },
  factory: { hp: 300, size: 50 },
  wall: { hp: 500, size: 40 },
  watchtower: { hp: 400, size: 40 },
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
  state: 'idle' | 'moving' | 'attacking' | 'gathering' | 'returning' | 'building' | 'producing';
  targetId?: string; 
  targetPosition?: Position;
  buildProgress?: number;
  buildType?: BuildingType;
  productionQueue?: (UnitType | 'iron_ingot' | 'ladder')[];
  productionTimer?: number;
  isClimbing?: boolean;
}

export interface PlayerState {
  id: string;
  color: string;
  resources: Record<ResourceType, number>;
  population: number;
  researched: string[];
}

export interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'ended';
  players: Record<string, PlayerState>;
  entities: Record<string, Entity>;
  resources: { id: string, type: 'tree' | 'rock', position: Position, amount: number }[];
  winner?: string;
  startTime?: number;
  resourceClusters?: Position[];
  fogOfWar?: Record<string, boolean[]>; // playerId -> grid of visibility (100x100 for 4000x4000 map)
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
  | { type: typeof WS_MESSAGES.ACTION_BUILD, payload: { buildingType: BuildingType, position: Position, builderId?: string } }
  | { type: typeof WS_MESSAGES.ACTION_TRAIN, payload: { buildingId: string, unitType: UnitType } };

// --- DB Schema ---
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
