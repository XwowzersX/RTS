import { BuildingType, UnitType, COSTS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { 
  Sword, Shield, Pickaxe, User, 
  Home, Factory, Hammer, Gavel, ArrowUp,
  MousePointer2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ActionGridProps {
  selection: string[];
  entityType?: BuildingType | UnitType;
  onTrain: (type: UnitType) => void;
  onBuild: (type: BuildingType) => void;
  onStop: () => void;
  isPlacementActive: boolean;
}

export function ActionGrid({ 
  selection, 
  entityType, 
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

    // Factories/Works menus
    if (entityType === 'iron_works' || entityType === 'factory') {
        return (
            <div className="col-span-4 text-center text-muted-foreground text-sm py-8 italic">
              Advanced tech researched...
            </div>
        );
    }

    // Workers no longer build
    if (entityType === 'lumberjack' || entityType === 'miner') {
      return (
        <Button 
            variant="destructive" 
            className="col-span-4 h-16 flex flex-col gap-1 border-2 border-red-900/50 hover:border-red-500/50"
            onClick={onStop}
        >
            <MousePointer2 className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider">Stop</span>
        </Button>
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
    <div className="grid grid-cols-4 gap-2 w-full max-w-md">
      {renderActions()}
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
