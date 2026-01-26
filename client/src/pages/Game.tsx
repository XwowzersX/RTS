import { useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useGameSocket } from "@/hooks/use-game-socket";
import { useGameControls } from "@/hooks/use-game-controls";
import { CanvasRenderer } from "@/components/game/CanvasRenderer";
import { ResourcesDisplay } from "@/components/game/ResourcesDisplay";
import { ActionGrid } from "@/components/game/ActionGrid";
import { Loader2, Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { BuildingType, WS_MESSAGES } from "@shared/schema";
import { Music, Music2 } from "lucide-react";
import { useState, useRef } from "react";

export default function Game() {
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleMusic = () => {
    if (!audioRef.current) {
      // More intense war-themed cinematic music (Epic Orchestral)
      audioRef.current = new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"); 
      audioRef.current.loop = true;
      audioRef.current.volume = 0.15;
    }
    
    if (isMusicPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsMusicPlaying(!isMusicPlaying);
  };
  const [match, params] = useRoute("/game/:id");
  const gameId = match ? params.id : null;
  const { toast } = useToast();

  // 1. Join Game API (HTTP) to get Player ID
  const joinMutation = useMutation({
    mutationFn: async (gid: string) => {
      const res = await fetch(api.game.join.path, {
        method: api.game.join.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gid })
      });
      if (!res.ok) throw new Error('Failed to join game');
      return await res.json() as { playerId: string, color: string };
    }
  });

  // 2. Connect WebSocket
  const { socket, gameState, isConnected, sendMessage } = useGameSocket(gameId);

  // 3. Game Controls
  const { 
    selection, 
    setSelection, 
    actions, 
    placementMode, 
    setPlacementMode 
  } = useGameControls({ 
    sendMessage, 
    playerId: joinMutation.data?.playerId ?? null,
    gameState
  });

  // Initial Join
  useEffect(() => {
    if (gameId && !joinMutation.data && !joinMutation.isPending) {
      joinMutation.mutate(gameId, {
        onSuccess: (data) => {
          // Once HTTP join successful, send WS join
          // Note: useGameSocket handles the connection, we just need to send the join packet once connected
          // However, the hook handles connection. We need to wait for 'open'.
        },
        onError: () => {
          toast({ variant: "destructive", title: "Join Failed", description: "Game might be full or finished." });
        }
      });
    }
  }, [gameId]);

  // Send WS Join when socket opens and we have playerId
  useEffect(() => {
    if (isConnected && joinMutation.data && gameId) {
      console.log('Sending WS join_game with playerId:', joinMutation.data.playerId);
      sendMessage('join_game', { 
        gameId, 
        playerId: joinMutation.data.playerId 
      });
    }
  }, [isConnected, joinMutation.data, gameId, sendMessage]);

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Copied!", description: "Invite link copied to clipboard." });
  };

  // Derived State
  const myPlayer = useMemo(() => {
    if (!gameState || !joinMutation.data) return undefined;
    return gameState.players[joinMutation.data.playerId];
  }, [gameState, joinMutation.data]);

  const selectedEntity = useMemo(() => {
    if (!gameState || selection.length !== 1) return undefined;
    return gameState.entities[selection[0]];
  }, [gameState, selection]);

  // --- RENDER ---

  if (joinMutation.isPending || (joinMutation.isSuccess && !gameState)) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <h2 className="text-2xl font-cinzel">Connecting to Command...</h2>
        {gameId && (
          <div className="mt-8 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <span className="text-sm font-mono text-muted-foreground">ID: {gameId}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyInviteLink}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (joinMutation.isError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-white p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-2">Connection Failed</h1>
        <p className="text-muted-foreground mb-6">Could not join the game session.</p>
        <Button onClick={() => window.location.href = '/'}>Return to Lobby</Button>
      </div>
    );
  }

  if (gameState?.status === 'waiting') {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white p-6">
        <div className="max-w-md w-full text-center space-y-8 animate-in zoom-in duration-500">
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="w-16 h-16 animate-spin text-primary relative" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-black font-cinzel tracking-tighter">WAITING FOR OPPONENT</h1>
            <p className="text-muted-foreground">The battle begins once a second commander joins.</p>
          </div>

          <Card className="bg-white/5 border-white/10 p-6 backdrop-blur-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Match Code</span>
                <span className="font-mono text-xl font-bold text-primary">{gameId}</span>
              </div>
              
              <Button onClick={copyInviteLink} className="w-full h-12 text-lg font-bold hover-elevate">
                <Copy className="w-5 h-5 mr-2" />
                Copy Battle Link
              </Button>
            </div>
          </Card>

          <p className="text-xs text-white/20 uppercase tracking-widest">
            Protocol: 1v1 RTS Real-Time Synchronization
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      
      {/* Game Canvas Layer */}
      <CanvasRenderer 
        gameState={gameState}
        playerId={joinMutation.data?.playerId ?? null}
        selection={selection}
        onSelectionChange={setSelection}
        onAction={(type, targetId, pos) => {
          if (type === 'move' && pos) actions.moveUnits(pos);
          if (type === 'attack' && targetId) actions.attackEntity(targetId);
          if (type === 'gather' && targetId) actions.gatherResource(targetId);
        }}
        placementMode={placementMode}
        onBuild={actions.buildStructure}
      />

      {/* --- HUD OVERLAY --- */}

      {/* Top Bar: Resources */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
        <ResourcesDisplay playerState={myPlayer} className="pointer-events-auto" />
        
        {/* Game ID & Copy (Top Right) */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          {gameState?.startTime && gameState.status === 'playing' && (
            <div className="bg-black/60 border border-white/10 backdrop-blur-md px-4 py-1 rounded-full text-primary font-mono font-bold animate-pulse">
              {(() => {
                // Use a stable reference for current time to avoid drift during render
                const startTime = gameState.startTime;
                const seconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${mins}:${secs.toString().padStart(2, '0')}`;
              })()}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-black/60 border-white/10 backdrop-blur-md hover:bg-white/10"
              onClick={toggleMusic}
            >
              {isMusicPlaying ? <Music className="w-4 h-4 mr-2" /> : <Music2 className="w-4 h-4 mr-2" />}
              <span className="text-xs">{isMusicPlaying ? "Music On" : "Music Off"}</span>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              className="bg-black/60 border-white/10 backdrop-blur-md hover:bg-white/10"
              onClick={copyInviteLink}
            >
              <span className="mr-2 text-xs opacity-50">Match ID:</span>
              <span className="font-mono">{gameId?.slice(0, 8)}...</span>
              <Copy className="w-3 h-3 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-center gap-4 pointer-events-none">
        
        {/* Selection Info Panel */}
        <div className="hidden md:flex flex-col justify-end pointer-events-auto">
          {selectedEntity ? (
            <Card className="w-64 h-32 bg-black/80 border-white/10 backdrop-blur-md text-white p-4 shadow-xl">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg capitalize">{selectedEntity.type.replace('_', ' ')}</h3>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white/80">
                  lvl 1
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-400">
                <div className="flex justify-between">
                  <span>HP</span>
                  <span className="text-green-400 font-mono">{Math.floor(selectedEntity.hp)}/{selectedEntity.maxHp}</span>
                </div>
                {selectedEntity.state !== 'idle' && (
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="text-amber-400 animate-pulse uppercase text-xs">{selectedEntity.state}</span>
                  </div>
                )}
              </div>
            </Card>
          ) : (
             <div className="w-64 h-32" /> // Spacer
          )}
        </div>

        {/* Action Grid */}
        <div className="pointer-events-auto bg-black/80 p-2 rounded-xl border border-white/10 backdrop-blur-md shadow-2xl">
          <ActionGrid 
            selection={selection}
            gameState={gameState}
            onTrain={(type) => actions.trainUnit(selection[0], type)}
            onBuild={setPlacementMode}
            onStop={() => {}}
            isPlacementActive={!!placementMode}
          />
        </div>

      </div>

      {/* Game End Overlay */}
      {gameState?.status === 'ended' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 pointer-events-auto animate-in fade-in duration-1000">
          <h1 className="text-6xl font-black text-amber-500 mb-4 font-cinzel">GAME OVER</h1>
          <p className="text-2xl text-white mb-8">
            {gameState.winner === joinMutation.data?.playerId ? "VICTORY" : "DEFEAT"}
          </p>
          <Button size="lg" onClick={() => window.location.href = '/'}>
            Return to Lobby
          </Button>
        </div>
      )}
    </div>
  );
}
