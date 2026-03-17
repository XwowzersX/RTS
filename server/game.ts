import { PRODUCTION_TIME, UNIT_STATS, BUILDING_STATS, COSTS, MAP_WIDTH, MAP_HEIGHT, type GameState, type PlayerState, type Entity, type Position, type UnitType, type BuildingType, type ResourceType, type Obstacle } from "@shared/schema";
import { randomUUID } from "crypto";
import { storage } from "./storage";

export class Game {
  id: string;
  state: GameState;
  private loopInterval: NodeJS.Timeout | null = null;
  private onUpdate: (state: GameState) => void;
  private aiPlayerIds: string[] = [];
  private mode: 'solo' | 'multiplayer' | 'survival';
  private tickCount: number = 0;
  private garrisonedSet: Set<string> = new Set();

  constructor(id: string, onUpdate: (state: GameState) => void, mode: 'solo' | 'multiplayer' | 'survival' = 'multiplayer') {
    this.id = id;
    this.onUpdate = onUpdate;
    this.mode = mode;
    this.state = {
      id,
      status: 'waiting',
      mode,
      players: {},
      entities: {},
      resources: [],
      resourceClusters: [],
      fogOfWar: {},
    };
    this.state.resources = this.generateResources();
    if (mode === 'survival') {
      this.state.obstacles = this.generateObstacles();
    }
  }

  private generateObstacles(): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const types: Obstacle['type'][] = ['ruin', 'rock', 'wreck'];
    const safeZones = [
      { x: 2000, y: 2000, r: 400 }, // Player center
      { x: 200,  y: 200,  r: 350 }, // AI corner 1
      { x: MAP_WIDTH - 200, y: 200, r: 350 }, // AI corner 2
      { x: 200,  y: MAP_HEIGHT - 200, r: 350 }, // AI corner 3
    ];

    const isSafe = (x: number, y: number, r: number) =>
      safeZones.some(z => Math.hypot(x - z.x, y - z.y) < z.r + r + 80);

    let attempts = 0;
    while (obstacles.length < 28 && attempts < 500) {
      attempts++;
      const x = 300 + Math.random() * (MAP_WIDTH - 600);
      const y = 300 + Math.random() * (MAP_HEIGHT - 600);
      const radius = 40 + Math.random() * 80;
      if (!isSafe(x, y, radius)) {
        obstacles.push({
          id: `obs-${obstacles.length}`,
          x, y, radius,
          type: types[Math.floor(Math.random() * types.length)]
        });
      }
    }
    return obstacles;
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

  addPlayer(name: string, forceColor?: string, forcePos?: { x: number; y: number }): string {
    const playerId = randomUUID();
    const playerCount = Object.keys(this.state.players).length;
    const color = forceColor ?? (playerCount === 0 ? 'blue' : 'red');

    // Start position
    let startX: number, startY: number;
    if (forcePos) {
      startX = forcePos.x; startY = forcePos.y;
    } else if (this.mode === 'survival' && playerCount === 0) {
      // Human player starts at center
      startX = MAP_WIDTH / 2; startY = MAP_HEIGHT / 2;
    } else {
      startX = color === 'blue' ? 100 : MAP_WIDTH - 100;
      startY = color === 'blue' ? 100 : MAP_HEIGHT - 100;
    }

    const startResources = this.mode === 'survival' && playerCount === 0
      ? { wood: 200, stone: 150, iron: 40 } // Bonus resources for survival
      : { wood: 50, stone: 30, iron: 10 };

    this.state.players[playerId] = {
      id: playerId,
      color,
      resources: startResources,
      population: 0,
      researched: [],
    };

    // Create Hub
    const hubId = randomUUID();
    this.state.entities[hubId] = {
      id: hubId, playerId,
      type: 'hub',
      position: { x: startX, y: startY },
      hp: BUILDING_STATS.hub.hp, maxHp: BUILDING_STATS.hub.hp,
      state: 'idle'
    };

    // Create 1 Worker
    const workerId = randomUUID();
    this.state.entities[workerId] = {
      id: workerId, playerId,
      type: 'lumberjack',
      position: { x: startX + 50, y: startY + 50 },
      hp: UNIT_STATS.lumberjack.hp, maxHp: UNIT_STATS.lumberjack.hp,
      state: 'idle'
    };

    // Auto-start logic
    if (this.mode === 'survival' && playerCount === 0) {
      // Add 3 AI players at corners, then start
      this.setupSurvivalAI();
      this.start();
    } else if (Object.keys(this.state.players).length === 2 && this.state.status === 'waiting') {
      this.start();
    } else if (this.mode === 'solo' && Object.keys(this.state.players).length === 1 && this.state.status === 'waiting') {
      // addPlayer("IronMind AI") will see 2 players and call start() internally
      const aiId = this.addPlayer("IronMind AI");
      this.aiPlayerIds = [aiId];
      // Do NOT call start() again — inner addPlayer already did it
    }

    return playerId;
  }

