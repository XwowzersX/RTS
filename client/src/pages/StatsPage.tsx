import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Trophy, Skull, Pickaxe, Clock, ChevronLeft, Shield, Lock, CheckCircle2 } from "lucide-react";

const MISSIONS = [
  {
    number: 1,
    name: "Beachhead",
    description: "Survive 10 minutes surrounded by Veth forces.",
    color: "#ef4444",
  },
  {
    number: 2,
    name: "Iron Veil",
    description: "Destroy all 3 Veth command nodes.",
    color: "#f97316",
    locked: true,
  },
  {
    number: 3,
    name: "Last Light",
    description: "Escort the Ark to the extraction zone.",
    color: "#a855f7",
    locked: true,
  },
];

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

  const campaignMask = user.campaign_missions ?? 0;

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

      <div className="max-w-4xl mx-auto space-y-12">
        <h1 className="text-5xl font-black font-cinzel mb-0 text-center tracking-widest bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
          COMMANDER STATS
        </h1>

        {/* Combat Stats */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-[0.4em] text-white/30 mb-4">Combat Record</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2 pt-4 px-4">
                  <stat.icon className={`w-6 h-6 ${stat.color} mb-1`} />
                  <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-3xl font-bold font-mono">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Campaign Progress */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-[0.4em] text-white/30 mb-4">Campaign — The Veth War</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MISSIONS.map((mission, idx) => {
              const isComplete = (campaignMask & (1 << idx)) !== 0;
              const isLocked = !isComplete && idx > 0 && (campaignMask & (1 << (idx - 1))) === 0;
              return (
                <Card
                  key={mission.number}
                  className={`relative border overflow-hidden transition-all duration-300 ${
                    isComplete
                      ? 'border-yellow-500/40 bg-yellow-500/5'
                      : isLocked
                      ? 'border-white/5 bg-white/2 opacity-50'
                      : 'border-white/10 bg-white/5 hover:border-red-500/40'
                  }`}
                >
                  {/* Color stripe */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
                    style={{ background: isLocked ? '#444' : mission.color }}
                  />
                  <CardHeader className="pb-2 pt-5 px-5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-white/30 uppercase tracking-widest">
                        Mission {mission.number}
                      </span>
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4 text-white/20" />
                      ) : (
                        <Shield className="w-4 h-4" style={{ color: mission.color }} />
                      )}
                    </div>
                    <CardTitle className="text-lg font-cinzel tracking-widest" style={{ color: isLocked ? '#555' : (isComplete ? '#ffd700' : 'white') }}>
                      {mission.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <p className="text-xs text-white/40 leading-relaxed">{mission.description}</p>
                    <div className="mt-3">
                      {isComplete ? (
                        <span className="text-xs font-mono text-yellow-400 uppercase tracking-widest">✓ Completed</span>
                      ) : isLocked ? (
                        <span className="text-xs font-mono text-white/20 uppercase tracking-widest">Locked</span>
                      ) : (
                        <Link href="/campaign">
                          <span className="text-xs font-mono uppercase tracking-widest cursor-pointer hover:underline" style={{ color: mission.color }}>
                            → Play Mission
                          </span>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
