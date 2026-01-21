import { useEffect, useRef, useState, useCallback } from "react";
import type { GameState, Position, Entity, BuildingType } from "@shared/schema";
import { MAP_WIDTH, MAP_HEIGHT, BUILDING_STATS } from "@shared/schema";

interface CanvasRendererProps {
  gameState: GameState | null;
  playerId: string | null;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  onAction: (type: 'move' | 'attack' | 'gather' | 'mine_click', targetId?: string, position?: Position) => void;
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
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  const [hasCentered, setHasCentered] = useState(false);

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
    x: sx + offset.x,
    y: sy + offset.y
  }), [offset]);

  const worldToScreen = useCallback((wx: number, wy: number) => ({
    x: wx - offset.x,
    y: wy - offset.y
  }), [offset]);

  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });

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
      ctx.fillStyle = res.type === 'tree' ? '#10b981' : '#78716c';
      // Simple visual representation
      ctx.beginPath();
      if (res.type === 'tree') {
        ctx.arc(res.position.x, res.position.y, 15, 0, Math.PI * 2);
      } else {
        ctx.fillRect(res.position.x - 12, res.position.y - 12, 24, 24);
      }
      ctx.fill();
      
      // Amount text
      ctx.fillStyle = '#ffffff80';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(res.amount.toString(), res.position.x, res.position.y + 25);
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
      if (isSelected) {
        ctx.strokeStyle = '#22c55e'; // Green selection
        ctx.lineWidth = 2;
        ctx.beginPath();
        const radius = BUILDING_STATS[entity.type as BuildingType]?.size || ENTITY_RADIUS;
        ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Entity Body
      ctx.fillStyle = color;
      if (['hub', 'barracks', 'iron_works', 'factory', 'resource_manager', 'wall'].includes(entity.type)) {
        const size = BUILDING_STATS[entity.type as BuildingType].size;
        ctx.fillRect(-size/2, -size/2, size, size);
        
        // Structure label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entity.type.substring(0, 1).toUpperCase(), 0, 0);
      } else {
        // Unit
        ctx.beginPath();
        ctx.arc(0, 0, ENTITY_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Unit Type Indicator
        ctx.fillStyle = '#00000050';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entity.type[0].toUpperCase(), 0, 0);
      }

      // Health Bar
      const hpPct = entity.hp / entity.maxHp;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-15, -25, 30, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-15, -25, 30 * hpPct, 4);

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

      const worldPos = screenToWorld(e.clientX, e.clientY);
      
      // Check if clicked a resource for direct mining
      const clickedResource = gameState?.resources.find(res => {
        const dist = Math.sqrt(Math.pow(res.position.x - worldPos.x, 2) + Math.pow(res.position.y - worldPos.y, 2));
        return dist < 30;
      });

      if (clickedResource) {
        onAction('mine_click', clickedResource.id);
        setSelectionBox(null);
        setDragStart(null);
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
        x: prev.x - (e.clientX - dragStart.x),
        y: prev.y - (e.clientY - dragStart.y)
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

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 cursor-crosshair overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
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
