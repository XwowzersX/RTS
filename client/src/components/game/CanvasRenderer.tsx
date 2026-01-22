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
    ctx.strokeStyle = "#ffffff05";
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

    // 2. Resources
    gameState.resources.forEach(res => {
      ctx.save();
      ctx.translate(res.position.x, res.position.y);
      
      if (res.type === 'tree') {
        // Stylized Tree
        const isHovered = hoveredId === res.id;
        ctx.shadowBlur = isHovered ? 15 : 0;
        ctx.shadowColor = '#10b981';
        
        ctx.fillStyle = '#065f46'; // Darker forest green
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(15, 10);
        ctx.lineTo(-15, 10);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#059669'; // Lighter green layer
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(10, 15);
        ctx.lineTo(-10, 15);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#78350f'; // Trunk
        ctx.fillRect(-3, 15, 6, 8);
      } else {
        // Stylized Rock/Ore
        ctx.fillStyle = '#4b5563';
        ctx.beginPath();
        ctx.moveTo(-12, 10);
        ctx.lineTo(0, -15);
        ctx.lineTo(12, 10);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#9ca3af'; // Highlight
        ctx.beginPath();
        ctx.moveTo(-8, 8);
        ctx.lineTo(0, -10);
        ctx.lineTo(5, 8);
        ctx.closePath();
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
      
      if (['hub', 'barracks', 'iron_works', 'factory', 'resource_manager', 'wall'].includes(entity.type)) {
        const size = BUILDING_STATS[entity.type as BuildingType].size;
        
        // Base structure
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-size/2, -size/2, size, size);
        
        // Roof/Detail
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-size/2, -size/2);
        ctx.lineTo(0, -size/1.5);
        ctx.lineTo(size/2, -size/2);
        ctx.closePath();
        ctx.fill();

        // Architectural details (windows/doors)
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-size/4, size/4, size/8, size/8);
        ctx.fillRect(size/8, size/4, size/8, size/8);
        
        // Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText(entity.type.replace('_', ' ').toUpperCase(), 0, size/2 + 15);
      } else {
        // Unit Styling
        ctx.beginPath();
        if (entity.type === 'knight') {
            // Knight - shield shape
            ctx.moveTo(0, -ENTITY_RADIUS);
            ctx.lineTo(ENTITY_RADIUS, 0);
            ctx.lineTo(0, ENTITY_RADIUS);
            ctx.lineTo(-ENTITY_RADIUS, 0);
            ctx.closePath();
        } else if (entity.type === 'archer') {
            // Archer - triangular
            ctx.moveTo(0, -ENTITY_RADIUS);
            ctx.lineTo(ENTITY_RADIUS, ENTITY_RADIUS);
            ctx.lineTo(-ENTITY_RADIUS, ENTITY_RADIUS);
            ctx.closePath();
        } else {
            // Worker - circle
            ctx.arc(0, 0, ENTITY_RADIUS, 0, Math.PI * 2);
        }
        ctx.fill();
        
        // Unit border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Unit Type Icon/Letter
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Rajdhani';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entity.type[0].toUpperCase(), 0, 0);
      }
      
      ctx.shadowBlur = 0;

      // Health Bar
      const hpPct = entity.hp / entity.maxHp;
      const size = BUILDING_STATS[entity.type as BuildingType]?.size;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-20, -size/2 - 10 || -30, 40, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-20, -size/2 - 10 || -30, 40 * hpPct, 4);

      ctx.restore();
    });

    // 4. Fog of War / Lighting (Optional, simple vignette)
    // Not implemented for performance in MVP, but could add gradient overlay

    ctx.restore();

    // 5. Selection Box (Screen Space)
    if (selectionBox) {
      ctx.strokeStyle = '#22c55e';
      ctx.fillStyle = '#22c55e20';
      ctx.lineWidth = 1;
      const w = selectionBox.current.x - selectionBox.start.x;
      const h = selectionBox.current.y - selectionBox.start.y;
      ctx.strokeRect(selectionBox.start.x, selectionBox.start.y, w, h);
      ctx.fillRect(selectionBox.start.x, selectionBox.start.y, w, h);
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
      
      {/* Placement Ghost */}
      {placementMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full pointer-events-none border border-amber-500 animate-pulse z-50">
          Placing {placementMode}... (Left Click to Build)
        </div>
      )}
    </div>
  );
}
