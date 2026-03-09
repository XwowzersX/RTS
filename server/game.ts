import { PRODUCTION_TIME, UNIT_STATS, BUILDING_STATS, COSTS, MAP_WIDTH, MAP_HEIGHT, type GameState, type PlayerState, type Entity, type Position, type UnitType, type BuildingType, type ResourceType } from "@shared/schema";
import { randomUUID } from "crypto";
import { storage } from "./storage";

export class Game {
  id: string;
  state: GameState;
  private loopInterval: NodeJS.Timeout | null = null;
  private onUpdate: (state: GameState) => void;
  private aiPlayerId: string | null = null;
  private mode: 'solo' | 'multiplayer';

  constructor(id: string, onUpdate: (state: GameState) => void, mode: 'solo' | 'multiplayer' = 'multiplayer') {
    this.id = id;
    this.onUpdate = onUpdate;
    this.mode = mode;
    this.state = {
      id,
      status: 'waiting',
      players: {},
      entities: {},
      resources: [],
      resourceClusters: [],
      fogOfWar: {},
    };
    this.state.resources = this.generateResources();
  }

  private generateResources() {
    const resources: GameState['resources'] = [];
    const NUM_CLUSTERS = 8;
    const RESOURCES_PER_CLUSTER = 6;
    const CLUSTER_RADIUS = 150;
    const HUB_OFFSET = 120; // Hub must be placed this far from cluster center

    // Fixed locations for clusters (near starts and around map)
    const clusterCenters = [
      { x: 250, y: 250 }, // Near Blue Start
      { x: MAP_WIDTH - 250, y: MAP_HEIGHT - 250 }, // Near Red Start
      { x: MAP_WIDTH / 2, y: 200 }, // Mid North
      { x: MAP_WIDTH / 2, y: MAP_HEIGHT - 200 }, // Mid South
      { x: 200, y: MAP_HEIGHT / 2 }, // Mid West
      { x: MAP_WIDTH - 200, y: MAP_HEIGHT / 2 }, // Mid East
      { x: 1000, y: 1000 },
      { x: MAP_WIDTH - 1000, y: MAP_HEIGHT - 1000 }
    ];

    // Store cluster centers for hub placement validation
    (this.state as any).resourceClusters = clusterCenters;

    let resCount = 0;
    clusterCenters.forEach((center, cIdx) => {
      // Create resource ring - spaced out more
      for (let i = 0; i < RESOURCES_PER_CLUSTER; i++) {
        const angle = (i / RESOURCES_PER_CLUSTER) * Math.PI * 2;
        // Resources are placed in a wider ring around the center
        const x = center.x + Math.cos(angle) * (CLUSTER_RADIUS * 0.9);
        const y = center.y + Math.sin(angle) * (CLUSTER_RADIUS * 0.9);
        
        resources.push({
          id: `res-${resCount++}`,
          type: cIdx % 2 === 0 ? 'tree' : 'rock',
          amount: 1000,
          position: { x, y }
        });
      }
    });

    return resources;
  }

  addPlayer(name: string): string {
    const playerId = randomUUID();
    const color = Object.keys(this.state.players).length === 0 ? 'blue' : 'red';
    
    // Initial Hub Position
    const startX = color === 'blue' ? 100 : MAP_WIDTH - 100;
    const startY = color === 'blue' ? 100 : MAP_HEIGHT - 100;

    this.state.players[playerId] = {
      id: playerId,
      color,
      resources: { wood: 50, stone: 30, iron: 10 },
      population: 0,
      researched: [],
    };

    // Create Hub
    const hubId = randomUUID();
    this.state.entities[hubId] = {
      id: hubId,
      playerId,
      type: 'hub',
      position: { x: startX, y: startY },
      hp: BUILDING_STATS.hub.hp,
      maxHp: BUILDING_STATS.hub.hp,
      state: 'idle'
    };

    // Create 1 Worker
    const workerId = randomUUID();
    this.state.entities[workerId] = {
      id: workerId,
      playerId,
      type: 'lumberjack',
      position: { x: startX + 50, y: startY + 50 },
      hp: UNIT_STATS.lumberjack.hp,
      maxHp: UNIT_STATS.lumberjack.hp,
      state: 'idle'
    };

    // Auto-start if 2 players (multiplayer) or 1 player + AI (solo)
    if (Object.keys(this.state.players).length === 2 && this.state.status === 'waiting') {
      this.start();
    } else if (this.mode === 'solo' && Object.keys(this.state.players).length === 1 && this.state.status === 'waiting') {
      // Add AI as second player for solo mode
      this.aiPlayerId = this.addPlayer("IronMind AI");
      this.start();
    }

    return playerId;
  }

