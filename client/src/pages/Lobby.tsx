import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Swords, Users, BookOpen, User as UserIcon, LogOut, ChevronLeft, Shield, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TutorialModal } from "@/components/game/TutorialModal";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

export default function Lobby() {
  const [gameIdInput, setGameIdInput] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [view, setView] = useState<'menu' | 'multiplayer'>('menu');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const createGameMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.game.create.path, { 
        method: api.game.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) throw new Error('Failed to create game');
      return await res.json() as { gameId: string };
    },
    onSuccess: (data) => {
      setLocation(`/game/${data.gameId}`);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Could not create game session." });
    }
  });

  const joinGame = () => {
    if (!gameIdInput) return;
    setLocation(`/game/${gameIdInput}`);
  };

  const handleMenuClick = (path: string | (() => void)) => {
    setIsTransitioning(true);
    setTimeout(() => {
      if (typeof path === 'string') {
        setLocation(path);
      } else {
        path();
      }
      setIsTransitioning(false);
    }, 600);
  };

  if (view === 'multiplayer') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-black text-white">
        <Button 
          variant="ghost" 
          className="absolute top-4 left-4 gap-2 text-white/50 hover:text-white z-20 font-rajdhani"
          onClick={() => setView('menu')}
        >
          <ChevronLeft className="w-4 h-4" /> Back to Menu
        </Button>
        
        <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="bg-black/60 backdrop-blur-xl border-white/10 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-center font-cinzel text-2xl tracking-widest">MULTIPLAYER</CardTitle>
              <CardDescription className="text-center font-rajdhani uppercase tracking-widest text-primary/60">Global Conflict Hub</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5 p-1 border border-white/5">
                  <TabsTrigger value="create" className="font-rajdhani uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black">Create Game</TabsTrigger>
                  <TabsTrigger value="join" className="font-rajdhani uppercase tracking-widest data-[state=active]:bg-secondary data-[state=active]:text-white">Join Game</TabsTrigger>
                </TabsList>
                
                <TabsContent value="create" className="space-y-4">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center group">
                    <Swords className="w-12 h-12 mx-auto text-primary mb-4 group-hover:scale-110 transition-transform duration-300" />
                    <Button 
                      className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 transition-all hover:tracking-[0.2em] font-rajdhani uppercase"
                      onClick={() => createGameMutation.mutate()}
                      disabled={createGameMutation.isPending}
                    >
                      {createGameMutation.isPending ? "Mobilizing..." : "Create New Lobby"}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="join" className="space-y-4">
                   <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center group">
                    <Users className="w-12 h-12 mx-auto text-secondary mb-4 group-hover:scale-110 transition-transform duration-300" />
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Game ID..." 
                        className="h-12 bg-black/50 border-white/10 font-mono focus:border-secondary transition-colors"
                        value={gameIdInput}
                        onChange={(e) => setGameIdInput(e.target.value)}
                      />
                      <Button 
                        className="h-12 px-6 font-bold bg-secondary hover:bg-secondary/90 text-white transition-all hover:px-8 font-rajdhani uppercase"
                        onClick={joinGame}
                        disabled={!gameIdInput}
                      >
                        Join
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-black text-white font-rajdhani transition-all duration-500 ${isTransitioning ? 'scale-[10] opacity-0 blur-3xl' : 'scale-100 opacity-100 blur-0'}`}>
      {/* Background Decor */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black z-0" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 z-0" />
      
      {/* Top UI */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <TutorialModal />
        {user ? (
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur border border-white/10 px-4 py-2 rounded-full shadow-lg">
            <Link href="/stats">
              <button className="flex items-center gap-2 hover:text-primary transition-colors">
                <UserIcon className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold uppercase tracking-wider">{user.username}</span>
              </button>
            </Link>
            <div className="w-px h-4 bg-white/10" />
            <Link href="/stats">
              <button title="View Stats" className="text-white/40 hover:text-primary transition-colors">
                <BarChart3 className="w-4 h-4" />
              </button>
            </Link>
            <button onClick={() => logoutMutation.mutate()} className="text-white/40 hover:text-red-500 transition-colors" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link href="/auth">
            <Button variant="outline" className="rounded-full bg-black/40 border-white/10 hover:bg-white hover:text-black font-rajdhani uppercase tracking-widest border-2 transition-all">
              Commander Login
            </Button>
          </Link>
        )}
      </div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-16">
        <div className="text-center group cursor-default">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="relative"
          >
            <h1 className="text-[120px] font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-300 to-gray-600 font-cinzel leading-none tracking-tighter drop-shadow-[0_0_50px_rgba(255,255,255,0.3)] transition-all duration-700 logo-revamp">
              IRON <span className="text-gray-500">&</span> STONE
            </h1>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          </motion.div>
          <p className="text-primary mt-8 text-xl uppercase tracking-[1.5em] font-bold opacity-60 animate-pulse">
            Real-Time Strategy Warfare
          </p>
        </div>

        <div className="flex flex-col gap-6 w-full max-w-3xl px-4">
          {/* Campaign - featured button */}
          <div className="w-full">
            <MenuButton 
              label="Campaign" 
              sub="The Veth War — Story Mode"
              fireColor="rgba(239, 68, 68, 0.7)" 
              onClick={() => handleMenuClick('/campaign')}
              featured
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MenuButton 
              label="Quick Play" 
              sub="Solo vs IronMind AI"
              fireColor="rgba(234, 179, 8, 0.6)" 
              onClick={() => handleMenuClick('/single-player')}
            />
            <MenuButton 
              label="Multiplayer" 
              sub="Global Conflict"
              fireColor="rgba(59, 130, 246, 0.6)" 
              onClick={() => handleMenuClick(() => setView('multiplayer'))}
            />
          </div>

          {user && (
            <div className="flex justify-center">
              <MenuButton 
                label="Stats" 
                sub="Commander Record"
                fireColor="rgba(168, 85, 247, 0.6)" 
                onClick={() => handleMenuClick('/stats')}
                className="w-full md:w-1/2"
              />
            </div>
          )}
          {!user && (
            <div className="text-center">
              <Link href="/auth">
                <Button variant="link" className="text-white/40 hover:text-white uppercase tracking-[0.5em] text-xs">
                  Login to unlock Stats & Rankings
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .fly-in-effect {
          animation: fly-in 0.6s forwards cubic-bezier(0.7, 0, 0.3, 1);
          pointer-events: none;
        }
        @keyframes fly-in {
          0% { transform: scale(1); filter: blur(0); }
          100% { transform: scale(20); opacity: 0; filter: blur(40px); }
        }
        .logo-revamp {
          text-shadow: 
            0 0 20px rgba(255,255,255,0.5),
            0 5px 0 #333,
            0 10px 0 #222;
        }
      `}} />
    </div>
  );
}

