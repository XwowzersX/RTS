import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, MousePointer2, Swords, Hammer, Pickaxe } from "lucide-react";

export function TutorialModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-white/10 bg-white/5 hover:bg-white/10">
          <BookOpen className="w-4 h-4" />
          Tutorial
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-black/90 border-white/10 text-white backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black font-cinzel text-primary">COMMANDER'S MANUAL</DialogTitle>
          <DialogDescription className="text-gray-400">
            Learn the essentials of Iron & Stone warfare.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4 mt-4">
          <div className="space-y-8">
            <section className="space-y-3">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                <MousePointer2 className="w-5 h-5 text-primary" /> Controls
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex justify-between"><span>Left Click & Drag</span> <span className="text-primary font-mono">Select Units</span></li>
                <li className="flex justify-between"><span>Right Click</span> <span className="text-primary font-mono">Move / Attack / Gather</span></li>
                <li className="flex justify-between"><span>Mouse Wheel</span> <span className="text-primary font-mono">Zoom In/Out</span></li>
                <li className="flex justify-between"><span>Hold 'Z' Key</span> <span className="text-primary font-mono">Strategic Map View</span></li>
                <li className="flex justify-between"><span>Middle Click / Alt+Click</span> <span className="text-primary font-mono">Pan Camera</span></li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                <Pickaxe className="w-5 h-5 text-amber-500" /> Economy
              </h3>
              <p className="text-sm text-gray-300">
                Gather <span className="text-green-500 font-bold">Wood</span> and <span className="text-gray-400 font-bold">Stone</span> to expand your base. 
                Use the <span className="text-amber-500 font-bold">Iron Works</span> to refine iron and the <span className="text-blue-400 font-bold">Factory</span> for advanced equipment.
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <span className="font-bold block mb-1">Lumberjack</span>
                  Gathers wood from clusters of trees.
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <span className="font-bold block mb-1">Miner</span>
                  Extracts stone from mountain outcroppings.
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                <Swords className="w-5 h-5 text-red-500" /> Military
              </h3>
              <p className="text-sm text-gray-300">
                Train knights and archers at the <span className="font-bold">Barracks</span>. Protect your Hub at all costs!
              </p>
              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                <li><span className="text-white font-bold">Knights:</span> High health, melee powerhouses.</li>
                <li><span className="text-white font-bold">Archers:</span> Long-range support units.</li>
                <li><span className="text-white font-bold">Firebirds:</span> Fast air units that ignite enemies, causing lasting burn damage.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                <Hammer className="w-5 h-5 text-blue-500" /> Construction
              </h3>
              <p className="text-sm text-gray-300">
                Use <span className="font-bold text-blue-400">Builders</span> to construct your base. Once you order a building, 
                a builder must physically move to the site before construction begins.
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
