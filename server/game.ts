import { PRODUCTION_TIME, UNIT_STATS, BUILDING_STATS, COSTS, MAP_WIDTH, MAP_HEIGHT, type GameState, type PlayerState, type Entity, type Position, type UnitType, type BuildingType, type ResourceType } from "@shared/schema";
import { randomUUID } from "crypto";

export class Game {
  id: string;
  state: GameState;
  private loopInterval: NodeJS.Timeout | null = null;
  private onUpdate: (state: GameState) => void;

  constructor(id: string, onUpdate: (state: GameState) => void) {
    this.id = id;
    this.onUpdate = onUpdate;
    this.state = {
      id,
      status: 'waiting',
      players: {},
      entities: {},
      resources: [],
      resourceClusters: [],
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
      resources: { wood: 5, stone: 5, iron: 0, ladders: 0 },
      population: 0
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

    // Auto-start if 2 players
    if (Object.keys(this.state.players).length === 2 && this.state.status === 'waiting') {
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

    // Game Logic Loop
    for (const entityId in this.state.entities) {
      const entity = this.state.entities[entityId];
      if (entity.hp <= 0) {
        if (entity.type === 'hub') {
          this.state.winner = Object.keys(this.state.players).find(id => id !== entity.playerId);
          this.stop();
        }
        delete this.state.entities[entityId];
        continue;
      }
      
      this.handleEntityBehavior(entity);
    }

    this.onUpdate(this.state);
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
        if (dist < 50) {
          const type = entity.type === 'lumberjack' ? 'wood' : 'stone';
          this.state.players[entity.playerId].resources[type] += 1;
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
          
          // Ladder climbing mechanic
          if (target.type === 'wall' && this.state.players[entity.playerId].resources.ladders > 0 && !entity.isClimbing) {
            if (dist < 40) {
              this.state.players[entity.playerId].resources.ladders -= 1;
              entity.isClimbing = true;
              (entity as any).climbTimer = 10000; // 10 seconds
            }
          }

          if (entity.isClimbing) {
            (entity as any).climbTimer = ((entity as any).climbTimer || 0) - 100;
            if ((entity as any).climbTimer <= 0) {
              entity.isClimbing = false;
              delete (entity as any).climbTimer;
            }
          }

          if (dist <= stats.range + 10) { 
             if (entity.isClimbing && target.type === 'wall') {
                this.moveTowards(entity, (entity as any).destination || { x: target.position.x + 40, y: target.position.y + 40 });
             } else {
                target.hp -= stats.attack * 0.2; 
             }
          } else {
             this.moveTowards(entity, target.position);
          }
        }
      } else {
        entity.state = 'idle';
        entity.isClimbing = false;
      }
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
            } else if (item === 'ladder') {
                this.state.players[entity.playerId].resources.ladders += 1;
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
        // We need a separate field for 'destination' or re-use targetId logic?
        // Ideally entity has 'destination'. I'll add destination to Entity in schema or just assume state handled elsewhere?
        // For MVP, I'll hack it: Action Move sets state to 'moving' and we need a destination field. 
        // I'll add `destination?: Position` to the Entity type in memory (casting)
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
    const speed = (UNIT_STATS[entity.type as UnitType]?.speed || 1) * 3;
    const dx = target.x - entity.position.x;
    const dy = target.y - entity.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 5) {
      const nextX = entity.position.x + (dx / dist) * speed;
      const nextY = entity.position.y + (dy / dist) * speed;

      // Wall collision check
      let collision = false;
      if (!entity.isClimbing) {
        for (const eId in this.state.entities) {
          const e = this.state.entities[eId];
          if (e.type === 'wall' && e.hp > 0) {
            const wallSize = BUILDING_STATS.wall.size;
            const distToWall = Math.sqrt(Math.pow(e.position.x - nextX, 2) + Math.pow(e.position.y - nextY, 2));
            if (distToWall < (wallSize / 2 + 10)) {
              collision = true;
              break;
            }
          }
        }
      }

      if (!collision) {
        entity.position.x = nextX;
        entity.position.y = nextY;
      } else {
        // If it's a worker gathering, they might get stuck, but for now just stop
        if (entity.state === 'moving') {
          entity.state = 'idle';
          delete (entity as any).destination;
        }
      }
    } else {
      entity.position.x = target.x;
      entity.position.y = target.y;
    }
  }

  private distance(p1: Position, p2: Position) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  // Actions
  handleAction(playerId: string, action: any) {
    if (action.type === 'action_move') {
       const { entityIds, target } = action.payload;
       console.log(`Action Move for ${entityIds.length} units to ${JSON.stringify(target)}`);
       entityIds.forEach((id: string) => {
         const e = this.state.entities[id];
         if (e && e.playerId === playerId) {
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
          const isValidSpot = clusters.some((center: Position) => {
            const d = this.distance(position, center);
            return d < 60; // Slightly larger tolerance for snapping
          });
          
          if (!isValidSpot) return;

          // Find the exact cluster center to snap to
          const snapSpot = clusters.find((center: Position) => this.distance(position, center) < 60);
          const finalPos = snapSpot || position;

          // If hub already exists, move it instead of building new
          const existingHub = Object.values(this.state.entities).find(e => e.type === 'hub' && e.playerId === playerId);
          if (existingHub) {
            existingHub.position = finalPos;
            return;
          }
          
          // Use snapped position for new hub too
          const newHub = {
            id: `hub-${playerId}-${Date.now()}`,
            type: 'hub',
            playerId,
            position: finalPos,
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
        
        if (canAfford) {
            if (cost.wood) player.resources.wood -= cost.wood;
            if (cost.stone) player.resources.stone -= cost.stone;
            
            builder.state = 'building';
            builder.targetPosition = position;
            builder.buildType = buildingType as BuildingType;
        }
    }
    if (action.type === 'action_train') {
        const { buildingId, unitType } = action.payload;
        const building = this.state.entities[buildingId];
        if (building && building.playerId === playerId) {
             const cost = COSTS[unitType as keyof typeof COSTS];
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