  start() {
    this.state.status = 'playing';
    this.state.startTime = Date.now();
    this.loopInterval = setInterval(() => this.tick(), 1000 / 10); // 10 TPS
  }

  stop() {
    if (this.loopInterval) clearInterval(this.loopInterval);
    this.state.status = 'ended';
  }

  private tick() {
    if (this.state.status !== 'playing') return;

    // AI Logic Tick
    if (this.aiPlayerId) {
      this.handleAILogic(this.aiPlayerId);
    }

    // Game Logic Loop
    this.updateFogOfWar();
    for (const entityId in this.state.entities) {
      const entity = this.state.entities[entityId];
      if (entity.hp <= 0) {
        // Record Kill for the attacker if possible
        if (entity.targetId) {
           const killer = this.state.entities[entity.targetId];
           if (killer && killer.playerId !== entity.playerId) {
              this.incrementStat(killer.playerId, 'kills', 1);
           }
        }

        if (entity.type === 'hub') {
          this.state.winner = Object.keys(this.state.players).find(id => id !== entity.playerId);
          if (this.state.winner) {
            this.incrementStat(this.state.winner, 'wins', 1);
            const loser = Object.keys(this.state.players).find(id => id !== this.state.winner);
            if (loser) this.incrementStat(loser, 'losses', 1);
          }
          this.stop();
        }
        
        // Release garrisoned units if bunker destroyed
        if (entity.type === 'bunker') {
          const gIds = (entity as any).garrisonedIds || [];
          gIds.forEach((id: string) => {
            const unit = this.state.entities[id];
            if (unit) {
              unit.state = 'idle';
              delete (unit as any).bunkerId;
            }
          });
        }

        delete this.state.entities[entityId];
        continue;
      }
      
      this.handleEntityBehavior(entity);
      
      // Watchtower/Bunker Automatic Attack
      if ((entity.type === 'watchtower' || entity.type === 'bunker') && entity.hp > 0) {
        let nearestEnemy: any = null;
        let range = entity.type === 'watchtower' ? 300 : 300; // Range
        
        // Apply Fortified Structures bonus to defensive buildings range
        const player = this.state.players[entity.playerId];
        if (player?.researched?.includes('fortified_structures')) range *= 1.2;
        
        let minDist = range;
        
        // Bunker damage depends on garrison
        const garrisonCount = (entity as any).garrisonedIds?.length || 0;
        if (entity.type === 'bunker' && garrisonCount === 0) continue;

        for (const targetId in this.state.entities) {
          const target = this.state.entities[targetId];
          if (target.playerId !== entity.playerId && target.hp > 0) {
            const dist = this.distance(entity.position, target.position);
            if (dist < minDist) {
              minDist = dist;
              nearestEnemy = target;
            }
          }
        }
        
        if (nearestEnemy) {
          const damage = entity.type === 'watchtower' ? 1 : garrisonCount * 2;
          nearestEnemy.hp -= damage;
        }
      }
    }

    this.onUpdate(this.state);
  }