  private setupSurvivalAI() {
    // 3 Veth AI bases at 3 corners
    const corners = [
      { x: 200,            y: 200,             label: 'Veth Alpha' },
      { x: MAP_WIDTH - 200, y: 200,            label: 'Veth Beta' },
      { x: 200,            y: MAP_HEIGHT - 200, label: 'Veth Gamma' },
    ];

    corners.forEach(corner => {
      const aiId = randomUUID();
      this.state.players[aiId] = {
        id: aiId, color: 'red',
        resources: { wood: 500, stone: 500, iron: 200 },
        population: 0, researched: ['speed_boost', 'combat_training'],
      };
      this.aiPlayerIds.push(aiId);

      // Hub
      const hubId = randomUUID();
      this.state.entities[hubId] = {
        id: hubId, playerId: aiId, type: 'hub',
        position: { x: corner.x, y: corner.y },
        hp: BUILDING_STATS.hub.hp, maxHp: BUILDING_STATS.hub.hp,
        state: 'idle'
      };

      // Pre-built barracks
      const barracksId = randomUUID();
      this.state.entities[barracksId] = {
        id: barracksId, playerId: aiId, type: 'barracks',
        position: { x: corner.x + 120, y: corner.y },
        hp: BUILDING_STATS.barracks.hp, maxHp: BUILDING_STATS.barracks.hp,
        state: 'idle'
      };

      // Starting army of 6 units spread out toward player
      const toward = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
      const dx = toward.x - corner.x, dy = toward.y - corner.y;
      const dist = Math.hypot(dx, dy);
      for (let i = 0; i < 6; i++) {
        const spread = (i - 2.5) * 60;
        const perpX = -dy / dist * spread;
        const perpY =  dx / dist * spread;
        const unitId = randomUUID();
        const unitType: UnitType = i % 3 === 0 ? 'archer' : 'knight';
        this.state.entities[unitId] = {
          id: unitId, playerId: aiId, type: unitType,
          position: { x: corner.x + perpX + dx / dist * 200, y: corner.y + perpY + dy / dist * 200 },
          hp: UNIT_STATS[unitType].hp, maxHp: UNIT_STATS[unitType].hp,
          state: 'idle'
        };
      }
    });
  }

  start() {
    this.state.status = 'playing';
    this.state.startTime = Date.now();
    if (this.mode === 'survival') {
      this.state.survivalTimer = 600000; // 10 minutes in ms
    }
    this.loopInterval = setInterval(() => this.tick(), 1000 / 10); // 10 TPS
  }

  stop() {
    if (this.loopInterval) clearInterval(this.loopInterval);
    this.state.status = 'ended';
  }

