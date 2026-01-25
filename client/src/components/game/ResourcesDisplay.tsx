import { PlayerState, ResourceType } from "@shared/schema";
import { Trees, Box, Hammer, Pickaxe, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

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
    { type: 'ladders', icon: ChevronUp, color: 'text-amber-600', label: 'Ladders' },
  ] as const;

  return (
    <div className={cn("flex gap-6 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-xl", className)}>
      {resources.map((res) => {
        const amount = playerState.resources[res.type as ResourceType] || 0;
        return (
          <div key={res.type} className="flex items-center gap-2 group" title={res.label}>
            <div className={cn("w-3 h-3 rounded-full shadow-lg transition-transform group-hover:scale-125",
              res.type === 'wood' ? 'bg-green-500 shadow-green-500/50' : 
              res.type === 'stone' ? 'bg-gray-400 shadow-gray-400/50' : 
              res.type === 'iron' ? 'bg-blue-400 shadow-blue-400/50' : 
              'bg-amber-400 shadow-amber-400/50'
            )} />
            <div className="flex flex-col -space-y-1">
              <span className="text-sm font-bold font-mono tracking-tighter text-gray-100 group-hover:text-white transition-colors">
                {amount}
              </span>
              <span className="text-[9px] uppercase text-gray-500 font-black tracking-widest">{res.type}</span>
            </div>
          </div>
        );
      })}
      <div className="w-px h-6 bg-white/10 mx-2 self-center" />
      <div className="flex flex-col -space-y-1">
        <span className="text-sm font-bold font-mono text-primary">{playerState.population}</span>
        <span className="text-[9px] uppercase text-gray-500 font-black tracking-widest">Pop</span>
      </div>
    </div>
  );
}