function MenuButton({ label, sub, fireColor, onClick, className = "", featured = false }: any) {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => {
      onClick();
      setTimeout(() => setIsClicked(false), 500);
    }, 100);
  };

  return (
    <motion.button
      whileHover={{ 
        rotateX: featured ? 0 : -10, 
        rotateY: featured ? 0 : 10,
        scale: 1.03,
        boxShadow: `0 0 ${featured ? 80 : 40}px ${fireColor}`
      }}
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      className={`
        relative ${featured ? 'h-24' : 'h-32'} bg-white/5 border overflow-hidden group transition-all duration-300
        flex flex-col items-center justify-center gap-1 w-full ${className}
        ${featured ? 'border-red-900/40 hover:border-red-500/60' : 'border-white/10 hover:border-white/40'}
        ${isClicked ? 'z-50' : ''}
      `}
      style={{ perspective: "1000px" }}
    >
      {/* Featured: always-on subtle glow */}
      {featured && (
        <div 
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 140%, ${fireColor} 0%, transparent 70%)`,
          }}
        />
      )}

      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 120%, ${fireColor} 0%, transparent 80%)`,
          filter: 'blur(15px)'
        }}
      />
      
      {/* Animated Fire-like lines */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-1 h-full bg-gradient-to-t from-white to-transparent animate-bounce [animation-duration:1s]" />
        <div className="absolute bottom-0 left-1/2 w-1 h-3/4 bg-gradient-to-t from-white to-transparent animate-bounce [animation-duration:1.5s]" />
        <div className="absolute bottom-0 left-3/4 w-1 h-full bg-gradient-to-t from-white to-transparent animate-bounce [animation-duration:1.2s]" />
      </div>

      {featured && (
        <span className="text-[10px] font-mono tracking-[0.5em] text-red-400/70 uppercase mb-0.5 relative z-10">
          ▶ Story Mode — The Veth War
        </span>
      )}
      <span className={`${featured ? 'text-4xl' : 'text-3xl'} font-black font-cinzel tracking-[0.2em] relative z-10 group-hover:text-white group-hover:scale-105 transition-all duration-300`}>
        {label}
      </span>
      <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground relative z-10 font-bold group-hover:text-white/60 transition-colors">
        {sub}
      </span>
      
      {/* Click Flash Overlay */}
      <AnimatePresence>
        {isClicked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-20"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}