  private handleAILogic(aiId: string) {
    const aiPlayer = this.state.players[aiId];
    const aiEntities = Object.values(this.state.entities).filter(e => e.playerId === aiId);
    const opponentId = Object.keys(this.state.players).find(id => id !== aiId);
    if (!opponentId) return;
    const opponentEntities = Object.values(this.state.entities).filter(e => e.playerId === opponentId);

    // AI Economy: Workers should gather
    const workers = aiEntities.filter(e => e.type === 'lumberjack' || e.type === 'miner');
    
    // Split workers between wood and stone
    workers.forEach((w, idx) => {
      if (w.state === 'idle') {
        const targetType = idx % 2 === 0 ? 'tree' : 'rock';
        let nearestRes = null;
        let minDist = Infinity;
        
        this.state.resources.forEach(res => {
          if (res.type === targetType) {
            const d = this.distance(w.position, res.position);
            if (d < minDist) {
              minDist = d;
              nearestRes = res;
            }
          }
        });

        if (nearestRes) {
          this.handleAction(aiId, {
            type: 'action_gather',
            payload: { entityIds: [w.id], resourceId: (nearestRes as any).id }
          });
        }
      }
    });

    // AI Production: Keep producing workers if population low
    const hub = aiEntities.find(e => e.type === 'hub');
    const workerLimit = 16; // Increased from 12
    if (hub && workers.length < workerLimit && aiPlayer.resources.wood >= 5 && aiPlayer.resources.stone >= 5) {
      if (!hub.productionQueue || hub.productionQueue.length < 3) {
        this.handleAction(aiId, {
          type: 'action_train',
          payload: { buildingId: hub.id, unitType: 'lumberjack' }
        });
      }
    }

    // AI Military: Produce units if resources available
    const barracks = aiEntities.find(e => e.type === 'barracks');
    if (barracks && aiPlayer.resources.wood >= 5 && aiPlayer.resources.stone >= 5 && aiPlayer.resources.iron >= 5) {
      if (!barracks.productionQueue || barracks.productionQueue.length < 2) {
        // More balanced unit composition
        const rand = Math.random();
        const unitToTrain = aiPlayer.resources.iron >= 25 && rand > 0.7 ? 'firebird' : 
                          (rand > 0.35 ? 'knight' : 'archer');
        this.handleAction(aiId, {
          type: 'action_train',
          payload: { buildingId: barracks.id, unitType: unitToTrain }
        });
      }
    }

    // AI Construction: Build barracks if none
    const builder = aiEntities.find(e => e.type === 'builder');
    if (builder && !barracks && aiPlayer.resources.wood >= 10 && aiPlayer.resources.stone >= 15) {
      if (builder.state === 'idle') {
        const buildPos = { x: builder.position.x + 200, y: builder.position.y + 200 };
        this.handleAction(aiId, {
          type: 'action_build',
          payload: { buildingType: 'barracks', position: buildPos, builderId: builder.id }
        });
      }
    }

    // AI Tech: Build Research Hub and get upgrades
    const researchHub = aiEntities.find(e => e.type === 'research_hub');
    if (builder && !researchHub && aiPlayer.resources.wood >= 10 && aiPlayer.resources.stone >= 10 && aiPlayer.resources.iron >= 1) {
      if (builder.state === 'idle') {
        const buildPos = { x: builder.position.x - 200, y: builder.position.y + 200 };
        this.handleAction(aiId, {
          type: 'action_build',
          payload: { buildingType: 'research_hub', position: buildPos, builderId: builder.id }
        });
      }
    }

    if (researchHub && aiPlayer.resources.iron >= 50 && aiPlayer.resources.wood >= 50) {
      if (!researchHub.productionQueue || researchHub.productionQueue.length === 0) {
        const tech = !aiPlayer.researched.includes('speed_boost') ? 'speed_boost' : 
                     (!aiPlayer.researched.includes('combat_training') && aiPlayer.resources.wood >= 40 && aiPlayer.resources.iron >= 60) ? 'combat_training' : null;
        if (tech) {
          this.handleAction(aiId, {
            type: 'action_train',
            payload: { buildingId: researchHub.id, unitType: tech as any }
          });
        }
      }
    }

    // AI Defense: Build Watchtowers/Bunkers near Hub if attacked
    const watchtower = aiEntities.find(e => e.type === 'watchtower');
    const bunker = aiEntities.find(e => e.type === 'bunker');
    const hubPos = hub?.position;
    const beingAttacked = hub && hub.hp < hub.maxHp;
    
    if (builder && beingAttacked && builder.state === 'idle' && hubPos) {
      if (!watchtower && aiPlayer.resources.wood >= 20 && aiPlayer.resources.stone >= 20 && aiPlayer.resources.iron >= 10) {
        this.handleAction(aiId, {
          type: 'action_build',
          payload: { buildingType: 'watchtower', position: { x: hubPos.x + 100, y: hubPos.y }, builderId: builder.id }
        });
      } else if (!bunker && aiPlayer.resources.wood >= 40 && aiPlayer.resources.stone >= 40 && aiPlayer.resources.iron >= 20) {
        this.handleAction(aiId, {
          type: 'action_build',
          payload: { buildingType: 'bunker', position: { x: hubPos.x - 100, y: hubPos.y }, builderId: builder.id }
        });
      }
    }

    // AI Attack: If army size > threshold, launch attack
    const army = aiEntities.filter(e => e.type === 'knight' || e.type === 'archer' || e.type === 'firebird');
    const attackThreshold = 12;
    if (army.length >= attackThreshold) {
      const opponentHub = opponentEntities.find(e => e.type === 'hub');
      // Prioritize military targets, then buildings, then workers
      const targets = [...opponentEntities].sort((a, b) => {
        const isMilitary = (type: string) => ['knight', 'archer', 'firebird', 'watchtower', 'bunker'].includes(type);
        const aMil = isMilitary(a.type);
        const bMil = isMilitary(b.type);
        if (aMil && !bMil) return -1;
        if (!aMil && bMil) return 1;
        
        const da = this.distance(hub?.position || {x:0,y:0}, a.position);
        const db = this.distance(hub?.position || {x:0,y:0}, b.position);
        return (a.hp - b.hp) || (da - db);
      });

      const target = targets[0] || opponentHub;
      
      if (target) {
        const idleArmy = army.filter(u => u.state === 'idle' || u.state === 'moving');
        if (idleArmy.length > 0) {
          this.handleAction(aiId, {
            type: 'action_attack',
            payload: { entityIds: idleArmy.map(u => u.id), targetEntityId: target.id }
          });
        }
      }
    }

    // AI Micro: If units are being attacked, focus fire on the attacker
    army.forEach(unit => {
      if (unit.hp < unit.maxHp && unit.state !== 'attacking') {
        const nearbyAttacker = opponentEntities.find(opp => 
          opp.state === 'attacking' && opp.targetId === unit.id
        );
        if (nearbyAttacker) {
          this.handleAction(aiId, {
            type: 'action_attack',
            payload: { entityIds: [unit.id], targetEntityId: nearbyAttacker.id }
          });
        }
      }
    });
  }

