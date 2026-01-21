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
      resources: this.generateResources(),
    };
  }

  private generateResources() {
    const resources: GameState['resources'] = [];
    // Simple generation: Clusters of trees and rocks
    for (let i = 0; i < 20; i++) {
      resources.push({
        id: `res-${i}`,
        type: i % 3 === 0 ? 'rock' : 'tree',
        amount: 500,
        position: {
          x: Math.random() * MAP_WIDTH,
          y: Math.random() * MAP_HEIGHT
        }
      });
    }
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
      const resource = this.state.resources.find(r => r.id === entity.targetId);
      if (resource) {
        const dist = this.distance(entity.position, resource.position);
        if (dist < 30) {
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
    const speed = (UNIT_STATS[entity.type as UnitType]?.speed || 1) * 3; // Increase speed for responsiveness
    const dx = target.x - entity.position.x;
    const dy = target.y - entity.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 5) { // Stop close enough
      entity.position.x += (dx / dist) * speed;
      entity.position.y += (dy / dist) * speed;
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
    if (action.type === 'action_mine_click') {
        const { resourceId } = action.payload;
        const resource = this.state.resources.find(r => r.id === resourceId);
        if (resource && resource.amount > 0) {
            resource.amount -= 1;
            const player = this.state.players[playerId];
            if (resource.type === 'tree') player.resources.wood += 1;
            else if (resource.type === 'rock') player.resources.stone += 1;
        }
    }
  }
}
