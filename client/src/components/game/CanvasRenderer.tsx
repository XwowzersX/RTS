import { useEffect, useRef, useState, useCallback } from "react";
import type { GameState, Position, Entity, BuildingType } from "@shared/schema";
import { MAP_WIDTH, MAP_HEIGHT, BUILDING_STATS } from "@shared/schema";

interface CanvasRendererProps {
  gameState: GameState | null;
  playerId: string | null;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  onAction: (type: 'move' | 'attack' | 'gather', targetId?: string, position?: Position) => void;
  placementMode: BuildingType | null;
  onBuild: (pos: Position) => void;
}

export function CanvasRenderer({ 
  gameState, 
  playerId, 
  selection, 
  onSelectionChange, 
  onAction,
  placementMode,
  onBuild
}: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  const [isStrategicView, setIsStrategicView] = useState(false);
  const [preStrategicState, setPreStrategicState] = useState<{zoom: number, offset: Position} | null>(null);
  const [hasCentered, setHasCentered] = useState(false);
  const [screenShake, setScreenShake] = useState(0);

  // Screen Shake trigger
  useEffect(() => {
    if (!gameState) return;
    
    // Check if any entity's HP changed significantly or an entity died
    // For MVP, we'll just check if any entity is in 'attacking' state
    const isCombatActive = Object.values(gameState.entities).some(e => e.state === 'attacking');
    if (isCombatActive) {
      setScreenShake(prev => Math.min(prev + 0.5, 3));
    } else {
      setScreenShake(prev => Math.max(0, prev - 0.2));
    }
  }, [gameState]);

  // Initial Camera Centering
  useEffect(() => {
    if (!hasCentered && gameState && playerId) {
      const player = gameState.players[playerId];
      if (player) {
        const startX = player.color === 'blue' ? 0 : MAP_WIDTH - window.innerWidth;
        const startY = player.color === 'blue' ? 0 : MAP_HEIGHT - window.innerHeight;
        setOffset({ 
          x: Math.max(0, Math.min(MAP_WIDTH - window.innerWidth, startX)), 
          y: Math.max(0, Math.min(MAP_HEIGHT - window.innerHeight, startY)) 
        });
        setHasCentered(true);
      }
    }
  }, [gameState, playerId, hasCentered]);
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ start: Position, current: Position } | null>(null);

  // Constants
  const TILE_SIZE = 40; // Background grid size
  const ENTITY_RADIUS = 15;

  // Coordinate conversion helpers
  const screenToWorld = useCallback((sx: number, sy: number) => ({
    x: (sx / zoom) + offset.x,
    y: (sy / zoom) + offset.y
  }), [offset, zoom]);

  const worldToScreen = useCallback((wx: number, wy: number) => ({
    x: (wx - offset.x) * zoom,
    y: (wy - offset.y) * zoom
  }), [offset, zoom]);

  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Hover detection
  useEffect(() => {
    if (!gameState) return;
    const worldPos = screenToWorld(mousePos.x, mousePos.y);
    
    // Check entities
    const entity = Object.values(gameState.entities).find(ent => {
      const size = BUILDING_STATS[ent.type as BuildingType]?.size || ENTITY_RADIUS * 2;
      return Math.hypot(ent.position.x - worldPos.x, ent.position.y - worldPos.y) < size/2;
    });
    
    if (entity) {
      setHoveredId(entity.id);
      return;
    }
    
    // Check resources
    const resource = gameState.resources.find(res => 
      Math.hypot(res.position.x - worldPos.x, res.position.y - worldPos.y) < 20
    );
    
    setHoveredId(resource ? resource.id : null);
  }, [mousePos, gameState, screenToWorld]);

  // Edge Scroll Effect
  useEffect(() => {
    const SCROLL_SPEED = 10;
    const EDGE_MARGIN = 50;
    
    const interval = setInterval(() => {
      setOffset(prev => {
        let dx = 0;
        let dy = 0;
        
        if (mousePos.x < EDGE_MARGIN) dx = -SCROLL_SPEED;
        if (mousePos.x > window.innerWidth - EDGE_MARGIN) dx = SCROLL_SPEED;
        if (mousePos.y < EDGE_MARGIN) dy = -SCROLL_SPEED;
        if (mousePos.y > window.innerHeight - EDGE_MARGIN) dy = SCROLL_SPEED;
        
        if (dx === 0 && dy === 0) return prev;
        
        return {
          x: Math.max(-100, Math.min(MAP_WIDTH - window.innerWidth + 100, prev.x + dx)),
          y: Math.max(-100, Math.min(MAP_HEIGHT - window.innerHeight + 100, prev.y + dy))
        };
      });
    }, 16);

    return () => clearInterval(interval);
  }, [mousePos]);

  // Strategic View Toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'z' && !isStrategicView) {
        setPreStrategicState({ zoom, offset });
        setIsStrategicView(true);
        
        // Calculate zoom to fit whole map
        const zoomX = window.innerWidth / MAP_WIDTH;
        const zoomY = window.innerHeight / MAP_HEIGHT;
        const targetZoom = Math.min(zoomX, zoomY) * 0.9;
        
        setZoom(targetZoom);
        setOffset({ x: 0, y: 0 });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'z' && isStrategicView && preStrategicState) {
        setZoom(preStrategicState.zoom);
        setOffset(preStrategicState.offset);
        setIsStrategicView(false);
        setPreStrategicState(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isStrategicView, zoom, offset, preStrategicState]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle Resize
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // --- RENDER START ---
    
    // 1. Clear & Background
    ctx.fillStyle = "#1a1d23";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (World Boundaries)
    ctx.save();
    
    // Apply Screen Shake
    if (screenShake > 0) {
      const sx = (Math.random() - 0.5) * screenShake;
      const sy = (Math.random() - 0.5) * screenShake;
      ctx.translate(sx, sy);
    }

    ctx.scale(zoom, zoom);
    ctx.translate(-offset.x, -offset.y);
    
    // Water/Infinite ground
    ctx.fillStyle = "#111418";
    ctx.fillRect(-10000, -10000, 20000, 20000);

    // Map Border
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    
    // Background color for playable area
    ctx.fillStyle = "#1a1d23";
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Grid lines
    ctx.strokeStyle = "#ffffff08";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= MAP_WIDTH; x += TILE_SIZE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_HEIGHT);
    }
    for (let y = 0; y <= MAP_HEIGHT; y += TILE_SIZE) {
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_WIDTH, y);
    }
    ctx.stroke();

    // Decorative ground details (vignette/noise)
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    for (let i = 0; i < 50; i++) {
        const rx = Math.random() * MAP_WIDTH;
        const ry = Math.random() * MAP_HEIGHT;
        ctx.beginPath();
        ctx.arc(rx, ry, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. Resources
    gameState.resources.forEach(res => {
      ctx.save();
      ctx.translate(res.position.x, res.position.y);
      
      const isHovered = hoveredId === res.id;
      const radius = 15;

      if (res.type === 'tree') {
        // Wood Circle
        ctx.shadowBlur = isHovered ? 20 : 5;
        ctx.shadowColor = isHovered ? '#10b981' : 'rgba(0,0,0,0.3)';
        
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner detail
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Stone Circle
        ctx.shadowBlur = isHovered ? 20 : 5;
        ctx.shadowColor = isHovered ? '#94a3b8' : 'rgba(0,0,0,0.3)';

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner detail
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Amount text
      ctx.fillStyle = '#ffffff80';
      ctx.font = 'bold 9px Rajdhani';
      ctx.textAlign = 'center';
      ctx.fillText(res.amount.toString(), 0, 30);
      
      ctx.restore();
    });

    // 3. Entities (Units & Buildings)
    Object.values(gameState.entities).forEach(entity => {
      const isSelected = selection.includes(entity.id);
      const isMine = entity.playerId === playerId;
      const owner = gameState.players[entity.playerId];
      const color = owner?.color || '#999';

      ctx.save();
      ctx.translate(entity.position.x, entity.position.y);

      // Selection Ring
      if (isSelected || hoveredId === entity.id) {
        ctx.strokeStyle = isSelected ? '#22c55e' : 'rgba(255,255,255,0.3)'; 
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        const radius = BUILDING_STATS[entity.type as BuildingType]?.size || ENTITY_RADIUS;
        ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Entity Body
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      
      if (['hub', 'barracks', 'iron_works', 'factory', 'wall'].includes(entity.type)) {
        const size = BUILDING_STATS[entity.type as BuildingType].size;
        
        // Drop Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        // Base structure
        ctx.fillStyle = '#1e293b'; // Deep slate base
        ctx.fillRect(-size/2, -size/2, size, size);
        
        // Wall connection visuals
        if (entity.type === 'wall') {
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          Object.values(gameState.entities).forEach(other => {
            if (other.type === 'wall' && other.id !== entity.id && other.playerId === entity.playerId) {
              const d = Math.hypot(other.position.x - entity.position.x, other.position.y - entity.position.y);
              if (d < 60) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(other.position.x - entity.position.x, other.position.y - entity.position.y);
                ctx.stroke();
              }
            }
          });
        }
        
        // Roof/Feature color
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-size/2, -size/2);
        ctx.lineTo(0, -size/1.2); // Sharper roof
        ctx.lineTo(size/2, -size/2);
        ctx.closePath();
        ctx.fill();

        // Architectural details
        ctx.fillStyle = '#fde047'; // Glowing windows
        ctx.globalAlpha = 0.8;
        ctx.fillRect(-size/3, size/6, size/10, size/10);
        ctx.fillRect(size/6, size/6, size/10, size/10);
        ctx.globalAlpha = 1.0;
        
        // Emblems/Trim
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(-size/2 + 2, -size/2 + 2, size - 4, size - 4);

        // Label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '700 11px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText(entity.type.replace('_', ' ').toUpperCase(), 0, size/2 + 20);
      } else {
        // Unit Styling - Dynamic Shapes
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        
        ctx.beginPath();
        if (entity.type === 'knight') {
            // Knight - Shield with trim
            ctx.moveTo(0, -ENTITY_RADIUS);
            ctx.quadraticCurveTo(ENTITY_RADIUS, -ENTITY_RADIUS, ENTITY_RADIUS, 0);
            ctx.lineTo(0, ENTITY_RADIUS);
            ctx.lineTo(-ENTITY_RADIUS, 0);
            ctx.quadraticCurveTo(-ENTITY_RADIUS, -ENTITY_RADIUS, 0, -ENTITY_RADIUS);
        } else if (entity.type === 'archer') {
            // Archer - Stealthy Triangle
            ctx.moveTo(0, -ENTITY_RADIUS * 1.2);
            ctx.lineTo(ENTITY_RADIUS, ENTITY_RADIUS);
            ctx.lineTo(-ENTITY_RADIUS, ENTITY_RADIUS);
        } else if (entity.type === 'builder') {
            // Builder - Hexagon
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                ctx.lineTo(Math.cos(angle) * ENTITY_RADIUS, Math.sin(angle) * ENTITY_RADIUS);
            }
        } else {
            // Other workers - Rounded Circle
            ctx.arc(0, 0, ENTITY_RADIUS, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fill();
        
        // Inner detail/Emblem
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, ENTITY_RADIUS * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      
      ctx.shadowBlur = 0;

      // Health Bar
      const hpPct = entity.hp / entity.maxHp;
      const size = BUILDING_STATS[entity.type as BuildingType]?.size;
      const barY = -size/2 - 10 || -30;
      
      // Background bar
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-20, barY, 40, 4);
      
      // Health fill
      ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.2 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(-20, barY, 40 * hpPct, 4);

      // Status Indicator for combat
      if (entity.state === 'attacking') {
        ctx.fillStyle = '#ef4444';
        ctx.font = '900 12px Cinzel';
        ctx.fillText('⚔', 25, barY + 4);
      }

      ctx.restore();
    });

    // 4. Fog of War / Lighting (Optional, simple vignette)
    // Not implemented for performance in MVP, but could add gradient overlay

    ctx.restore();

    // 5. Selection Box (Screen Space)
    if (selectionBox && !placementMode) {
      ctx.strokeStyle = '#22c55e';
      ctx.fillStyle = '#22c55e20';
      ctx.lineWidth = 1;
      const w = selectionBox.current.x - selectionBox.start.x;
      const h = selectionBox.current.y - selectionBox.start.y;
      ctx.strokeRect(selectionBox.start.x, selectionBox.start.y, w, h);
      ctx.fillRect(selectionBox.start.x, selectionBox.start.y, w, h);
    }

    // 6. Placement Ghost & Hub Spots
    const clusters = (gameState as any).resourceClusters || [];
    const worldMouse = screenToWorld(mousePos.x, mousePos.y);
    let hoveredSpot: Position | null = null;

    clusters.forEach((center: Position) => {
      const d = Math.sqrt(Math.pow(worldMouse.x - center.x, 2) + Math.pow(worldMouse.y - center.y, 2));
      const inSpot = d > 80 && d < 150;
      
      ctx.save();
      ctx.translate(center.x, center.y);
      
      // Blue transparent square for valid hub spot
      ctx.fillStyle = inSpot ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.1)';
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 2;
      
      // Ring indicator
      ctx.beginPath();
      ctx.arc(0, 0, 115, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([5, 5]);
      ctx.stroke();

      if (inSpot) {
        hoveredSpot = center;
        // Tooltip
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Rajdhani';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'black';
        ctx.fillText('CLICK TO MOVE HUB HERE', 0, -130);
      }
      
      ctx.restore();
    });

    if (placementMode) {
      const size = BUILDING_STATS[placementMode].size;
      const color = gameState.players[playerId!]?.color || '#22c55e';
      
      ctx.save();
      ctx.translate(worldMouse.x, worldMouse.y);
      ctx.globalAlpha = 0.5;
      
      // Outline
      ctx.strokeStyle = color;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(-size/2, -size/2, size, size);
      
      // Connection preview for walls
      if (placementMode === 'wall') {
        Object.values(gameState.entities).forEach(other => {
          if (other.type === 'wall' && other.playerId === playerId) {
            const d = Math.hypot(other.position.x - worldPos.x, other.position.y - worldPos.y);
            if (d < 60) {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(other.position.x - worldPos.x, other.position.y - worldPos.y);
              ctx.stroke();
            }
          }
        });
      }
      
      ctx.restore();
    }

  }, [gameState, playerId, selection, offset, selectionBox]);

  // Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // 0 = Left Click, 2 = Right Click
    if (e.button === 0 && !e.altKey) { // Left Click (Normal)
      if (placementMode) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        onBuild(worldPos);
        return;
      }

      // Start drag select or pan
      setDragStart({ x: e.clientX, y: e.clientY });
      
      setSelectionBox({ 
        start: { x: e.clientX, y: e.clientY }, 
        current: { x: e.clientX, y: e.clientY } 
      });
      return;
    }

    if (e.button === 2) { // Right Click = Action
      e.preventDefault();
      if (!gameState) return;
      const worldPos = screenToWorld(e.clientX, e.clientY);
      
      // Wall placement support for Right Click
      if (placementMode === 'wall') {
        onBuild(worldPos);
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }
      
      // Check if clicked an enemy or resource
      // Simple collision check (optimize with spatial hash later if needed)
      let targetId: string | undefined;
      let actionType: 'attack' | 'gather' | 'move' = 'move';

      // Check resources
      const resource = gameState.resources.find(r => 
        Math.hypot(r.position.x - worldPos.x, r.position.y - worldPos.y) < 20
      );
      if (resource) {
        onAction('gather', resource.id);
        return;
      }

      // Check entities
      const clickedEntity = Object.values(gameState.entities).find(ent => {
        const size = BUILDING_STATS[ent.type as BuildingType]?.size || ENTITY_RADIUS * 2;
        return Math.hypot(ent.position.x - worldPos.x, ent.position.y - worldPos.y) < size/2;
      });

      if (clickedEntity && clickedEntity.playerId !== playerId) {
        onAction('attack', clickedEntity.id);
      } else {
        onAction('move', undefined, worldPos);
      }
      return;
    }

    if (e.button === 0 && e.altKey) { // Alt + Left Click = Pan
      e.preventDefault();
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (e.button === 1) { // Middle Click Pan
      e.preventDefault();
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
    
    if (e.button === 0 && !e.altKey) { // Left Click (Normal)
      if (placementMode) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        onBuild(worldPos);
        return;
      }

      // Start drag select or pan
      // For now, let's say Space+Drag = Pan, or Middle Mouse = Pan
      // Default left drag = Select
      setDragStart({ x: e.clientX, y: e.clientY });
      
      // If clicking strictly on an entity, select it immediately
      // Logic handled in MouseUp for single click, Box for drag
      setSelectionBox({ 
        start: { x: e.clientX, y: e.clientY }, 
        current: { x: e.clientX, y: e.clientY } 
      });
    }
    
    if (e.button === 1) { // Middle Click Pan
      e.preventDefault();
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && dragStart) {
      setOffset(prev => ({
        x: prev.x - (e.clientX - dragStart.x) / zoom,
        y: prev.y - (e.clientY - dragStart.y) / zoom
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, current: { x: e.clientX, y: e.clientY } } : null);
    }
    
    // Auto-wall placement logic
    if (placementMode === 'wall' && dragStart) {
      const worldPos = screenToWorld(mousePos.x, mousePos.y);
      const startWorld = screenToWorld(dragStart.x, dragStart.y);
      const dist = Math.hypot(worldPos.x - startWorld.x, worldPos.y - startWorld.y);
      
      if (dist > 45) { // Minimum distance for next wall segment
        onBuild(worldPos);
        setDragStart({ x: mousePos.x, y: mousePos.y });
      }
    }

    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      setDragStart(null);
    }
    
    if (selectionBox) {
      // Calculate selection
      const x1 = Math.min(selectionBox.start.x, selectionBox.current.x);
      const x2 = Math.max(selectionBox.start.x, selectionBox.current.x);
      const y1 = Math.min(selectionBox.start.y, selectionBox.current.y);
      const y2 = Math.max(selectionBox.start.y, selectionBox.current.y);

      // Convert selection rect to world space
      const w1 = screenToWorld(x1, y1);
      const w2 = screenToWorld(x2, y2);

      // Find entities in box
      if (gameState) {
        const selectedIds: string[] = [];
        const isClick = Math.abs(x2 - x1) < 5 && Math.abs(y2 - y1) < 5;

        Object.values(gameState.entities).forEach(ent => {
          if (ent.playerId !== playerId) return; // Only select own units

          // Check bounds
          if (ent.position.x >= w1.x && ent.position.x <= w2.x &&
              ent.position.y >= w1.y && ent.position.y <= w2.y) {
            selectedIds.push(ent.id);
          } else if (isClick) {
            // Point collision for click
            const size = BUILDING_STATS[ent.type as BuildingType]?.size || ENTITY_RADIUS * 2;
            if (Math.hypot(ent.position.x - w1.x, ent.position.y - w1.y) < size) {
              selectedIds.push(ent.id);
            }
          }
        });
        
        onSelectionChange(selectedIds);
      }
      setSelectionBox(null);
      setDragStart(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSpeed = 0.001;
    const minZoom = 0.2;
    const maxZoom = 2;
    
    setZoom(prev => {
      const newZoom = Math.max(minZoom, Math.min(maxZoom, prev - e.deltaY * zoomSpeed));
      
      // Optional: Center zoom on mouse position
      // This is a bit more complex as it requires adjusting the offset too
      // For now, simple zoom is fine
      return newZoom;
    });
  };

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 cursor-crosshair overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="block" />
      
      {/* Placement Preview / Ghost */}
      {placementMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-50">
          <div className="bg-black/80 text-white px-4 py-2 rounded-full border border-amber-500 animate-pulse font-bold">
            Placing {placementMode.replace('_', ' ').toUpperCase()}...
          </div>
          {placementMode === 'wall' && (
            <div className="bg-black/60 text-gray-300 px-3 py-1 rounded-full text-xs border border-white/10">
              Right Click & Drag to chain walls
            </div>
          )}
        </div>
      )}
    </div>
  );
}