  private updateFogOfWar() {
    const GRID_SIZE = 100;
    const CELL_SIZE = MAP_WIDTH / GRID_SIZE;
    
    for (const playerId in this.state.players) {
      if (!this.state.fogOfWar![playerId]) {
        this.state.fogOfWar![playerId] = new Array(GRID_SIZE * GRID_SIZE).fill(false);
      }
      
      const fog = this.state.fogOfWar![playerId];
      const entities = Object.values(this.state.entities).filter(e => e.playerId === playerId);
      
      for (let i = 0; i < fog.length; i++) {
        const gx = i % GRID_SIZE;
        const gy = Math.floor(i / GRID_SIZE);
        const worldX = gx * CELL_SIZE + CELL_SIZE / 2;
        const worldY = gy * CELL_SIZE + CELL_SIZE / 2;
        
        let visible = false;
        for (const entity of entities) {
          const visionRange = entity.type === 'archer' ? 300 : entity.type === 'hub' ? 400 : entity.type === 'watchtower' ? 500 : 200;
          const dx = worldX - entity.position.x;
          const dy = worldY - entity.position.y;
          if (dx*dx + dy*dy < visionRange*visionRange) {
            visible = true;
            break;
          }
        }
        fog[i] = visible;
      }
    }
  }

  private incrementStat(playerId: string, field: string, amount: number) {
    const player = this.state.players[playerId];
    if (player && (player as any).userId) {
       // Get current user stats first to increment, or use a db.update with increment logic
       // For simplicity in MemStorage, we'll just send the increment
       storage.updateUserStats((player as any).userId, { [field]: amount });
    }
  }

