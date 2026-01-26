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

    // Map Border
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

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

      if (res.type === 'tree') {
        // Stylized Tree - Layered
        ctx.shadowBlur = isHovered ? 20 : 5;
        ctx.shadowColor = isHovered ? '#10b981' : 'rgba(0,0,0,0.3)';
        
        // Base/Main
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(18, 12);
        ctx.lineTo(-18, 12);
        ctx.closePath();
        ctx.fill();
        
        // Mid layer
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(12, 18);
        ctx.lineTo(-12, 18);
        ctx.closePath();
        ctx.fill();
        
        // Top layer (highlight)
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(7, 22);
        ctx.lineTo(-7, 22);
        ctx.closePath();
        ctx.fill();
        
        // Trunk
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-3, 12, 6, 12);
      } else {
        // Stylized Rock - Faceted
        ctx.shadowBlur = isHovered ? 20 : 5;
        ctx.shadowColor = isHovered ? '#94a3b8' : 'rgba(0,0,0,0.3)';

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(-15, 12);
        ctx.lineTo(-5, -18);
        ctx.lineTo(15, 12);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-8, 10);
        ctx.lineTo(-2, -12);
        ctx.lineTo(10, 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#94a3b8'; // Sharp highlight
        ctx.beginPath();
        ctx.moveTo(-2, -15);
        ctx.lineTo(3, -10);
        ctx.lineTo(-4, -10);
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
      
      if (['hub', 'barracks', 'iron_works', 'factory', 'wall'].includes(entity.type)) {
        const size = BUILDING_STATS[entity.type as BuildingType].size;
        
        // Drop Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        // Base structure
        ctx.fillStyle = '#1e293b'; // Deep slate base
        ctx.fillRect(-size/2, -size/2, size, size);
        
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

  const [wallDragStart, setWallDragStart] = useState<Position | null>(null);
  const [wallDragCurrent, setWallDragCurrent] = useState<Position | null>(null);

  // Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // 0 = Left Click, 2 = Right Click
    if (e.button === 0 && !e.altKey) { // Left Click (Normal)
      if (placementMode === 'wall') {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        setWallDragStart(worldPos);
        setWallDragCurrent(worldPos);
        return;
      }
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
    const worldPos = screenToWorld(e.clientX, e.clientY);
    if (wallDragStart) {
      setWallDragCurrent(worldPos);
    } else if (isPanning && dragStart) {
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
    if (wallDragStart && wallDragCurrent) {
      // Calculate wall segments
      const startX = Math.round(wallDragStart.x / TILE_SIZE) * TILE_SIZE;
      const startY = Math.round(wallDragStart.y / TILE_SIZE) * TILE_SIZE;
      const endX = Math.round(wallDragCurrent.x / TILE_SIZE) * TILE_SIZE;
      const endY = Math.round(wallDragCurrent.y / TILE_SIZE) * TILE_SIZE;

      const dx = endX - startX;
      const dy = endY - startY;
      const steps = Math.max(Math.abs(dx / TILE_SIZE), Math.abs(dy / TILE_SIZE));

      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const px = Math.round((startX + dx * t) / TILE_SIZE) * TILE_SIZE;
        const py = Math.round((startY + dy * t) / TILE_SIZE) * TILE_SIZE;
        onBuild({ x: px, y: py });
      }
      setWallDragStart(null);
      setWallDragCurrent(null);
      return;
    }

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onBuild({ x: -1, y: -1 }); // Special value to clear placement mode in controls if needed, 
      // but simpler to just have the parent handle it. 
      // For now, let's just make sure we can escape placement mode.
    }
  }, [onBuild]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
      {/* Selection Box (Screen Space) */}
      {selectionBox && (
        <div 
          className="absolute border border-green-500 bg-green-500/20 pointer-events-none"
          style={{
            left: Math.min(selectionBox.start.x, selectionBox.current.x),
            top: Math.min(selectionBox.start.y, selectionBox.current.y),
            width: Math.abs(selectionBox.current.x - selectionBox.start.x),
            height: Math.abs(selectionBox.current.y - selectionBox.start.y)
          }}
        />
      )}

      {/* Wall Placement Ghosting */}
      {wallDragStart && wallDragCurrent && (
        <div className="pointer-events-none">
          {(() => {
            const startX = Math.round(wallDragStart.x / TILE_SIZE) * TILE_SIZE;
            const startY = Math.round(wallDragStart.y / TILE_SIZE) * TILE_SIZE;
            const endX = Math.round(wallDragCurrent.x / TILE_SIZE) * TILE_SIZE;
            const endY = Math.round(wallDragCurrent.y / TILE_SIZE) * TILE_SIZE;

            const dx = endX - startX;
            const dy = endY - startY;
            const steps = Math.max(Math.abs(dx / TILE_SIZE), Math.abs(dy / TILE_SIZE));
            const ghosts = [];

            for (let i = 0; i <= steps; i++) {
              const t = steps === 0 ? 0 : i / steps;
              const wx = Math.round((startX + dx * t) / TILE_SIZE) * TILE_SIZE;
              const wy = Math.round((startY + dy * t) / TILE_SIZE) * TILE_SIZE;
              const screenPos = worldToScreen(wx, wy);
              ghosts.push(
                <div 
                  key={i}
                  className="absolute border border-amber-500/50 bg-amber-500/20"
                  style={{
                    left: screenPos.x - (TILE_SIZE * zoom) / 2,
                    top: screenPos.y - (TILE_SIZE * zoom) / 2,
                    width: TILE_SIZE * zoom,
                    height: TILE_SIZE * zoom,
                  }}
                />
              );
            }
            return ghosts;
          })()}
        </div>
      )}

      {/* Placement Ghost */}
      {placementMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full pointer-events-none border border-amber-500 animate-pulse z-50">
          Placing {placementMode}... (Left Click to Build)
        </div>
      )}
    </div>
  );
}
