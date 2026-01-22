import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Swords, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Lobby() {
  const [gameIdInput, setGameIdInput] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black z-0" />
      <div className="absolute inset-0 bg-[url('https://pixabay.com/get/g9294804f15fa0cf910b5921cb72a2dbcf682118db6fb4d68faaa180b66f1acf461aa04322ba3a43c0cdde0efecd5bb58eb73d7dceb41baef55206638261c62df_1280.jpg')] opacity-10 bg-cover bg-center z-0" />
      {/* Descriptive comment: Abstract metallic texture for strategy vibe */}

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 font-cinzel tracking-wider drop-shadow-lg">
            IRON & STONE
          </h1>
          <p className="text-muted-foreground mt-2 font-rajdhani text-lg uppercase tracking-widest">
            Real-Time Strategy Warfare
          </p>
        </div>

        <Card className="bg-black/60 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-center">Enter the Battlefield</CardTitle>
            <CardDescription className="text-center">Start a new campaign or join an existing conflict.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5">
                <TabsTrigger value="create">Create Game</TabsTrigger>
                <TabsTrigger value="join">Join Game</TabsTrigger>
              </TabsList>
              
              <TabsContent value="create" className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                  <Swords className="w-12 h-12 mx-auto text-primary mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Host a new 1v1 match and invite a friend.
                  </p>
                  <Button 
                    className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90"
                    onClick={() => createGameMutation.mutate()}
                    disabled={createGameMutation.isPending}
                  >
                    {createGameMutation.isPending ? "Mobilizing..." : "Create New Lobby"}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="join" className="space-y-4">
                 <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                  <Users className="w-12 h-12 mx-auto text-secondary mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter a Game ID to join the fight.
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Game ID..." 
                      className="h-12 bg-black/50 border-white/10 font-mono"
                      value={gameIdInput}
                      onChange={(e) => setGameIdInput(e.target.value)}
                    />
                    <Button 
                      className="h-12 px-6 font-bold bg-secondary hover:bg-secondary/90 text-white"
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

      <div className="absolute bottom-8 text-xs text-white/20 font-mono">
        V1.0.1 Sound-N-Systems Update
        @copyright 2026
      </div>
    </div>
  );
}
