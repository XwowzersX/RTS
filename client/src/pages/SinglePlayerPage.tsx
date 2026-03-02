import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Construction, AlertTriangle } from "lucide-react";

export default function SinglePlayerPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Caution Tape Effect */}
      <div className="absolute top-20 -left-20 w-[150%] h-12 bg-yellow-400 text-black font-black flex items-center justify-around -rotate-12 select-none shadow-2xl">
        {Array(10).fill("UNDER CONSTRUCTION").map((t, i) => <span key={i}>{t}</span>)}
      </div>
      <div className="absolute bottom-20 -left-20 w-[150%] h-12 bg-yellow-400 text-black font-black flex items-center justify-around rotate-12 select-none shadow-2xl">
        {Array(10).fill("CAUTION: WARZONE").map((t, i) => <span key={i}>{t}</span>)}
      </div>

      <div className="relative z-10 text-center space-y-8 max-w-lg">
        <div className="flex justify-center">
          <div className="p-8 bg-yellow-400 rounded-full animate-bounce shadow-[0_0_50px_rgba(250,204,21,0.5)]">
            <Construction className="w-24 h-24 text-black" />
          </div>
        </div>
        
        <h1 className="text-6xl font-black font-cinzel text-white tracking-tighter">
          COMING SOON
        </h1>
        
        <p className="text-xl text-yellow-400 font-bold font-rajdhani uppercase tracking-widest flex items-center justify-center gap-2">
          <AlertTriangle className="w-6 h-6" /> System Under Heavy Fire <AlertTriangle className="w-6 h-6" />
        </p>

        <Link href="/">
          <Button className="mt-8 bg-white text-black hover:bg-gray-200 font-bold px-8 h-12 rounded-none">
            RETREAT TO BASE
          </Button>
        </Link>
      </div>
    </div>
  );
}
