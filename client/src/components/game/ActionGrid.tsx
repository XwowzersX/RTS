import { BuildingType, UnitType, COSTS, type Entity } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { 
  Sword, Shield, Pickaxe, User, 
  Home, Factory, Hammer, Gavel, ArrowUp,
  MousePointer2, Box, ChevronUp, Eye
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ActionGridProps {
  selection: string[];
  gameState: any;
  onTrain: (type: any) => void;
  onBuild: (type: BuildingType) => void;
  onStop: () => void;
  isPlacementActive: boolean;
}

export function ActionGrid({ 
  selection, 
  gameState, 
  onTrain, 
  onBuild,
  onStop,
  isPlacementActive
}: ActionGridProps) {
  
  // Nothing selected
  if (selection.length === 0) {
    return (
      <div className="grid grid-cols-4 gap-2 p-2">
        <div className="col-span-4 text-center text-muted-foreground text-sm py-8 italic font-serif">
          Select a unit or building...
        </div>
      </div>
    );
  }

  const entityId = selection[0];
  const entity = gameState.entities[entityId] as Entity;
  const entityType = entity?.type;

  // Render buttons based on selection type
  const renderActions = () => {
    // Builders can build everything
    if (entityType === 'builder') {
      return (
        <>
          <ActionButton 
            icon={Shield} 
            label="Barracks" 
            cost={COSTS.barracks}
            onClick={() => onBuild('barracks')} 
            active={isPlacementActive}
          />
          <ActionButton 
            icon={Factory} 
            label="Iron Works" 
            cost={COSTS.iron_works}
            onClick={() => onBuild('iron_works')} 
            active={isPlacementActive}
          />
          <ActionButton 
            icon={Hammer} 
            label="Factory" 
            cost={COSTS.factory}
            onClick={() => onBuild('factory')} 
            active={isPlacementActive}
          />
          <ActionButton 
            icon={ArrowUp} 
            label="Wall" 
            cost={COSTS.wall}
            onClick={() => onBuild('wall')} 
            active={isPlacementActive}
          />
          <ActionButton 
            icon={Eye} 
            label="Watchtower" 
            cost={COSTS.watchtower}
            onClick={() => onBuild('watchtower')} 
            active={isPlacementActive}
          />
          <Button 
            variant="destructive" 
            className="col-span-2 h-16 flex flex-col gap-1 border-2 border-red-900/50 hover:border-red-500/50"
            onClick={onStop}
          >
            <MousePointer2 className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider">Stop</span>
          </Button>
        </>
      );
    }

    // Hub trains workers & builder
    if (entityType === 'hub') {
      return (
        <>
          <ActionButton 
            icon={Pickaxe} 
            label="Miner" 
            cost={COSTS.miner}
            onClick={() => onTrain('miner')} 
          />
          <ActionButton 
            icon={User} 
            label="Lumberjack" 
            cost={COSTS.lumberjack}
            onClick={() => onTrain('lumberjack')} 
          />
          <ActionButton 
            icon={Hammer} 
            label="Builder" 
            cost={COSTS.builder}
            onClick={() => onTrain('builder')} 
          />
        </>
      );
    }

    // Barracks trains military
    if (entityType === 'barracks') {
      return (
        <>
          <ActionButton 
            icon={Sword} 
            label="Knight" 
            cost={COSTS.knight}
            onClick={() => onTrain('knight')} 
          />
          <ActionButton 
            icon={Sword} 
            label="Archer" 
            cost={COSTS.archer}
            onClick={() => onTrain('archer')} 
          />
        </>
      );
    }

    // Iron Works produces iron ingots & research
    if (entityType === 'iron_works') {
      return (
        <>
          <ActionButton 
            icon={Box} 
            label="Iron Ingot" 
            cost={COSTS.iron_ingot}
            onClick={() => onTrain('iron_ingot')} 
          />
          {!gameState.players[playerId]?.researched?.includes('speed_boost') && (
            <ActionButton 
              icon={ArrowUp} 
              label="Speed Research" 
              cost={{ iron: 10, wood: 10 }}
              onClick={() => onTrain('speed_boost')} 
            />
          )}
        </>
      );
    }

    // Factory produces ladders
    if (entityType === 'factory') {
      return (
        <ActionButton 
          icon={ChevronUp} 
          label="Ladder" 
          cost={COSTS.ladder}
          onClick={() => onTrain('ladder')} 
        />
      );
    }

    // Default unit actions
    return (
      <Button 
        variant="destructive" 
        className="col-span-2 h-16 flex flex-col gap-1 border-2 border-red-900/50 hover:border-red-500/50"
        onClick={onStop}
      >
        <MousePointer2 className="w-5 h-5" />
        <span className="text-xs uppercase tracking-wider">Stop</span>
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {entityType} Status
        </span>
        {entity?.productionTimer !== undefined && (
          <span className="text-[10px] font-bold text-primary animate-pulse">
            PRODUCING ({Math.ceil(entity.productionTimer / 1000)}s)
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 w-full max-w-md">
        {renderActions()}
      </div>
    </div>
  );
}

function ActionButton({ 
  icon: Icon, 
  label, 
  cost, 
  onClick, 
  active 
}: { 
  icon: any, 
  label: string, 
  cost?: Partial<Record<string, number>>, 
  onClick: () => void,
  active?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "secondary"}
          className={`
            h-16 flex flex-col gap-1 p-1 relative overflow-hidden group transition-all duration-200
            ${active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:bg-accent/10'}
            border border-white/5
          `}
          onClick={onClick}
        >
          <Icon className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-tighter truncate w-full">{label}</span>
          
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-black/90 border-white/10 text-white p-3">
        <div className="font-bold mb-1 font-serif text-amber-500">{label}</div>
        {cost && (
          <div className="text-xs space-y-1 font-mono text-gray-300">
            {Object.entries(cost).map(([res, amount]) => (
              <div key={res} className="flex justify-between w-24">
                <span className="capitalize">{res}:</span>
                <span className="text-white">{amount}</span>
              </div>
            ))}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
