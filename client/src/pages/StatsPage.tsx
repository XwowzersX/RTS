import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trophy, Skull, Pickaxe, Clock, ChevronLeft } from "lucide-react";

export default function StatsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <h1 className="text-2xl font-bold mb-4">Please login to view stats</h1>
        <Link href="/auth">
          <Button>Go to Login</Button>
        </Link>
      </div>
    );
  }

  const stats = [
    { label: "Wins", value: user.wins || 0, icon: Trophy, color: "text-yellow-500" },
    { label: "Losses", value: user.losses || 0, icon: Skull, color: "text-red-500" },
    { label: "Kills", value: user.kills || 0, icon: Skull, color: "text-orange-500" },
    { label: "Resources", value: user.resources_gathered || 0, icon: Pickaxe, color: "text-blue-500" },
    { label: "Play Time", value: `${Math.floor((user.play_time || 0) / 60)}m`, icon: Clock, color: "text-green-500" },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8 font-rajdhani">
      <Link href="/">
        <Button variant="ghost" className="mb-8 gap-2 hover:bg-white/10">
          <ChevronLeft className="w-4 h-4" /> Back to Menu
        </Button>
      </Link>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black font-cinzel mb-12 text-center tracking-widest bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
          COMMANDER STATS
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <stat.icon className={`w-8 h-8 ${stat.color} mb-2`} />
                <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold font-mono">
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