  private tick() {
    if (this.state.status !== 'playing') return;
    this.tickCount++;

    // Survival timer countdown
    if (this.mode === 'survival' && this.state.survivalTimer !== undefined) {
      this.state.survivalTimer -= 100;
      if (this.state.survivalTimer <= 0) {
        this.state.survivalTimer = 0;
        // Player wins if their hub is still alive
        const humanId = Object.keys(this.state.players).find(id => !this.aiPlayerIds.includes(id));
        if (humanId) {
          const hubAlive = Object.values(this.state.entities).some(e => e.type === 'hub' && e.playerId === humanId && e.hp > 0);
          if (hubAlive) {
            this.state.winner = humanId;
            this.incrementStat(humanId, 'wins', 1);
          }
        }
        this.stop();
        return;
      }
    }

    // AI Logic: only every 5th tick (2 TPS)
    if (this.aiPlayerIds.length > 0 && this.tickCount % 5 === 0) {
      this.aiPlayerIds.forEach(aiId => this.handleAILogic(aiId));
    }

    // Pre-build garrison lookup set once per tick (O(n) instead of O(n²) per entity)
    this.garrisonedSet.clear();
    for (const eId in this.state.entities) {
      const b = this.state.entities[eId];
      if (b.type === 'bunker') {
        const ids: string[] = (b as any).garrisonedIds || [];
        ids.forEach(id => this.garrisonedSet.add(id));
      }
    }

    // Fog of War: only every 3rd tick (3.3 TPS is fine for vision)
    if (this.tickCount % 3 === 0) {
      this.updateFogOfWar();
    }
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
          if (this.mode === 'survival') {
            // In survival: only end game if the human player's hub is destroyed
            const humanId = Object.keys(this.state.players).find(id => !this.aiPlayerIds.includes(id));
            if (entity.playerId === humanId) {
              // Human hub destroyed → defeat
              if (humanId) this.incrementStat(humanId, 'losses', 1);
              this.stop();
            }
            // If an AI hub is destroyed in survival, just remove it (don't end game)
          } else {
            // Normal mode: destroying any hub ends the game
            this.state.winner = Object.keys(this.state.players).find(id => id !== entity.playerId);
            if (this.state.winner) {
              this.incrementStat(this.state.winner, 'wins', 1);
              const loser = Object.keys(this.state.players).find(id => id !== this.state.winner);
              if (loser) this.incrementStat(loser, 'losses', 1);
            }
            this.stop();
          }
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
    // In survival mode, always target the human player
    const opponentId = this.mode === 'survival'
      ? Object.keys(this.state.players).find(id => !this.aiPlayerIds.includes(id))
      : Object.keys(this.state.players).find(id => id !== aiId);
    if (!opponentId) return;
    const opponentEntities = Object.values(this.state.entities).filter(e => e.playerId === opponentId);
    const opponentWorkers = opponentEntities.filter(e => e.type === 'lumberjack' || e.type === 'miner');

    const hub = aiEntities.find(e => e.type === 'hub');
    const builders = aiEntities.filter(e => e.type === 'builder');
    const workers = aiEntities.filter(e => e.type === 'lumberjack' || e.type === 'miner');
    const barracks = aiEntities.find(e => e.type === 'barracks');
    const researchHub = aiEntities.find(e => e.type === 'research_hub');
    const ironWorks = aiEntities.find(e => e.type === 'iron_works');
    const factory = aiEntities.find(e => e.type === 'factory');

    // === ECONOMY PRIORITY ===
    // Aggressively produce workers - up to 20
    if (hub && workers.length < 20 && aiPlayer.resources.wood >= 3 && aiPlayer.resources.stone >= 5) {
      if (!hub.productionQueue || hub.productionQueue.length < 4) {
        this.handleAction(aiId, {
          type: 'action_train',
          payload: { buildingId: hub.id, unitType: 'lumberjack' }
        });
      }
    }

    // Produce miners too for variety
    if (hub && workers.length >= 12 && workers.filter(w => w.type === 'miner').length < 4 && aiPlayer.resources.wood >= 5 && aiPlayer.resources.stone >= 2) {
      if (!hub.productionQueue || hub.productionQueue.length < 3) {
        this.handleAction(aiId, {
          type: 'action_train',
          payload: { buildingId: hub.id, unitType: 'miner' }
        });
      }
    }

    // Gather efficiently
    workers.forEach((w, idx) => {
      if (w.state === 'idle') {
        let nearestRes = null;
        let minDist = Infinity;
        
        this.state.resources.forEach(res => {
          const d = this.distance(w.position, res.position);
          if (d < minDist) {
            minDist = d;
            nearestRes = res;
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

    // === MILITARY PRODUCTION ===
    if (barracks && aiPlayer.resources.wood >= 5 && aiPlayer.resources.stone >= 5 && aiPlayer.resources.iron >= 5) {
      if (!barracks.productionQueue || barracks.productionQueue.length < 3) {
        const rand = Math.random();
        const unitToTrain = aiPlayer.resources.iron >= 30 && rand > 0.5 ? 'firebird' : 
                          (rand > 0.4 ? 'knight' : 'archer');
        this.handleAction(aiId, {
          type: 'action_train',
          payload: { buildingId: barracks.id, unitType: unitToTrain }
        });
      }
    }

    // === BUILDING PROGRESSION ===
    const idleBuilder = builders.find(b => b.state === 'idle');
    
    // Build Iron Works ASAP for resource generation
    if (idleBuilder && !ironWorks && aiPlayer.resources.wood >= 15 && aiPlayer.resources.stone >= 10) {
      const buildPos = { x: idleBuilder.position.x + 150, y: idleBuilder.position.y + 150 };
      this.handleAction(aiId, {
        type: 'action_build',
        payload: { buildingType: 'iron_works', position: buildPos, builderId: idleBuilder.id }
      });
    }

    // Build second builder ASAP
    const builderCount = builders.length;
    if (hub && builderCount < 2 && aiPlayer.resources.wood >= 5 && aiPlayer.resources.stone >= 5) {
      if (!hub.productionQueue || hub.productionQueue.length < 2) {
        this.handleAction(aiId, {
          type: 'action_train',
          payload: { buildingId: hub.id, unitType: 'builder' }
        });
      }
    }

    // Build Barracks
    if (idleBuilder && !barracks && aiPlayer.resources.wood >= 10 && aiPlayer.resources.stone >= 15) {
      const buildPos = { x: idleBuilder.position.x + 250, y: idleBuilder.position.y };
      this.handleAction(aiId, {
        type: 'action_build',
        payload: { buildingType: 'barracks', position: buildPos, builderId: idleBuilder.id }
      });
    }

    // Build Research Hub for upgrades
    if (idleBuilder && !researchHub && aiPlayer.resources.wood >= 10 && aiPlayer.resources.stone >= 10 && aiPlayer.resources.iron >= 1) {
      const buildPos = { x: idleBuilder.position.x - 250, y: idleBuilder.position.y };
      this.handleAction(aiId, {
        type: 'action_build',
        payload: { buildingType: 'research_hub', position: buildPos, builderId: idleBuilder.id }
      });
    }

    // Build Factory for more iron
    if (idleBuilder && factory && ironWorks && aiPlayer.resources.wood >= 10 && aiPlayer.resources.stone >= 10) {
      const buildPos = { x: idleBuilder.position.x, y: idleBuilder.position.y - 250 };
      this.handleAction(aiId, {
        type: 'action_build',
        payload: { buildingType: 'factory', position: buildPos, builderId: idleBuilder.id }
      });
    }

    // === TECH UPGRADES ===
    if (researchHub && !researchHub.productionQueue?.length) {
      const tech = !aiPlayer.researched.includes('speed_boost') ? 'speed_boost' : 
                   !aiPlayer.researched.includes('combat_training') && aiPlayer.resources.iron >= 60 ? 'combat_training' :
                   !aiPlayer.researched.includes('fortified_structures') && aiPlayer.resources.stone >= 80 ? 'fortified_structures' : null;
      if (tech && aiPlayer.resources.wood >= 40 && aiPlayer.resources.stone >= 40) {
        this.handleAction(aiId, {
          type: 'action_train',
          payload: { buildingId: researchHub.id, unitType: tech as any }
        });
      }
    }

    // Produce Iron at Iron Works
    if (ironWorks && aiPlayer.resources.stone >= 5) {
      if (!ironWorks.productionQueue || ironWorks.productionQueue.length === 0) {
        this.handleAction(aiId, {
          type: 'action_train',
          payload: { buildingId: ironWorks.id, unitType: 'iron_ingot' as any }
        });
      }
    }

    // === DEFENSE ===
    const watchtower = aiEntities.find(e => e.type === 'watchtower');
    const bunker = aiEntities.find(e => e.type === 'bunker');
    const beingAttacked = hub && hub.hp < hub.maxHp * 0.8;
    
    if (idleBuilder && beingAttacked && hub) {
      if (!watchtower && aiPlayer.resources.wood >= 20 && aiPlayer.resources.stone >= 20) {
        this.handleAction(aiId, {
          type: 'action_build',
          payload: { buildingType: 'watchtower', position: { x: hub.position.x + 80, y: hub.position.y }, builderId: idleBuilder.id }
        });
      } else if (!bunker && aiPlayer.resources.wood >= 40 && aiPlayer.resources.stone >= 40 && aiPlayer.resources.iron >= 20) {
        this.handleAction(aiId, {
          type: 'action_build',
          payload: { buildingType: 'bunker', position: { x: hub.position.x - 80, y: hub.position.y }, builderId: idleBuilder.id }
        });
      }
    }

    // === OFFENSE ===
    const army = aiEntities.filter(e => e.type === 'knight' || e.type === 'archer' || e.type === 'firebird');
    const opponentHub = opponentEntities.find(e => e.type === 'hub');
    
    // Worker harassment when army forms early
    const harassers = army.filter(u => u.type === 'archer').slice(0, 2);
    harassers.forEach(harasser => {
      const nearbyEnemyWorker = opponentWorkers.find(w => this.distance(harasser.position, w.position) < 300);
      if (nearbyEnemyWorker && harasser.state !== 'attacking') {
        this.handleAction(aiId, {
          type: 'action_attack',
          payload: { entityIds: [harasser.id], targetEntityId: nearbyEnemyWorker.id }
        });
      }
    });

    // Main army: Smaller attacks more frequently (lower threshold)
    const mainArmy = army.filter(u => u.type !== 'archer' || army.length > 8);
    const attackThreshold = this.mode === 'survival' ? 3 : 8; // Survival: attack as soon as 3 units ready
    
    if (mainArmy.length >= attackThreshold && opponentHub) {
      const targets = [...opponentEntities].sort((a, b) => {
        const isMilitary = (type: string) => ['knight', 'archer', 'firebird', 'watchtower', 'bunker'].includes(type);
        const aMil = isMilitary(a.type);
        const bMil = isMilitary(b.type);
        if (aMil && !bMil) return -1;
        if (!aMil && bMil) return 1;
        return this.distance(opponentHub.position, a.position) - this.distance(opponentHub.position, b.position);
      });

      const target = targets[0] || opponentHub;
      const readyArmy = mainArmy.filter(u => u.state === 'idle' || u.state === 'moving').slice(0, 10);
      
      if (readyArmy.length > 0) {
        this.handleAction(aiId, {
          type: 'action_attack',
          payload: { entityIds: readyArmy.map(u => u.id), targetEntityId: target.id }
        });
      }
    } else if (mainArmy.length >= 4) {
      // Rally even small groups
      const idleArmy = mainArmy.filter(u => u.state === 'idle');
      if (idleArmy.length > 0 && opponentHub) {
        this.handleAction(aiId, {
          type: 'action_move',
          payload: { entityIds: idleArmy.map(u => u.id), target: opponentHub.position }
        });
      }
    }

    // Aggressive kiting and focus fire
    army.forEach(unit => {
      if (unit.state === 'attacking') return; // Already attacking
      
      const nearbyEnemies = opponentEntities.filter(e => 
        e.hp > 0 && this.distance(unit.position, e.position) < 350
      ).sort((a, b) => this.distance(unit.position, a.position) - this.distance(unit.position, b.position));
      
      if (nearbyEnemies.length > 0) {
        const target = nearbyEnemies[0];
        
        // Kiting for damaged archers
        if (unit.type === 'archer' && unit.hp < unit.maxHp * 0.4) {
          const escapeVec = { 
            x: unit.position.x - target.position.x, 
            y: unit.position.y - target.position.y 
          };
          const dist = Math.sqrt(escapeVec.x ** 2 + escapeVec.y ** 2) || 1;
          this.handleAction(aiId, {
            type: 'action_move',
            payload: { 
              entityIds: [unit.id], 
              target: { 
                x: unit.position.x + (escapeVec.x / dist) * 100,
                y: unit.position.y + (escapeVec.y / dist) * 100
              }
            }
          });
        } else {
          // Attack the closest enemy
          this.handleAction(aiId, {
            type: 'action_attack',
            payload: { entityIds: [unit.id], targetEntityId: target.id }
          });
        }
      }
    });
  }

  private updateFogOfWar() {
    const GRID_SIZE = 50; // 50x50 = 2500 cells, not 10000
    const CELL_SIZE = MAP_WIDTH / GRID_SIZE;
    
    for (const playerId in this.state.players) {
      if (!this.state.fogOfWar![playerId]) {
        this.state.fogOfWar![playerId] = new Array(GRID_SIZE * GRID_SIZE).fill(false);
      }
      
      const fog = this.state.fogOfWar![playerId];
      const entities = Object.values(this.state.entities).filter(e => e.playerId === playerId);
      
      // Pre-compute vision ranges squared to avoid sqrt in inner loop
      const entityVision = entities.map(e => {
        const range = e.type === 'archer' ? 300 : e.type === 'hub' ? 400 : e.type === 'watchtower' ? 500 : 200;
        return { px: e.position.x, py: e.position.y, rangeSq: range * range };
      });
      
      for (let i = 0; i < fog.length; i++) {
        const gx = i % GRID_SIZE;
        const gy = Math.floor(i / GRID_SIZE);
        const worldX = gx * CELL_SIZE + CELL_SIZE / 2;
        const worldY = gy * CELL_SIZE + CELL_SIZE / 2;
        
        let visible = false;
        for (const ev of entityVision) {
          const dx = worldX - ev.px;
          const dy = worldY - ev.py;
          if (dx*dx + dy*dy < ev.rangeSq) {
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
        
        // Garrisoned units skip behavior (O(1) lookup)
        if (this.garrisonedSet.has(entity.id)) return;

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

          // Garrisoned units don't attack normally (O(1) lookup)
          if (this.garrisonedSet.has(entity.id)) return;

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
