import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Construction, AlertTriangle, Play, Lock, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import quickPlayPng from "@assets/generated_images/generated_image.png";
import campaignPng from "@assets/generated_images/generated_image.png";

export default function SinglePlayerPage() {
  const [, setLocation] = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleQuickPlay = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      // For now, create a default game or redirect to a special solo route
      // We'll just go to a game with a random ID for now to simulate quick play
      const randomId = Math.random().toString(36).substring(7);
      setLocation(`/game/${randomId}`);
    }, 600);
  };

  return (
    <div className={`min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden transition-all duration-500 ${isTransitioning ? 'scale-[10] opacity-0 blur-3xl' : 'scale-100 opacity-100 blur-0'}`}>
      {/* Background Decor */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black z-0" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 z-0" />

      {/* Navigation */}
      <Link href="/">
        <Button 
          variant="ghost" 
          className="absolute top-4 left-4 gap-2 text-white/50 hover:text-white z-20 font-rajdhani"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Base
        </Button>
      </Link>

      {/* Header */}
      <div className="relative z-10 text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-6xl font-black font-cinzel text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
          SOLO COMMAND
        </h1>
        <p className="text-primary mt-2 text-sm uppercase tracking-[1em] font-bold opacity-60">
          Artificial Intelligence Engagement
        </p>
      </div>

      {/* Buttons Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl px-4">
        <BigMenuButton
          label="Quick Play"
          sub="Skirmish vs AI"
          image={quickPlayPng}
          fireColor="rgba(59, 130, 246, 0.6)"
          onClick={handleQuickPlay}
          icon={Play}
        />
        <BigMenuButton
          label="Campaign"
          sub="The Iron Chronicles"
          image={campaignPng}
          fireColor="rgba(156, 163, 175, 0.4)"
          disabled={true}
          icon={Lock}
        />
      </div>

      {/* Footer Caution */}
      <div className="absolute bottom-10 left-0 w-full overflow-hidden pointer-events-none opacity-20 group">
        <div className="flex whitespace-nowrap animate-marquee">
          {Array(20).fill("DANGER: AI EVOLUTION IN PROGRESS").map((t, i) => (
            <span key={i} className="mx-8 text-yellow-500 font-black font-rajdhani text-xl tracking-widest">{t}</span>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
      `}} />
    </div>
  );
}

function BigMenuButton({ label, sub, image, fireColor, onClick, disabled, icon: Icon }: any) {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setIsClicked(true);
    setTimeout(() => {
      onClick();
      setTimeout(() => setIsClicked(false), 500);
    }, 100);
  };

  return (
    <motion.button
      whileHover={!disabled ? { 
        rotateX: -5, 
        rotateY: 5,
        scale: 1.02,
        boxShadow: `0 0 50px ${fireColor}`
      } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={handleClick}
      disabled={disabled}
      className={`
        relative h-80 bg-black border border-white/10 overflow-hidden group transition-all duration-300
        flex flex-col items-center justify-end p-8 gap-2 hover:border-white/40
        ${disabled ? 'cursor-not-allowed grayscale opacity-60' : 'cursor-pointer'}
        ${isClicked ? 'z-50' : ''}
      `}
      style={{ perspective: "1000px" }}
    >
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img src={image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={label} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      {/* Fire Glow */}
      <div 
        className={`absolute inset-0 opacity-0 ${!disabled ? 'group-hover:opacity-100' : ''} transition-opacity duration-500 pointer-events-none z-1`}
        style={{
          background: `radial-gradient(circle at 50% 100%, ${fireColor} 0%, transparent 70%)`,
          filter: 'blur(20px)'
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <Icon className={`w-12 h-12 mb-2 ${disabled ? 'text-gray-500' : 'text-primary animate-pulse'}`} />
        <span className="text-5xl font-black font-cinzel tracking-tighter text-white group-hover:scale-110 transition-transform duration-300">
          {label}
        </span>
        <span className="text-sm uppercase tracking-[0.5em] text-primary/60 font-bold font-rajdhani">
          {sub}
        </span>
      </div>

      {/* Under Construction Tape for disabled */}
      {disabled && (
        <div className="absolute top-1/2 left-0 w-[120%] h-12 bg-yellow-500 text-black font-black flex items-center justify-center -rotate-12 -translate-x-10 shadow-2xl z-20 border-y-4 border-black/20">
          <span className="tracking-[0.5em] text-lg">UNDER CONSTRUCTION</span>
        </div>
      )}
      
      {/* Click Flash Overlay */}
      <AnimatePresence>
        {isClicked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-30"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}