  private handleEntityBehavior(entity: Entity) {
    if (entity.state === 'building' && entity.targetPosition) {
        const dist = this.distance(entity.position, entity.targetPosition);
        if (dist > 30) {
            this.moveTowards(entity, entity.targetPosition);
        } else if (entity.buildType) {
            // Reached construction site
            const id = randomUUID();
            const buildingType = entity.buildType;
            this.state.entities[id] = {
                id,
                playerId: entity.playerId,
                type: buildingType,
                position: { ...entity.targetPosition },
                hp: BUILDING_STATS[buildingType].hp,
                maxHp: BUILDING_STATS[buildingType].hp,
                state: 'idle'
            };
            entity.state = 'idle';
            entity.targetPosition = undefined;
            entity.buildType = undefined;
        }
    }

    if (entity.state === 'moving' && entity.targetId) {
       // Movement logic handled by client-side prediction mostly, but server validates/simulates
       // For this MVP, we rely on `moveEntity` calls setting a destination or behavior
    }
    
    // Very basic gathering logic simulation
    if (entity.state === 'gathering' && entity.targetId) {
      const resourceIdx = this.state.resources.findIndex(r => r.id === entity.targetId);
      const resource = this.state.resources[resourceIdx];
      
      if (resource) {
        const dist = this.distance(entity.position, resource.position);
        if (dist < 30) {
           // Gather amount
           resource.amount -= 10;
           if (resource.amount <= 0) {
             this.state.resources.splice(resourceIdx, 1);
           }
           entity.state = 'returning';
        } else {
          this.moveTowards(entity, resource.position);
        }
      } else {
        entity.state = 'idle';
      }
    }

    if (entity.state === 'returning') {
      const hub = Object.values(this.state.entities).find(e => e.type === 'hub' && e.playerId === entity.playerId);
      if (hub) {
        const dist = this.distance(entity.position, hub.position);
        
        // Garrisoned units skip behavior
        let isGarrisoned = false;
        for (const eId in this.state.entities) {
          const b = this.state.entities[eId];
          if (b.type === 'bunker' && (b as any).garrisonedIds?.includes(entity.id)) {
            isGarrisoned = true;
            break;
          }
        }
        if (isGarrisoned) return;

        if (dist < 50) {
          const type = entity.type === 'lumberjack' ? 'wood' : 'stone';
          this.state.players[entity.playerId].resources[type] += 1;
          this.incrementStat(entity.playerId, 'resources_gathered', 1);
          entity.state = 'gathering'; 
        } else {
          this.moveTowards(entity, hub.position);
        }
      }
    }
    
    // Combat
    if (entity.state === 'attacking' && entity.targetId) {
      const target = this.state.entities[entity.targetId];
      if (target) {
        const stats = UNIT_STATS[entity.type as UnitType];
        if (stats) {
          const dist = this.distance(entity.position, target.position);
          
          let attackDamage = stats.attack * 0.2;
          const player = this.state.players[entity.playerId];
          if (player?.researched?.includes('combat_training') && (entity.type === 'knight' || entity.type === 'archer')) {
            attackDamage *= 1.2;
          }
          
          // Bunker Garrison Check
          const bunkerId = (entity as any).bunkerId;
          if (bunkerId) {
             const bunker = this.state.entities[bunkerId];
             if (bunker && bunker.type === 'bunker' && bunker.hp > 0) {
               if (dist < 10) {
                  if (!((bunker as any).garrisonedIds)) (bunker as any).garrisonedIds = [];
                  if (!(bunker as any).garrisonedIds.includes(entity.id)) {
                    (bunker as any).garrisonedIds.push(entity.id);
                  }
                  return; // Entity is now "hidden" in bunker
               }
             } else {
               delete (entity as any).bunkerId;
             }
          }

          // Damage logic (simplified for archers in bunkers)
          let isGarrisoned = false;
          for (const eId in this.state.entities) {
            const b = this.state.entities[eId];
            if (b.type === 'bunker' && (b as any).garrisonedIds?.includes(entity.id)) {
              isGarrisoned = true;
              break;
            }
          }
          if (isGarrisoned) return; // Garrisoned units don't move/attack normally

          if (dist <= stats.range + 10) { 
             target.hp -= attackDamage; 
             // Firebird burn effect
             if (entity.type === 'firebird') {
               target.burnTicks = 50; // 5 seconds of burn
             }
          } else {
             this.moveTowards(entity, target.position);
          }
        }
      } else {
        entity.state = 'idle';
      }
    }

    // Burn damage
    if (entity.burnTicks && entity.burnTicks > 0) {
      entity.hp -= 0.5;
      entity.burnTicks--;
    }

    // Production logic
    if (entity.state === 'producing' || (entity.productionQueue && entity.productionQueue.length > 0)) {
        const item = entity.productionQueue![0];
        const prodTime = PRODUCTION_TIME[item] || 5000;
        if (!entity.productionTimer) {
            entity.productionTimer = prodTime;
            entity.state = 'producing';
        }

        entity.productionTimer -= 100; // 10 TPS = 100ms per tick

        if (entity.productionTimer <= 0) {
            const item = entity.productionQueue!.shift();
            entity.productionTimer = undefined;
            
            if (item === 'iron_ingot') {
                this.state.players[entity.playerId].resources.iron += 1;
            } else if ((item as string) === 'speed_boost') {
                const player = this.state.players[entity.playerId];
                if (!player.researched) {
                  player.researched = [];
                }
                if (!player.researched.includes('speed_boost')) {
                  player.researched.push('speed_boost');
                }
            } else if ((item as string) === 'combat_training') {
                const player = this.state.players[entity.playerId];
                if (!player.researched) player.researched = [];
                if (!player.researched.includes('combat_training')) {
                  player.researched.push('combat_training');
                }
            } else if ((item as string) === 'fortified_structures') {
                const player = this.state.players[entity.playerId];
                if (!player.researched) player.researched = [];
                if (!player.researched.includes('fortified_structures')) {
                  player.researched.push('fortified_structures');
                }
            } else if (item) {
                // Train unit
                const id = randomUUID();
                this.state.entities[id] = {
                    id,
                    playerId: entity.playerId,
                    type: item as UnitType,
                    position: { x: entity.position.x + 80, y: entity.position.y + 80 },
                    hp: UNIT_STATS[item as UnitType].hp,
                    maxHp: UNIT_STATS[item as UnitType].hp,
                    state: 'idle'
                };
            }

            if (entity.productionQueue!.length === 0) {
                entity.state = 'idle';
            }
        }
    }

    // General Moving (Action Move)
    if (entity.state === 'moving' && entity.targetId === undefined) { 
        const dest = (entity as any).destination;
        if (dest) {
             const dist = this.distance(entity.position, dest);
             if (dist < 5) {
                 entity.state = 'idle';
                 delete (entity as any).destination;
             } else {
                 this.moveTowards(entity, dest);
             }
        }
    }
  }

