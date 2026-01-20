import { PlayerState, ResourceType } from "@shared/schema";
import { Trees, Box, Hammer, Pickaxe, Anchor } from "lucide-react";

interface ResourcesDisplayProps {
  playerState?: PlayerState;
  className?: string;
}

export function ResourcesDisplay({ playerState, className }: ResourcesDisplayProps) {
  if (!playerState) return null;

  const resources = [
    { type: 'wood', icon: Trees, color: 'text-emerald-400', label: 'Wood' },
    { type: 'stone', icon: Box, color: 'text-stone-400', label: 'Stone' },
    { type: 'iron', icon: Pickaxe, color: 'text-blue-300', label: 'Iron' },
    { type: 'ladders', icon: Anchor, color: 'text-amber-600', label: 'Ladders' }, // Using Anchor as ladder proxy
  ] as const;

  return (
    <div className={`flex items-center gap-6 px-6 py-3 rounded-full hud-panel ${className}`}>
      {resources.map((res) => (
        <div key={res.type} className="flex items-center gap-2" title={res.label}>
          <res.icon className={`w-5 h-5 ${res.color}`} />
          <span className="font-mono text-lg font-bold tabular-nums text-white">
            {playerState.resources[res.type as ResourceType] || 0}
          </span>
        </div>
      ))}
      <div className="w-px h-8 bg-white/10 mx-2" />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Hammer className="w-4 h-4" />
        <span className="font-mono text-sm">POP: {playerState.population}</span>
      </div>
    </div>
  );
}
