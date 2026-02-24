import { useState, useCallback } from 'react';
import type { Position, BuildingType, UnitType, GameState } from '@shared/schema';
import { WS_MESSAGES } from '@shared/schema';
import { playSound } from './use-game-socket';

interface UseGameControlsProps {
  sendMessage: (type: string, payload: any) => void;
  playerId: string | null;
  gameState: GameState | null;
}

export function useGameControls({ sendMessage, playerId, gameState }: UseGameControlsProps) {
  const [selection, setSelection] = useState<string[]>([]);
  const [placementMode, setPlacementMode] = useState<BuildingType | null>(null);

  const moveUnits = useCallback((target: Position) => {
    if (selection.length === 0) return;
    sendMessage(WS_MESSAGES.ACTION_MOVE, {
      entityIds: selection,
      target
    });
    playSound('click');
  }, [selection, sendMessage]);

  const attackEntity = useCallback((targetEntityId: string) => {
    if (selection.length === 0) return;
    sendMessage(WS_MESSAGES.ACTION_ATTACK, {
      entityIds: selection,
      targetEntityId
    });
    playSound('attack');
  }, [selection, sendMessage]);

  const gatherResource = useCallback((resourceId: string) => {
    if (selection.length === 0) return;
    sendMessage(WS_MESSAGES.ACTION_GATHER, {
      entityIds: selection,
      resourceId
    });
    playSound('gather');
  }, [selection, sendMessage]);

  const buildStructure = useCallback((position: Position, keepPlacementMode: boolean = false) => {
    if (!placementMode) return;
    
    // Find a builder in the current selection
    const builderId = selection.find(id => {
      const e = gameState?.entities?.[id];
      return e && (e.type === 'builder' || e.type === 'lumberjack' || e.type === 'miner');
    });

    sendMessage(WS_MESSAGES.ACTION_BUILD, {
      buildingType: placementMode,
      position,
      builderId
    });
    playSound('build');
    if (!keepPlacementMode) {
      setPlacementMode(null);
    }
  }, [placementMode, selection, gameState, sendMessage]);

  const trainUnit = useCallback((buildingId: string, unitType: UnitType | 'iron_ingot') => {
    sendMessage(WS_MESSAGES.ACTION_TRAIN, {
      buildingId,
      unitType
    });
    playSound('train');
  }, [sendMessage]);

  return {
    selection,
    setSelection,
    placementMode,
    setPlacementMode,
    actions: {
      moveUnits,
      attackEntity,
      gatherResource,
      buildStructure,
      trainUnit
    }
  };
}