  private moveTowards(entity: Entity, target: Position) {
    const player = this.state.players[entity.playerId];
    const speedMult = (player?.researched?.includes('speed_boost')) ? 1.2 : 1;
    
    // Hubs move extremely slowly
    const isHub = entity.type === 'hub';
    const baseSpeed = isHub ? 0.1 : (UNIT_STATS[entity.type as UnitType]?.speed || 1);
    const speed = baseSpeed * 3 * speedMult;
    const dx = target.x - entity.position.x;
    const dy = target.y - entity.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 5) {
      const nextX = entity.position.x + (dx / dist) * speed;
      const nextY = entity.position.y + (dy / dist) * speed;

      entity.position.x = nextX;
      entity.position.y = nextY;
    } else {
      entity.position.x = target.x;
      entity.position.y = target.y;
    }
  }

  private distance(p1: Position, p2: Position): number {
    if (!p1 || !p2) return Infinity;
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  // Actions
  handleAction(playerId: string, action: any) {
    if (action.type === 'action_move') {
       const { entityIds, target } = action.payload;
       
       // Bunker Click Check
       const clickedBunker = Object.values(this.state.entities).find(e => 
         e.type === 'bunker' && 
         e.playerId === playerId && 
         this.distance(target, e.position) < 30
       );

       // Special Hub Right-Click Snap Logic
       const clusters = (this.state as any).resourceClusters || [];
       const snapSpot = clusters.find((center: Position) => this.distance(target, center) < 120);
       
       const hubsInSelection = entityIds.map((id: string) => this.state.entities[id]).filter((e: any) => e && e.type === 'hub' && e.playerId === playerId);
       
       if (hubsInSelection.length > 0) {
         if (snapSpot) {
           hubsInSelection.forEach((hub: any) => {
             hub.state = 'moving';
             hub.destination = { ...snapSpot };
           });
         }
         return;
       }

       console.log(`Action Move for ${entityIds.length} units to ${JSON.stringify(target)}`);
       entityIds.forEach((id: string) => {
         const e = this.state.entities[id];
         if (e && e.playerId === playerId) {
            if (clickedBunker && e.type === 'archer') {
               (e as any).bunkerId = clickedBunker.id;
               e.state = 'moving';
               (e as any).destination = clickedBunker.position;
               return;
            }
            e.state = 'moving';
            (e as any).destination = target;
            e.targetId = undefined;
         }
       });
    }
    if (action.type === 'action_gather') {
       const { entityIds, resourceId } = action.payload;
       entityIds.forEach((id: string) => {
         const e = this.state.entities[id];
         if (e && e.playerId === playerId && (e.type === 'lumberjack' || e.type === 'miner')) {
            e.state = 'gathering';
            e.targetId = resourceId;
         }
       });
    }
    if (action.type === 'action_attack') {
        const { entityIds, targetEntityId } = action.payload;
        entityIds.forEach((id: string) => {
            const e = this.state.entities[id];
            if (e && e.playerId === playerId) {
                e.state = 'attacking';
                e.targetId = targetEntityId;
            }
        });
    }
    if (action.type === 'action_build') {
        const { buildingType, position, builderId } = action.payload;
        
        // Hub relocation logic
        if (buildingType === 'hub') {
          const clusters = (this.state as any).resourceClusters || [];
          // Find the exact cluster center to snap to within a slightly larger radius for click comfort
          const snapSpot = clusters.find((center: Position) => this.distance(position, center) < 80);
          
          if (!snapSpot) return;

          // If hub already exists, move it instead of building new
          const existingHub = Object.values(this.state.entities).find(e => e.type === 'hub' && e.playerId === playerId);
          if (existingHub) {
            existingHub.state = 'moving';
            (existingHub as any).destination = snapSpot;
            return;
          }
          
          // Use snapped position for new hub too
          const newHub = {
            id: `hub-${playerId}-${Date.now()}`,
            type: 'hub',
            playerId,
            position: snapSpot,
            hp: BUILDING_STATS.hub.hp,
            maxHp: BUILDING_STATS.hub.hp,
            state: 'idle'
          };
          this.state.entities[newHub.id] = newHub as any;
          return;
        }

        if (!builderId) return;
        
        const builder = this.state.entities[builderId];
        if (!builder || builder.type !== 'builder' || builder.playerId !== playerId) {
            return;
        }

        const cost = COSTS[buildingType as BuildingType];
        const player = this.state.players[playerId];
        
        let canAfford = true;
        if (cost.wood && player.resources.wood < cost.wood) canAfford = false;
        if (cost.stone && player.resources.stone < cost.stone) canAfford = false;
        if (cost.iron && player.resources.iron < cost.iron) canAfford = false;
        
        if (canAfford) {
            if (cost.wood) player.resources.wood -= cost.wood;
            if (cost.stone) player.resources.stone -= cost.stone;
            if (cost.iron) player.resources.iron -= cost.iron;
            
            builder.state = 'building';
            builder.targetPosition = position;
            builder.buildType = buildingType as BuildingType;
        }
    }
    if (action.type === 'action_train') {
        const { buildingId, unitType } = action.payload;
        const building = this.state.entities[buildingId];
        if (building && building.playerId === playerId) {
             if (unitType === 'ungarrison' && building.type === 'bunker') {
               const gIds = (building as any).garrisonedIds || [];
               gIds.forEach((id: string) => {
                 const unit = this.state.entities[id];
                 if (unit) {
                   unit.state = 'idle';
                   // Pop unit out slightly away from bunker
                   unit.position = { 
                     x: building.position.x + (Math.random() - 0.5) * 40, 
                     y: building.position.y + 60 
                   };
                   delete (unit as any).bunkerId;
                 }
               });
               (building as any).garrisonedIds = [];
               return;
             }

             const cost = unitType === 'speed_boost' ? { iron: 50, wood: 50 } : 
                          unitType === 'combat_training' ? { wood: 40, iron: 60 } :
                          unitType === 'fortified_structures' ? { stone: 80, iron: 40 } :
                          COSTS[unitType as keyof typeof COSTS];
             const player = this.state.players[playerId];
             
             let canAfford = true;
             if (cost.wood && player.resources.wood < cost.wood) canAfford = false;
             if (cost.stone && player.resources.stone < cost.stone) canAfford = false;
             if (cost.iron && player.resources.iron < cost.iron) canAfford = false;

             if (canAfford) {
                if (cost.wood) player.resources.wood -= cost.wood;
                if (cost.stone) player.resources.stone -= cost.stone;
                if (cost.iron) player.resources.iron -= cost.iron;

                if (!building.productionQueue) building.productionQueue = [];
                building.productionQueue.push(unitType);
             }
        }
    }
  }
}
